import { PrismaClient, MembershipTier, MembershipStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError, BusinessRuleError } from '../../../shared/errors';
import { getTierPrice, isValidUpgrade } from '../domain/pricing';
import {
  PaymentSimulatorService,
  paymentSimulatorService as defaultPaymentSimulator,
  PaymentSimulationStatus,
} from '../infrastructure/payment-simulator.service';

export interface UpgradeMembershipInput {
  targetTier: MembershipTier;
  paymentMethodToken?: string;
  simulationOutcome?: 'SUCCESS' | 'FAIL' | 'PENDING';
}

export interface RequestMetadata {
  ipAddress?: string;
  requestId?: string;
}

export interface MembershipRecordDto {
  id: string;
  tier: MembershipTier;
  status: MembershipStatus;
  startDate: Date;
  endDate: Date;
  price: number;
}

export interface OutstandingUpgradeAttemptDto {
  targetTier: MembershipTier;
  state: 'declined' | 'pending';
  transactionRef: string;
}

export interface UpgradeMembershipResult {
  success: boolean;
  paymentStatus: PaymentSimulationStatus;
  transactionId: string;
  failureReason?: string;
  membership?: MembershipRecordDto;
  outstandingUpgradeAttempt?: OutstandingUpgradeAttemptDto;
  message: string;
}

export class UpgradeMembershipUseCase {
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly paymentSimulator: PaymentSimulatorService = defaultPaymentSimulator,
  ) {}

  async execute(
    userId: string,
    input: UpgradeMembershipInput,
    meta: RequestMetadata = {},
  ): Promise<UpgradeMembershipResult> {
    // 1. Resolve member record
    const member = await this.prisma.member.findUnique({
      where: { userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!member) {
      throw new NotFoundError('Member profile not found');
    }

    const currentMembership = member.memberships[0] || null;
    const currentTier = currentMembership?.tier ?? MembershipTier.ESSENTIAL;

    // 2. Validate tier upgrade hierarchy (SEC-33, MEM-07)
    if (!isValidUpgrade(currentTier, input.targetTier)) {
      throw new BusinessRuleError(
        `Cannot upgrade from ${currentTier} to ${input.targetTier}. Target tier must be higher than current active tier.`,
      );
    }

    // 3. Authoritative server-side pricing resolution (SEC-33)
    const price = getTierPrice(input.targetTier);

    // 4. Process payment via Sandbox Payment Simulator
    const paymentResult = await this.paymentSimulator.processPayment({
      memberId: member.id,
      userId,
      amount: price,
      currency: 'USD',
      targetTier: input.targetTier,
      paymentMethodToken: input.paymentMethodToken,
      simulationOutcome: input.simulationOutcome,
    });

    // 5. Outcome handling in accordance with PAY-05, PAY-08, MEM-14
    if (paymentResult.status === 'DECLINED') {
      // RESILIENT MEMBERSHIP RULE (PAY-05, MEM-14): Leave current active membership untouched
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'MEMBER',
          action: 'PAYMENT_DECLINED',
          resource: 'Membership',
          resourceId: currentMembership?.id ?? null,
          previousState: currentMembership
            ? { tier: currentMembership.tier, status: currentMembership.status }
            : undefined,
          newState: {
            targetTier: input.targetTier,
            amount: price,
            transactionId: paymentResult.transactionId,
            failureReason: paymentResult.failureReason,
          },
          reason: paymentResult.failureReason ?? 'Payment card was declined',
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
        },
      });

      return {
        success: true,
        paymentStatus: 'DECLINED',
        transactionId: paymentResult.transactionId,
        failureReason:
          paymentResult.failureReason ?? 'Payment card was declined by the issuing bank.',
        membership: currentMembership
          ? {
              id: currentMembership.id,
              tier: currentMembership.tier,
              status: currentMembership.status,
              startDate: currentMembership.startDate,
              endDate: currentMembership.endDate,
              price: Number(currentMembership.price),
            }
          : undefined,
        outstandingUpgradeAttempt: {
          targetTier: input.targetTier,
          state: 'declined',
          transactionRef: paymentResult.transactionId,
        },
        message:
          'Payment transaction was declined. Your active membership remains unchanged and unaffected.',
      };
    }

    if (paymentResult.status === 'PENDING') {
      // Pending outcome: Leave current membership untouched
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'MEMBER',
          action: 'PAYMENT_PENDING',
          resource: 'Membership',
          resourceId: currentMembership?.id ?? null,
          newState: {
            targetTier: input.targetTier,
            amount: price,
            transactionId: paymentResult.transactionId,
          },
          reason: 'Payment transaction pending verification',
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
        },
      });

      return {
        success: true,
        paymentStatus: 'PENDING',
        transactionId: paymentResult.transactionId,
        membership: currentMembership
          ? {
              id: currentMembership.id,
              tier: currentMembership.tier,
              status: currentMembership.status,
              startDate: currentMembership.startDate,
              endDate: currentMembership.endDate,
              price: Number(currentMembership.price),
            }
          : undefined,
        outstandingUpgradeAttempt: {
          targetTier: input.targetTier,
          state: 'pending',
          transactionRef: paymentResult.transactionId,
        },
        message:
          'Payment is pending. Your current membership benefits remain active and unchanged.',
      };
    }

    // 6. Successful outcome: Transition tier, extend 1 year, record COMPLETED (PAY-08)
    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    const updatedMembership = await this.prisma.$transaction(async (tx) => {
      let mRecord;
      if (currentMembership) {
        mRecord = await tx.membership.update({
          where: { id: currentMembership.id },
          data: {
            tier: input.targetTier,
            status: MembershipStatus.ACTIVE,
            price,
            startDate: now,
            endDate: oneYearLater,
          },
        });
      } else {
        mRecord = await tx.membership.create({
          data: {
            memberId: member.id,
            tier: input.targetTier,
            status: MembershipStatus.ACTIVE,
            price,
            startDate: now,
            endDate: oneYearLater,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: 'MEMBER',
          action: 'MEMBERSHIP_UPGRADED',
          resource: 'Membership',
          resourceId: mRecord.id,
          previousState: currentMembership
            ? {
                tier: currentMembership.tier,
                status: currentMembership.status,
                price: Number(currentMembership.price),
              }
            : undefined,
          newState: {
            tier: mRecord.tier,
            status: mRecord.status,
            price: Number(mRecord.price),
            transactionId: paymentResult.transactionId,
          },
          reason: `Upgraded to ${input.targetTier} membership via sandbox payment`,
          ipAddress: meta.ipAddress,
          requestId: meta.requestId,
        },
      });

      return mRecord;
    });

    return {
      success: true,
      paymentStatus: 'SUCCESSFUL',
      transactionId: paymentResult.transactionId,
      membership: {
        id: updatedMembership.id,
        tier: updatedMembership.tier,
        status: updatedMembership.status,
        startDate: updatedMembership.startDate,
        endDate: updatedMembership.endDate,
        price: Number(updatedMembership.price),
      },
      message: `Successfully upgraded to ${input.targetTier} membership.`,
    };
  }
}
