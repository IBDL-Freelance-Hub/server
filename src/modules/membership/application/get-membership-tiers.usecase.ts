import { PrismaClient, MembershipTier, MembershipStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { CORE_HUB_SERVICES, TIER_CATALOG_METADATA, isValidUpgrade } from '../domain';

export interface MembershipTierCatalogItem {
  tier: 'ESSENTIAL' | 'PROFESSIONAL' | 'MASTER';
  name: string;
  tagline: string;
  annualFee: number;
  currency: 'USD';
  discountRate: number;
  coreHubServicesIncluded: boolean;
  accreditedProgrammes: number;
  freeTraineeCertificates: number;
  freeQuarterlyTools: number;
  trainerCertificationEligible: boolean;
  coreHubServices: string[];
  isCurrentPlan: boolean;
  canUpgrade: boolean;
}

/**
 * Builds the authoritative membership tiers catalog for comparison (SCR-68)
 * and upgrade flows (SCR-70), strictly deriving commercial data from domain sources
 * of truth (SEC-33).
 */
export class GetMembershipTiersUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(userId?: string): Promise<MembershipTierCatalogItem[]> {
    let activeTier: MembershipTier | null = null;

    if (userId) {
      const activeMembership = await this.prisma.membership.findFirst({
        where: {
          member: { userId },
          status: MembershipStatus.ACTIVE,
        },
        orderBy: { createdAt: 'desc' },
        select: { tier: true },
      });

      if (activeMembership) {
        activeTier = activeMembership.tier;
      }
    }

    const orderedTiers: MembershipTier[] = [
      MembershipTier.ESSENTIAL,
      MembershipTier.PROFESSIONAL,
      MembershipTier.MASTER,
    ];

    return orderedTiers.map((tier) => {
      const meta = TIER_CATALOG_METADATA[tier];
      const isCurrentPlan = activeTier !== null && activeTier === tier;
      const canUpgrade = activeTier !== null && isValidUpgrade(activeTier, tier);

      return {
        tier: meta.tier,
        name: meta.name,
        tagline: meta.tagline,
        annualFee: meta.annualFee,
        currency: meta.currency,
        discountRate: meta.discountRate,
        coreHubServicesIncluded: meta.coreHubServicesIncluded,
        accreditedProgrammes: meta.accreditedProgrammes,
        freeTraineeCertificates: meta.freeTraineeCertificates,
        freeQuarterlyTools: meta.freeQuarterlyTools,
        trainerCertificationEligible: meta.trainerCertificationEligible,
        coreHubServices: [...CORE_HUB_SERVICES],
        isCurrentPlan,
        canUpgrade,
      };
    });
  }
}
