import { PrismaClient, EngagementRequestStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, BusinessRuleError } from '../../../shared/errors';
import { assertValidRequestTransition } from '../domain/request-state-machine';

export interface RespondInfoMemberRequestInput {
  responseNotes: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedBrief?: Record<string, any>;
}

export interface RespondInfoMemberRequestResult {
  id: string;
  referenceCode: string;
  status: EngagementRequestStatus;
  message: string;
}

export class RespondInfoMemberRequestUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(
    userId: string,
    identifier: string,
    input: RespondInfoMemberRequestInput,
    meta?: { ipAddress?: string; requestId?: string },
  ): Promise<RespondInfoMemberRequestResult> {
    const request = await this.prisma.engagementRequest.findFirst({
      where: {
        OR: [{ id: identifier }, { referenceCode: identifier }],
      },
      include: {
        member: { select: { id: true, userId: true } },
      },
    });

    if (!request || request.member.userId !== userId) {
      throw new NotFoundError(`Engagement request '${identifier}' not found.`);
    }

    if (request.status !== EngagementRequestStatus.AWAITING_RESPONSE) {
      throw new BusinessRuleError(
        `Request is in '${request.status}' status. You can only respond with info when the status is AWAITING_RESPONSE.`,
      );
    }

    assertValidRequestTransition(request.status, EngagementRequestStatus.UNDER_REVIEW);

    // Merge existing brief with updatedBrief if provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let newBrief: any = request.brief;
    if (input.updatedBrief && typeof input.updatedBrief === 'object') {
      newBrief = {
        ...(typeof request.brief === 'object' && request.brief ? request.brief : {}),
        ...input.updatedBrief,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    }

    const newReviewNotes = request.reviewNotes
      ? `${request.reviewNotes}\n[Member Response]: ${input.responseNotes}`
      : `[Member Response]: ${input.responseNotes}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.engagementRequest.update({
        where: { id: request.id },
        data: {
          status: EngagementRequestStatus.UNDER_REVIEW,
          brief: newBrief ?? undefined,
          reviewNotes: newReviewNotes,
        },
      });

      // 1. Immutable Audit Log for Member Response
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'MEMBER',
          action: 'MEMBER_PROVIDED_INFO',
          resource: 'EngagementRequest',
          resourceId: request.id,
          ipAddress: meta?.ipAddress,
          requestId: meta?.requestId,
          reason: `Member responded to info request: ${input.responseNotes.substring(0, 50)}...`,
          previousState: { status: request.status, brief: request.brief },
          newState: {
            status: EngagementRequestStatus.UNDER_REVIEW,
            brief: newBrief,
          },
        },
      });

      // 2. Member Activity Feed Timeline Entry
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'MEMBER',
          action: 'REQUEST_INFO_PROVIDED', // We need to make sure this is mapped in activity-mapper.ts
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: `Member submitted requested info`,
          previousState: { status: request.status },
          newState: {
            status: EngagementRequestStatus.UNDER_REVIEW,
          },
        },
      });

      // We should potentially notify operations here if there's a staff notification system.
      // (The prompt says: "notify operations reviewer")

      return rec;
    });

    return {
      id: updated.id,
      referenceCode: updated.referenceCode,
      status: updated.status,
      message: 'Information submitted successfully. Your request is back under review.',
    };
  }
}
