import {
  PrismaClient,
  EngagementRequestStatus,
  CatalogItemCategory,
  AssessmentCredentialStatus,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, ConflictError } from '../../../shared/errors';
import { assertValidRequestTransition } from '../domain/request-state-machine';
import {
  IRequestNotificationService,
  requestNotificationService as defaultNotificationService,
} from './services/request-notification.service';
import { AdminActorContext } from './admin-start-review.usecase';

export interface AdminFulfillRequestInput {
  deliveryNotes?: string;
  customAccessUrl?: string;
}

export interface FulfillmentEntitlementInfo {
  type: string;
  username?: string;
  accessUrl?: string;
  grantedAt: string;
  [key: string]: unknown;
}

export interface AdminFulfillRequestResult {
  id: string;
  referenceCode: string;
  status: EngagementRequestStatus;
  fulfilledAt: string;
  entitlement?: FulfillmentEntitlementInfo;
  message: string;
}

export class AdminFulfillRequestUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly notificationSvc: IRequestNotificationService = defaultNotificationService,
  ) {}

  async execute(
    identifier: string,
    input: AdminFulfillRequestInput,
    actor: AdminActorContext,
  ): Promise<AdminFulfillRequestResult> {
    const request = await this.prisma.engagementRequest.findFirst({
      where: {
        OR: [{ id: identifier }, { referenceCode: identifier }],
      },
      include: {
        member: {
          include: {
            user: { select: { id: true, email: true } },
          },
        },
        catalogItem: true,
      },
    });

    if (!request) {
      throw new NotFoundError(`Engagement request '${identifier}' not found.`);
    }

    assertValidRequestTransition(request.status, EngagementRequestStatus.FULFILLED);

    const now = new Date();
    let assignedEntitlement: FulfillmentEntitlementInfo | undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Grant digital entitlement if it's a diagnostic tool
      if (request.category === CatalogItemCategory.DIAGNOSTIC_TOOL) {
        const availableCredential = await tx.assessmentCredentialPool.findFirst({
          where: { status: AssessmentCredentialStatus.AVAILABLE },
        });

        if (availableCredential) {
          await tx.assessmentCredentialPool.update({
            where: { id: availableCredential.id },
            data: {
              status: AssessmentCredentialStatus.ASSIGNED,
              assignedTo: request.memberId,
              assignedAt: now,
            },
          });

          assignedEntitlement = {
            type: 'ASSESSMENT_CREDENTIAL',
            username: availableCredential.username,
            accessUrl: input.customAccessUrl || availableCredential.accessUrl || undefined,
            grantedAt: now.toISOString(),
          };
        } else if (input.customAccessUrl) {
          assignedEntitlement = {
            type: 'CUSTOM_ACCESS_URL',
            accessUrl: input.customAccessUrl,
            grantedAt: now.toISOString(),
          };
        }
      } else if (input.customAccessUrl) {
        assignedEntitlement = {
          type: 'SERVICE_DELIVERABLE',
          accessUrl: input.customAccessUrl,
          grantedAt: now.toISOString(),
        };
      }

      // Append delivery notes to adminNotes if provided
      let combinedNotes = request.adminNotes;
      if (input.deliveryNotes?.trim()) {
        const line = `[Delivery Note]: ${input.deliveryNotes.trim()}`;
        combinedNotes = combinedNotes ? `${combinedNotes}\n${line}` : line;
      }

      const updateResult = await tx.engagementRequest.updateMany({
        where: { id: request.id, status: request.status },
        data: {
          status: EngagementRequestStatus.FULFILLED,
          fulfilledAt: now,
          adminNotes: combinedNotes,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictError(
          `Request status was updated concurrently. Expected '${request.status}' but it has changed. Please refresh and try again.`,
        );
      }

      const auditNewState: Record<string, unknown> = {
        status: EngagementRequestStatus.FULFILLED,
        fulfilledAt: now.toISOString(),
      };
      if (assignedEntitlement) {
        auditNewState.entitlement = assignedEntitlement;
      }

      // 2. Immutable Staff AuditLog (SEC-33)
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          actorRole: actor.staffRole,
          action: 'ADMIN_REQUEST_FULFILLED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: input.deliveryNotes?.trim() || null,
          ipAddress: actor.ipAddress,
          requestId: actor.requestId,
          previousState: { status: request.status },
          newState: JSON.parse(JSON.stringify(auditNewState)),
        },
      });

      // 3. Member Activity Feed Timeline Entry (ACT-58)
      await tx.auditLog.create({
        data: {
          actorId: request.member.userId,
          actorRole: 'MEMBER',
          action: 'REQUEST_FULFILLED',
          resource: 'EngagementRequest',
          resourceId: request.id,
          reason: input.deliveryNotes?.trim() || null,
          previousState: { status: request.status },
          newState: { status: EngagementRequestStatus.FULFILLED },
        },
      });

      // 4. Persist Notification in DB
      let fulfillmentMessageEn = `Your request (${request.referenceCode}) has been fulfilled!`;
      let fulfillmentMessageAr = `تم تنفيذ طلبك (${request.referenceCode}) بنجاح!`;

      if (assignedEntitlement?.username) {
        fulfillmentMessageEn += ` Assessment Username: ${assignedEntitlement.username}.`;
        fulfillmentMessageAr += ` اسم مستخدم التقييم: ${assignedEntitlement.username}.`;
      }
      if (assignedEntitlement?.accessUrl) {
        fulfillmentMessageEn += ` Access URL: ${assignedEntitlement.accessUrl}.`;
        fulfillmentMessageAr += ` رابط الدخول: ${assignedEntitlement.accessUrl}.`;
      }
      if (input.deliveryNotes?.trim()) {
        fulfillmentMessageEn += ` Notes: ${input.deliveryNotes.trim()}`;
        fulfillmentMessageAr += ` ملاحظات: ${input.deliveryNotes.trim()}`;
      }

      const notifInput = {
        userId: request.member.userId,
        memberEmail: request.member.user.email,
        referenceCode: request.referenceCode,
        type: 'REQUEST_FULFILLED',
        titleEn: 'Request Fulfilled',
        titleAr: 'تم تنفيذ طلبك بنجاح',
        messageEn: fulfillmentMessageEn,
        messageAr: fulfillmentMessageAr,
        metadata: {
          requestId: request.id,
          status: EngagementRequestStatus.FULFILLED,
          entitlement: assignedEntitlement,
        },
      };

      await this.notificationSvc.saveInAppNotification(tx, notifInput);

      return {
        id: request.id,
        referenceCode: request.referenceCode,
        status: EngagementRequestStatus.FULFILLED,
        fulfilledAt: now,
        assignedEntitlement,
        notifInput,
      };
    });

    // 5. Dispatch Email Outside Transaction
    this.notificationSvc.dispatchEmailOnly(updated.notifInput).catch(() => {});

    return {
      id: updated.id,
      referenceCode: updated.referenceCode,
      status: updated.status,
      fulfilledAt: now.toISOString(),
      entitlement: assignedEntitlement,
      message: 'Request fulfilled and digital entitlement granted.',
    };
  }
}
