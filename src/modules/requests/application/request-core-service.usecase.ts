import { PrismaClient, EngagementRequestStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { SubmitUnifiedRequestUseCase } from './submit-unified-request.usecase';

export interface RequestCoreServiceInput {
  customRequirements?: string;
  intakeData?: Record<string, unknown>;
}

export interface RequestCoreServiceResult {
  id: string;
  referenceCode: string;
  serviceName: string;
  slug: string;
  status: EngagementRequestStatus;
  basePrice: number;
  discountPercentage: number;
  finalPrice: number;
  currency: string;
  isIncludedWithPlan: boolean;
  message: string;
  createdAt: string;
}

/**
 * Thin application wrapper delegating to SubmitUnifiedRequestUseCase.
 */
export class RequestCoreServiceUseCase {
  private readonly unifiedUseCase: SubmitUnifiedRequestUseCase;

  constructor(private readonly prisma: PrismaClient = defaultPrisma) {
    this.unifiedUseCase = new SubmitUnifiedRequestUseCase(this.prisma);
  }

  async execute(
    userId: string,
    slug: string,
    input: RequestCoreServiceInput,
    meta: { ipAddress?: string; requestId?: string },
  ): Promise<RequestCoreServiceResult> {
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
      serviceName: result.itemName,
      slug: result.itemSlug,
      status: result.status,
      basePrice: result.basePrice,
      discountPercentage: result.discountPercentage,
      finalPrice: result.finalPrice,
      currency: result.currency,
      isIncludedWithPlan: result.isIncludedWithPlan,
      message: result.message,
      createdAt: result.createdAt,
    };
  }
}
