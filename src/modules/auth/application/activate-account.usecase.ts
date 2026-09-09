import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma, hashProvider, IHashProvider } from '../../../shared/providers';
import { normalizeEmail } from '../../../shared/utils';
import { NotFoundError } from '../../../shared/errors';
import {
  SessionService,
  sessionService as defaultSessionService,
} from '../infrastructure/session.service';
import { ActivateAccountInput } from '../presentation/auth.schema';

export interface ActivateAccountUseCaseResult {
  sessionToken: string;
  user: {
    id: string;
    email: string;
    status: string;
  };
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export class ActivateAccountUseCase {
  constructor(
    private prisma: PrismaClient = defaultPrisma,
    private hashProv: IHashProvider = hashProvider,
    private sessionSvc: SessionService = defaultSessionService,
  ) {}

  async execute(
    input: ActivateAccountInput,
    meta?: RequestMeta,
  ): Promise<ActivateAccountUseCaseResult> {
    const emailNormalized = normalizeEmail(input.email);

    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (!user) {
      throw new NotFoundError('Registration record not found.');
    }

    const passwordHash = await this.hashProv.hash(input.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: 'ACTIVE',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'ACCOUNT_ACTIVATED',
          resource: 'User',
          resourceId: user.id,
          ipAddress: meta?.ipAddress || null,
        },
      });
    });

    const { rawToken } = await this.sessionSvc.createSession(
      user.id,
      meta?.ipAddress,
      meta?.userAgent,
    );

    return {
      sessionToken: rawToken,
      user: {
        id: user.id,
        email: user.email,
        status: 'ACTIVE',
      },
    };
  }
}
