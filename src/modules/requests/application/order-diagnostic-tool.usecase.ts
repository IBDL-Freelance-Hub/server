import { PrismaClient, EngagementRequestStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { SubmitUnifiedRequestUseCase } from './submit-unified-request.usecase';

export interface OrderDiagnosticToolInput {
  customRequirements?: string;
  intakeData?: {
    targetOrganization?: string;
    participantCount?: number;
    assessmentEmail?: string;
    [key: string]: unknown;
  };
}

export interface OrderDiagnosticToolResult {
  id: string;
  referenceCode: string;
  toolName: string;
  slug: string;
  status: EngagementRequestStatus;
  basePrice: number;
  discountPercentage: number;
  finalPrice: number;
  currency: string;
  isQuarterlyEntitlementApplied: boolean;
  isFirstUseFreeApplied?: boolean;
  quarterIndex?: number;
  membershipYear?: number;
  message: string;
  createdAt: string;
}

/**
 * Thin application wrapper delegating to SubmitUnifiedRequestUseCase.
 */
export class OrderDiagnosticToolUseCase {
  private readonly unifiedUseCase: SubmitUnifiedRequestUseCase;

  constructor(private readonly prisma: PrismaClient = defaultPrisma) {
    this.unifiedUseCase = new SubmitUnifiedRequestUseCase(this.prisma);
  }

  async execute(
    userId: string,
    slug: string,
    input: OrderDiagnosticToolInput,
    meta: { ipAddress?: string; requestId?: string },
  ): Promise<OrderDiagnosticToolResult> {
    const result = await this.unifiedUseCase.execute(
      userId,
      {
        itemSlug: slug,
        brief: input.intakeData,
        customRequirements: input.customRequirements,
        acknowledgement: true,
      },
      meta,
    );

    return {
      id: result.id,
      referenceCode: result.referenceCode,
      toolName: result.itemName,
      slug: result.itemSlug,
      status: result.status,
      basePrice: result.basePrice,
      discountPercentage: result.discountPercentage,
      finalPrice: result.finalPrice,
      currency: result.currency,
      isQuarterlyEntitlementApplied: result.isQuarterlyEntitlementApplied,
      isFirstUseFreeApplied: result.isFirstUseFreeApplied,
      quarterIndex: result.quarterIndex,
      membershipYear: result.membershipYear,
      message: result.message,
      createdAt: result.createdAt,
    };
  }
}
