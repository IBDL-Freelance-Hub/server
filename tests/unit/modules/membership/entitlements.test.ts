import { MembershipTier, MembershipStatus, UserStatus } from '@prisma/client';
import {
  calculateDirectoryEligibility,
  calculateEntitlements,
  DIRECTORY_COMPLETION_THRESHOLD,
} from '../../../../src/modules/membership/domain';

describe('Entitlement Engine & Directory Eligibility (SEC-33, MEM-01 to MEM-06, DIR-02, VAL-58)', () => {
  describe('Directory Eligibility Engine (DIR-02, VAL-58)', () => {
    it('should evaluate isEligible: true only when all 4 conditions are simultaneously met', () => {
      const result = calculateDirectoryEligibility({
        directoryOptIn: true,
        profileCompletionRate: 100,
        userStatus: UserStatus.ACTIVE,
        membershipStatus: MembershipStatus.ACTIVE,
      });

      expect(result.isEligible).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.criteria.hasMetCompletionThreshold).toBe(true);
      expect(result.criteria.isUserActive).toBe(true);
      expect(result.criteria.isMembershipActive).toBe(true);
    });

    it('should evaluate isEligible: true when profile completion exceeds threshold (e.g. 100%)', () => {
      const result = calculateDirectoryEligibility({
        directoryOptIn: true,
        profileCompletionRate: 100,
        userStatus: UserStatus.ACTIVE,
        membershipStatus: MembershipStatus.ACTIVE,
      });

      expect(result.isEligible).toBe(true);
    });

    it('should evaluate isEligible: false when directoryOptIn is false', () => {
      const result = calculateDirectoryEligibility({
        directoryOptIn: false,
        profileCompletionRate: 90,
        userStatus: UserStatus.ACTIVE,
        membershipStatus: MembershipStatus.ACTIVE,
      });

      expect(result.isEligible).toBe(false);
      expect(result.reasons).toContain('Directory opt-in is disabled');
    });

    it('should evaluate isEligible: false when profile completion is below threshold (99%)', () => {
      const result = calculateDirectoryEligibility({
        directoryOptIn: true,
        profileCompletionRate: 99,
        userStatus: UserStatus.ACTIVE,
        membershipStatus: MembershipStatus.ACTIVE,
      });

      expect(result.isEligible).toBe(false);
      expect(result.criteria.hasMetCompletionThreshold).toBe(false);
      expect(result.reasons.some((r) => r.includes('below required threshold'))).toBe(true);
    });

    it('should evaluate isEligible: false when userStatus is not ACTIVE', () => {
      const result = calculateDirectoryEligibility({
        directoryOptIn: true,
        profileCompletionRate: 95,
        userStatus: UserStatus.SUSPENDED,
        membershipStatus: MembershipStatus.ACTIVE,
      });

      expect(result.isEligible).toBe(false);
      expect(result.criteria.isUserActive).toBe(false);
      expect(result.reasons.some((r) => r.includes('must be ACTIVE'))).toBe(true);
    });

    it('should evaluate isEligible: false when membershipStatus is not ACTIVE (e.g. EXPIRED)', () => {
      const result = calculateDirectoryEligibility({
        directoryOptIn: true,
        profileCompletionRate: 95,
        userStatus: UserStatus.ACTIVE,
        membershipStatus: MembershipStatus.EXPIRED,
      });

      expect(result.isEligible).toBe(false);
      expect(result.criteria.isMembershipActive).toBe(false);
      expect(result.reasons.some((r) => r.includes('must be ACTIVE'))).toBe(true);
    });

    it('should accumulate multiple failure reasons if multiple conditions fail', () => {
      const result = calculateDirectoryEligibility({
        directoryOptIn: false,
        profileCompletionRate: 50,
        userStatus: UserStatus.UNACTIVATED,
        membershipStatus: MembershipStatus.PENDING_PAYMENT,
      });

      expect(result.isEligible).toBe(false);
      expect(result.reasons).toHaveLength(4);
    });

    it('should use default completion threshold of 100%', () => {
      expect(DIRECTORY_COMPLETION_THRESHOLD).toBe(100);
    });
  });

  describe('Tier Benefits & Entitlements Engine (SEC-33, MEM-01 to MEM-06)', () => {
    const eligibleStatus = calculateDirectoryEligibility({
      directoryOptIn: true,
      profileCompletionRate: 100,
      userStatus: UserStatus.ACTIVE,
      membershipStatus: MembershipStatus.ACTIVE,
    });

    const ineligibleStatus = calculateDirectoryEligibility({
      directoryOptIn: false,
      profileCompletionRate: 60,
      userStatus: UserStatus.ACTIVE,
      membershipStatus: MembershipStatus.ACTIVE,
    });

    describe('ESSENTIAL Tier (MEM-01 to MEM-02)', () => {
      it('should compute Essential benefits with 15% discount, specimen demo, and basic listing', () => {
        const entitlements = calculateEntitlements(
          MembershipTier.ESSENTIAL,
          MembershipStatus.ACTIVE,
          eligibleStatus,
        );

        expect(entitlements.tier).toBe(MembershipTier.ESSENTIAL);
        expect(entitlements.tierName).toBe('Essential');
        expect(entitlements.isActive).toBe(true);
        expect(entitlements.benefits.discounts.platformDiscountPercentage).toBe(15);
        expect(entitlements.benefits.discounts.conciergeReviewAssistance).toBe(false);
        expect(entitlements.benefits.assessmentAccess.type).toBe('SPECIMEN_DEMO');
        expect(entitlements.benefits.assessmentAccess.discountedRetakes).toBe(false);
        expect(entitlements.benefits.assessmentAccess.benchmarkReporting).toBe(false);
        expect(
          entitlements.benefits.accreditationsAndCertificates.programmeAccreditationsIncluded,
        ).toBe(0);
        expect(entitlements.benefits.accreditationsAndCertificates.freeTraineeCertificates).toBe(0);
        expect(entitlements.benefits.directoryVisibility.badge).toBe('NONE');
        expect(entitlements.benefits.directoryVisibility.prioritySearchWeight).toBe(1);
        expect(entitlements.benefits.directoryVisibility.listingType).toBe('BASIC');
      });

      it('should set directory listingType to NONE when directory eligibility is false', () => {
        const entitlements = calculateEntitlements(
          MembershipTier.ESSENTIAL,
          MembershipStatus.ACTIVE,
          ineligibleStatus,
        );

        expect(entitlements.benefits.directoryVisibility.listingType).toBe('NONE');
      });
    });

    describe('PROFESSIONAL Tier (MEM-03 to MEM-04)', () => {
      it('should compute Professional benefits with 30% discount, 1 accreditation, 20 certificates, verified badge, and priority listing', () => {
        const entitlements = calculateEntitlements(
          MembershipTier.PROFESSIONAL,
          MembershipStatus.ACTIVE,
          eligibleStatus,
        );

        expect(entitlements.tier).toBe(MembershipTier.PROFESSIONAL);
        expect(entitlements.tierName).toBe('Professional');
        expect(entitlements.isActive).toBe(true);
        expect(entitlements.benefits.discounts.platformDiscountPercentage).toBe(30);
        expect(entitlements.benefits.discounts.conciergeReviewAssistance).toBe(false);
        expect(entitlements.benefits.assessmentAccess.type).toBe('SINGLE_COMPLIMENTARY');
        expect(entitlements.benefits.assessmentAccess.discountedRetakes).toBe(true);
        expect(entitlements.benefits.assessmentAccess.benchmarkReporting).toBe(false);
        expect(
          entitlements.benefits.accreditationsAndCertificates.programmeAccreditationsIncluded,
        ).toBe(1);
        expect(entitlements.benefits.accreditationsAndCertificates.freeTraineeCertificates).toBe(
          20,
        );
        expect(entitlements.benefits.directoryVisibility.badge).toBe('VERIFIED_PROFESSIONAL');
        expect(entitlements.benefits.directoryVisibility.featuredListing).toBe(false);
        expect(entitlements.benefits.directoryVisibility.prioritySearchWeight).toBe(2);
        expect(entitlements.benefits.directoryVisibility.listingType).toBe('PRIORITY');
      });

      it('should set listingType to NONE if directory eligibility is false', () => {
        const entitlements = calculateEntitlements(
          MembershipTier.PROFESSIONAL,
          MembershipStatus.ACTIVE,
          ineligibleStatus,
        );

        expect(entitlements.benefits.directoryVisibility.listingType).toBe('NONE');
      });
    });

    describe('MASTER Tier (MEM-05 to MEM-06)', () => {
      it('should compute Master benefits with 40% discount, 2 accreditations, 40 certificates, 4 quarterly tools, master badge, and featured listing', () => {
        const entitlements = calculateEntitlements(
          MembershipTier.MASTER,
          MembershipStatus.ACTIVE,
          eligibleStatus,
        );

        expect(entitlements.tier).toBe(MembershipTier.MASTER);
        expect(entitlements.tierName).toBe('Master');
        expect(entitlements.isActive).toBe(true);
        expect(entitlements.benefits.discounts.platformDiscountPercentage).toBe(40);
        expect(entitlements.benefits.discounts.conciergeReviewAssistance).toBe(true);
        expect(entitlements.benefits.discounts.allCoreHubServicesIncluded).toBe(true);
        expect(entitlements.benefits.assessmentAccess.type).toBe('UNRESTRICTED_SUITE');
        expect(entitlements.benefits.assessmentAccess.discountedRetakes).toBe(true);
        expect(entitlements.benefits.assessmentAccess.benchmarkReporting).toBe(true);
        expect(
          entitlements.benefits.accreditationsAndCertificates.programmeAccreditationsIncluded,
        ).toBe(2);
        expect(entitlements.benefits.accreditationsAndCertificates.freeTraineeCertificates).toBe(
          40,
        );
        expect(entitlements.benefits.accreditationsAndCertificates.quarterlyFreeTools).toBe(4);
        expect(entitlements.benefits.directoryVisibility.badge).toBe('MASTER');
        expect(entitlements.benefits.directoryVisibility.featuredListing).toBe(true);
        expect(entitlements.benefits.directoryVisibility.prioritySearchWeight).toBe(3);
        expect(entitlements.benefits.directoryVisibility.listingType).toBe('FEATURED');
      });
    });

    describe('Inactive Membership Status (SEC-33)', () => {
      it.each([
        MembershipStatus.EXPIRED,
        MembershipStatus.SUSPENDED,
        MembershipStatus.CANCELLED,
        MembershipStatus.PENDING_PAYMENT,
      ])('should suspend tier benefits when status is %s', (inactiveStatus) => {
        const inactiveEligibility = calculateDirectoryEligibility({
          directoryOptIn: true,
          profileCompletionRate: 90,
          userStatus: UserStatus.ACTIVE,
          membershipStatus: inactiveStatus,
        });

        const entitlements = calculateEntitlements(
          MembershipTier.MASTER,
          inactiveStatus,
          inactiveEligibility,
        );

        expect(entitlements.isActive).toBe(false);
        expect(entitlements.status).toBe(inactiveStatus);
        expect(entitlements.benefits.discounts.platformDiscountPercentage).toBe(0);
        expect(entitlements.benefits.discounts.conciergeReviewAssistance).toBe(false);
        expect(entitlements.benefits.assessmentAccess.type).toBe('RESTRICTED');
        expect(entitlements.benefits.directoryVisibility.badge).toBe('NONE');
        expect(entitlements.benefits.directoryVisibility.listingType).toBe('NONE');
        expect(entitlements.directoryEligibility.isEligible).toBe(false);
      });
    });
  });
});
