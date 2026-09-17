import { PrismaClient, MembershipTier, MembershipStatus } from '@prisma/client';
import { GetMembershipTiersUseCase } from '../../../../src/modules/membership/application/get-membership-tiers.usecase';
import { CORE_HUB_SERVICES } from '../../../../src/modules/membership/domain';

describe('GetMembershipTiersUseCase Unit Tests', () => {
  let mockPrisma: {
    membership: {
      findFirst: jest.Mock;
    };
  };
  let useCase: GetMembershipTiersUseCase;

  beforeEach(() => {
    mockPrisma = {
      membership: {
        findFirst: jest.fn(),
      },
    };
    useCase = new GetMembershipTiersUseCase(mockPrisma as unknown as PrismaClient);
  });

  describe('Unauthenticated / Guest Requests', () => {
    it('should return all 3 tiers with exact fees and discounts, with isCurrentPlan: false and canUpgrade: false', async () => {
      const tiers = await useCase.execute();

      expect(mockPrisma.membership.findFirst).not.toHaveBeenCalled();
      expect(tiers).toHaveLength(3);

      const [essential, professional, master] = tiers;

      // Essential Tier verification
      expect(essential).toMatchObject({
        tier: MembershipTier.ESSENTIAL,
        name: 'Essential',
        annualFee: 0,
        currency: 'USD',
        discountRate: 15,
        coreHubServicesIncluded: false,
        accreditedProgrammes: 0,
        freeTraineeCertificates: 0,
        freeQuarterlyTools: 0,
        trainerCertificationEligible: false,
        isCurrentPlan: false,
        canUpgrade: false,
      });

      // Professional Tier verification
      expect(professional).toMatchObject({
        tier: MembershipTier.PROFESSIONAL,
        name: 'Professional',
        annualFee: 180,
        currency: 'USD',
        discountRate: 30,
        coreHubServicesIncluded: false,
        accreditedProgrammes: 1,
        freeTraineeCertificates: 20,
        freeQuarterlyTools: 0,
        trainerCertificationEligible: false,
        isCurrentPlan: false,
        canUpgrade: false,
      });

      // Master Tier verification
      expect(master).toMatchObject({
        tier: MembershipTier.MASTER,
        name: 'Master',
        annualFee: 380,
        currency: 'USD',
        discountRate: 40,
        coreHubServicesIncluded: true,
        accreditedProgrammes: 2,
        freeTraineeCertificates: 40,
        freeQuarterlyTools: 4,
        trainerCertificationEligible: true,
        isCurrentPlan: false,
        canUpgrade: false,
      });

      // Verify all 12 Core Hub Services are included
      expect(essential?.coreHubServices).toHaveLength(12);
      expect(essential?.coreHubServices).toEqual(CORE_HUB_SERVICES);
      expect(professional?.coreHubServices).toEqual(CORE_HUB_SERVICES);
      expect(master?.coreHubServices).toEqual(CORE_HUB_SERVICES);
    });
  });

  describe('Authenticated Session Requests', () => {
    it('should correctly flag isCurrentPlan and canUpgrade when caller is an active ESSENTIAL member', async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({
        tier: MembershipTier.ESSENTIAL,
      });

      const tiers = await useCase.execute('user-123');

      expect(mockPrisma.membership.findFirst).toHaveBeenCalledWith({
        where: {
          member: { userId: 'user-123' },
          status: MembershipStatus.ACTIVE,
        },
        orderBy: { createdAt: 'desc' },
        select: { tier: true },
      });

      const [essential, professional, master] = tiers;

      expect(essential?.isCurrentPlan).toBe(true);
      expect(essential?.canUpgrade).toBe(false);

      expect(professional?.isCurrentPlan).toBe(false);
      expect(professional?.canUpgrade).toBe(true);

      expect(master?.isCurrentPlan).toBe(false);
      expect(master?.canUpgrade).toBe(true);
    });

    it('should correctly flag isCurrentPlan and canUpgrade when caller is an active PROFESSIONAL member', async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({
        tier: MembershipTier.PROFESSIONAL,
      });

      const tiers = await useCase.execute('user-456');

      const [essential, professional, master] = tiers;

      expect(essential?.isCurrentPlan).toBe(false);
      expect(essential?.canUpgrade).toBe(false);

      expect(professional?.isCurrentPlan).toBe(true);
      expect(professional?.canUpgrade).toBe(false);

      expect(master?.isCurrentPlan).toBe(false);
      expect(master?.canUpgrade).toBe(true);
    });

    it('should correctly flag isCurrentPlan and canUpgrade when caller is an active MASTER member (highest tier)', async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({
        tier: MembershipTier.MASTER,
      });

      const tiers = await useCase.execute('user-789');

      const [essential, professional, master] = tiers;

      expect(essential?.isCurrentPlan).toBe(false);
      expect(essential?.canUpgrade).toBe(false);

      expect(professional?.isCurrentPlan).toBe(false);
      expect(professional?.canUpgrade).toBe(false);

      expect(master?.isCurrentPlan).toBe(true);
      expect(master?.canUpgrade).toBe(false);
    });

    it('should set isCurrentPlan: false and canUpgrade: false if member has no active membership record', async () => {
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      const tiers = await useCase.execute('user-no-membership');

      for (const item of tiers) {
        expect(item.isCurrentPlan).toBe(false);
        expect(item.canUpgrade).toBe(false);
      }
    });
  });
});
