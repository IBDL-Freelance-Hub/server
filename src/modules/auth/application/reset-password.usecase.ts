import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma, hashProvider, IHashProvider } from '../../../shared/providers';
import { InvalidTokenError, ValidationError } from '../../../shared/errors';
import {
  SessionService,
  sessionService as defaultSessionService,
} from '../infrastructure/session.service';
import { ResetPasswordInput } from '../presentation/auth.schema';

export interface ResetPasswordResult {
  success: boolean;
  message: string;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export class ResetPasswordUseCase {
  constructor(
    private prisma: PrismaClient = defaultPrisma,
    private hashProv: IHashProvider = hashProvider,
    private sessionSvc: SessionService = defaultSessionService,
  ) {}

  async execute(input: ResetPasswordInput, meta?: RequestMeta): Promise<ResetPasswordResult> {
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');

    // 1. Query VerificationToken
    const verToken = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    const now = new Date();

    // 2. Validate token existence, purpose, and status
    if (
      !verToken ||
      verToken.purpose !== 'PASSWORD_RESET' ||
      verToken.usedAt !== null ||
      verToken.invalidatedAt !== null ||
      verToken.expiresAt <= now
    ) {
      throw new InvalidTokenError('This reset link is no longer valid. Request a new one.');
    }

    const user = verToken.user;

    // 3. SEC-21: Validate newPassword does not equal email or email local part
    const emailLower = user.email.toLowerCase();
    const localPart = emailLower.split('@')[0];
    const newPasswordLower = input.newPassword.toLowerCase();

    if (newPasswordLower === emailLower || newPasswordLower === localPart) {
      throw new ValidationError('Password cannot be your email address or username.');
    }

    // 4. Hash new password
    const newPasswordHash = await this.hashProv.hash(input.newPassword);

    // 5. Execute in single Prisma transaction with Session Revocation
    await this.prisma.$transaction(async (tx) => {
      // Update User passwordHash
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      // Mark VerificationToken as consumed
      await tx.verificationToken.update({
        where: { id: verToken.id },
        data: { usedAt: now },
      });

      // Revoke all active sessions for this user within transaction (SEC-25)
      await this.sessionSvc.revokeAllUserSessions(user.id, 'Password Reset', tx);

      // Log Audit Trail Entry
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'PASSWORD_RESET_SUCCESSFUL',
          resource: 'User',
          resourceId: user.id,
          ipAddress: meta?.ipAddress || 'unknown',
        },
      });
    });

    return {
      success: true,
      message: 'Password reset successfully. Please log in.',
    };
  }
}
