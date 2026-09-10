import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import {
  SessionService,
  sessionService as defaultSessionService,
} from '../infrastructure/session.service';

export interface RevokeSessionInput {
  userId: string;
  targetSessionId: string;
  currentSessionId?: string;
  reason?: string;
  ipAddress?: string;
  requestId?: string;
}

export interface RevokeSessionOutput {
  isCurrentSession: boolean;
}

export class RevokeSessionUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly sessionSvc: SessionService = defaultSessionService,
  ) {}

  async execute(input: RevokeSessionInput): Promise<RevokeSessionOutput> {
    const { userId, targetSessionId, currentSessionId, reason, ipAddress, requestId } = input;

    await this.prisma.$transaction(async (tx) => {
      await this.sessionSvc.revokeSessionById(
        userId,
        targetSessionId,
        reason || 'Revoked by user',
        tx,
      );

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'USER',
          action: 'SESSION_REVOKED',
          resource: 'Session',
          resourceId: targetSessionId,
          newState: {
            revokedSessionId: targetSessionId,
            reason: reason || 'Revoked by user',
            isCurrentSession: Boolean(currentSessionId && targetSessionId === currentSessionId),
          },
          ipAddress: ipAddress || null,
          requestId: requestId || null,
        },
      });
    });

    return {
      isCurrentSession: Boolean(currentSessionId && targetSessionId === currentSessionId),
    };
  }
}
