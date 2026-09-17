import { PrismaClient, Prisma } from '@prisma/client';
import {
  prisma as defaultPrisma,
  hashProvider as defaultHashProvider,
  IHashProvider,
} from '../../../shared/providers';
import { ValidationError } from '../../../shared/errors';
import { PASSWORD_HISTORY_DEPTH, PASSWORD_HISTORY_REUSE_ERROR } from '../domain';

export class PasswordHistoryService {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly hashProv: IHashProvider = defaultHashProvider,
  ) {}

  /**
   * Verifies that the candidate password does not match the active password or
   * any of the last 3 historical passwords.
   *
   * Optimizations:
   * 1. Short-circuits immediately on current active hash before hitting the DB.
   * 2. Evaluates historical Argon2 hashes in parallel with Promise.all.
   */
  async assertNotReused(
    userId: string,
    currentPasswordHash: string,
    candidatePassword: string,
  ): Promise<void> {
    // 1. Short-Circuit Step: Check candidate password against active current hash
    const isCurrentMatch = await this.hashProv.verify(currentPasswordHash, candidatePassword);
    if (isCurrentMatch) {
      throw new ValidationError(PASSWORD_HISTORY_REUSE_ERROR);
    }

    // 2. Query up to 3 most recent entries from PasswordHistory
    const recentHistory = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_HISTORY_DEPTH,
      select: { passwordHash: true },
    });

    if (recentHistory.length === 0) {
      return;
    }

    // 3. Parallel Argon2 Verification across historical hashes
    const matchResults = await Promise.all(
      recentHistory.map((record) => this.hashProv.verify(record.passwordHash, candidatePassword)),
    );

    if (matchResults.some(Boolean)) {
      throw new ValidationError(PASSWORD_HISTORY_REUSE_ERROR);
    }
  }

  /**
   * Atomically archives the current password hash and deterministically prunes
   * historical entries beyond the latest 3. Must be executed inside a Prisma transaction.
   */
  async archiveAndPrune(
    tx: Prisma.TransactionClient,
    userId: string,
    currentPasswordHash: string,
  ): Promise<void> {
    // 1. Archive current password hash into history
    await tx.passwordHistory.create({
      data: {
        userId,
        passwordHash: currentPasswordHash,
      },
    });

    // 2. Deterministically find and prune records beyond depth 3
    const obsoleteRecords = await tx.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: PASSWORD_HISTORY_DEPTH,
      select: { id: true },
    });

    if (obsoleteRecords.length > 0) {
      await tx.passwordHistory.deleteMany({
        where: { id: { in: obsoleteRecords.map((r) => r.id) } },
      });
    }
  }
}

export const passwordHistoryService = new PasswordHistoryService();
