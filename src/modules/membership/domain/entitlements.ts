import { MembershipTier, MembershipStatus, UserStatus } from '@prisma/client';

export const DIRECTORY_COMPLETION_THRESHOLD = 80;

export interface TierBenefits {
  assessmentAccess: {
    type: 'SPECIMEN_DEMO' | 'SINGLE_COMPLIMENTARY' | 'UNRESTRICTED_SUITE' | 'RESTRICTED';
    description: string;
    discountedRetakes: boolean;
    benchmarkReporting: boolean;
  };
  directoryVisibility: {
    badge: 'NONE' | 'VERIFIED_PROFESSIONAL' | 'MASTER';
    featuredListing: boolean;
    prioritySearchWeight: number;
    listingType: 'NONE' | 'BASIC' | 'PRIORITY' | 'FEATURED';
  };
  discounts: {
    platformDiscountPercentage: number;
    conciergeReviewAssistance: boolean;
    allCoreHubServicesIncluded: boolean;
    description: string;
  };
  accreditationsAndCertificates: {
    programmeAccreditationsIncluded: number;
    freeTraineeCertificates: number;
    quarterlyFreeTools: number;
    description: string;
  };
}

export interface DirectoryEligibilityCriteria {
  directoryOptIn: boolean;
  profileCompletionRate: number;
  completionThreshold: number;
  hasMetCompletionThreshold: boolean;
  membershipStatus: MembershipStatus | null;
  userStatus: UserStatus;
  isMembershipActive: boolean;
  isUserActive: boolean;
}

export interface DirectoryEligibilityStatus {
  isEligible: boolean;
  reasons: string[];
  criteria: DirectoryEligibilityCriteria;
}

export interface DirectoryEligibilityInput {
  directoryOptIn: boolean;
  profileCompletionRate: number;
  userStatus: UserStatus;
  membershipStatus?: MembershipStatus | null;
  completionThreshold?: number;
}

export interface MemberEntitlements {
  tier: MembershipTier;
  tierName: string;
  status: MembershipStatus;
  isActive: boolean;
  benefits: TierBenefits;
  directoryEligibility: DirectoryEligibilityStatus;
}

/**
 * Evaluates whether a member is eligible for public directory listing.
 * Strict Rule (DIR-02, VAL-58): All 4 conditions must simultaneously evaluate to true:
 * 1. directoryOptIn === true
 * 2. profileCompletionRate >= completionThreshold (80%)
 * 3. userStatus === 'ACTIVE'
 * 4. membershipStatus === 'ACTIVE'
 */
export function calculateDirectoryEligibility(
  input: DirectoryEligibilityInput,
): DirectoryEligibilityStatus {
  const threshold = input.completionThreshold ?? DIRECTORY_COMPLETION_THRESHOLD;
  const reasons: string[] = [];

  const optInPassed = input.directoryOptIn === true;
  if (!optInPassed) {
    reasons.push('Directory opt-in is disabled');
  }

  const completionPassed = input.profileCompletionRate >= threshold;
  if (!completionPassed) {
    reasons.push(
      `Profile completion rate (${input.profileCompletionRate}%) is below required threshold (${threshold}%)`,
    );
  }

  const isUserActive = input.userStatus === UserStatus.ACTIVE;
  if (!isUserActive) {
    reasons.push(`User status is ${input.userStatus}, must be ACTIVE`);
  }

  const isMembershipActive = input.membershipStatus === MembershipStatus.ACTIVE;
  if (!isMembershipActive) {
    reasons.push(`Membership status is ${input.membershipStatus ?? 'NONE'}, must be ACTIVE`);
  }

  const isEligible = optInPassed && completionPassed && isUserActive && isMembershipActive;

  return {
    isEligible,
    reasons,
    criteria: {
      directoryOptIn: input.directoryOptIn,
      profileCompletionRate: input.profileCompletionRate,
      completionThreshold: threshold,
      hasMetCompletionThreshold: completionPassed,
      membershipStatus: input.membershipStatus ?? null,
      userStatus: input.userStatus,
      isMembershipActive,
      isUserActive,
    },
  };
}

/**
 * Computes tier benefits and entitlements strictly server-side (SEC-33, MEM-01 to MEM-06, Spec v5.0).
 */
export function calculateEntitlements(
  tier: MembershipTier,
  status: MembershipStatus,
  eligibility: DirectoryEligibilityStatus,
): MemberEntitlements {
  const isActive = status === MembershipStatus.ACTIVE;

  // Inactive membership baseline
  if (!isActive) {
    return {
      tier,
      tierName: getTierDisplayName(tier),
      status,
      isActive: false,
      benefits: {
        assessmentAccess: {
          type: 'RESTRICTED',
          description: 'Membership is inactive. Assessment access is restricted.',
          discountedRetakes: false,
          benchmarkReporting: false,
        },
        directoryVisibility: {
          badge: 'NONE',
          featuredListing: false,
          prioritySearchWeight: 0,
          listingType: 'NONE',
        },
        discounts: {
          platformDiscountPercentage: 0,
          conciergeReviewAssistance: false,
          allCoreHubServicesIncluded: false,
          description: 'No platform discounts available for inactive membership.',
        },
        accreditationsAndCertificates: {
          programmeAccreditationsIncluded: 0,
          freeTraineeCertificates: 0,
          quarterlyFreeTools: 0,
          description: 'None for inactive membership.',
        },
      },
      directoryEligibility: eligibility,
    };
  }

  // Active membership tier entitlements
  switch (tier) {
    case MembershipTier.MASTER:
      return {
        tier,
        tierName: 'Master',
        status,
        isActive: true,
        benefits: {
          assessmentAccess: {
            type: 'UNRESTRICTED_SUITE',
            description:
              'Unrestricted full diagnostic suite access + quarterly benchmark reporting.',
            discountedRetakes: true,
            benchmarkReporting: true,
          },
          directoryVisibility: {
            badge: 'MASTER',
            featuredListing: true,
            prioritySearchWeight: 3,
            listingType: eligibility.isEligible ? 'FEATURED' : 'NONE',
          },
          discounts: {
            platformDiscountPercentage: 40,
            conciergeReviewAssistance: true,
            allCoreHubServicesIncluded: true,
            description:
              '40% member rate on additional eligible purchases; all 12 Core Hub Services included at no additional cost.',
          },
          accreditationsAndCertificates: {
            programmeAccreditationsIncluded: 2,
            freeTraineeCertificates: 40,
            quarterlyFreeTools: 4,
            description:
              '2 programme accreditations included + 40 free trainee certificates + 1 eligible tool free per quarter (4/year).',
          },
        },
        directoryEligibility: eligibility,
      };

    case MembershipTier.PROFESSIONAL:
      return {
        tier,
        tierName: 'Professional',
        status,
        isActive: true,
        benefits: {
          assessmentAccess: {
            type: 'SINGLE_COMPLIMENTARY',
            description: 'Full single complimentary assessment attempt + discounted retakes.',
            discountedRetakes: true,
            benchmarkReporting: false,
          },
          directoryVisibility: {
            badge: 'VERIFIED_PROFESSIONAL',
            featuredListing: false,
            prioritySearchWeight: 2,
            listingType: eligibility.isEligible ? 'PRIORITY' : 'NONE',
          },
          discounts: {
            platformDiscountPercentage: 30,
            conciergeReviewAssistance: false,
            allCoreHubServicesIncluded: false,
            description: '30% member rate on eligible services, tools, and assessments.',
          },
          accreditationsAndCertificates: {
            programmeAccreditationsIncluded: 1,
            freeTraineeCertificates: 20,
            quarterlyFreeTools: 0,
            description: '1 programme accreditation included + 20 free trainee certificates.',
          },
        },
        directoryEligibility: eligibility,
      };

    case MembershipTier.ESSENTIAL:
    default:
      return {
        tier: MembershipTier.ESSENTIAL,
        tierName: 'Essential',
        status,
        isActive: true,
        benefits: {
          assessmentAccess: {
            type: 'SPECIMEN_DEMO',
            description: 'Single specimen demo access.',
            discountedRetakes: false,
            benchmarkReporting: false,
          },
          directoryVisibility: {
            badge: 'NONE',
            featuredListing: false,
            prioritySearchWeight: 1,
            listingType: eligibility.isEligible ? 'BASIC' : 'NONE',
          },
          discounts: {
            platformDiscountPercentage: 15,
            conciergeReviewAssistance: false,
            allCoreHubServicesIncluded: false,
            description: '15% member rate on eligible IBDL products/services.',
          },
          accreditationsAndCertificates: {
            programmeAccreditationsIncluded: 0,
            freeTraineeCertificates: 0,
            quarterlyFreeTools: 0,
            description: 'Standard pay-as-you-go rates for accreditations and certificates.',
          },
        },
        directoryEligibility: eligibility,
      };
  }
}

function getTierDisplayName(tier: MembershipTier): string {
  switch (tier) {
    case MembershipTier.MASTER:
      return 'Master';
    case MembershipTier.PROFESSIONAL:
      return 'Professional';
    case MembershipTier.ESSENTIAL:
    default:
      return 'Essential';
  }
}
