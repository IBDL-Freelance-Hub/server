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

export function getTierDisplayName(tier: MembershipTier): string {
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

/**
 * The 12 Canonical Core Hub Services offered by IBDL Freelancer Hub (Spec v5.0, SCR-68).
 */
export const CORE_HUB_SERVICES: readonly string[] = [
  'Training Needs Analysis (TNA) Assistance',
  'Program Mapping & Learning Architecture',
  'Proposal Building & Commercial Solution Support',
  'Content Design & Development',
  'Training Mode & Strategy Selection',
  'Training ROI & Impact Measurement Toolkit',
  'Trainer Help Desk & Expert Support',
  'Professional Profile, Visibility & Opportunity Showcase',
  'Business Networking & Collaboration',
  'Accreditation & Professional Recognition Pathway',
  'Templates, Tools & Resource Library',
  'Continuous Professional Development & Market Insights',
] as const;

export interface TierCatalogDescriptor {
  tier: MembershipTier;
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
}

export const TIER_CATALOG_METADATA: Record<MembershipTier, TierCatalogDescriptor> = {
  [MembershipTier.ESSENTIAL]: {
    tier: MembershipTier.ESSENTIAL,
    name: 'Essential',
    tagline: 'Free permanently. Upgrade only when your practice is ready.',
    annualFee: 0,
    currency: 'USD',
    discountRate: 15,
    coreHubServicesIncluded: false,
    accreditedProgrammes: 0,
    freeTraineeCertificates: 0,
    freeQuarterlyTools: 0,
    trainerCertificationEligible: false,
  },
  [MembershipTier.PROFESSIONAL]: {
    tier: MembershipTier.PROFESSIONAL,
    name: 'Professional',
    tagline: 'The Hub working alongside your practice, at the member rate.',
    annualFee: 180,
    currency: 'USD',
    discountRate: 30,
    coreHubServicesIncluded: false,
    accreditedProgrammes: 1,
    freeTraineeCertificates: 20,
    freeQuarterlyTools: 0,
    trainerCertificationEligible: false,
  },
  [MembershipTier.MASTER]: {
    tier: MembershipTier.MASTER,
    name: 'Master',
    tagline: 'Every Core Hub Service included, plus the pathways to IBDL recognition.',
    annualFee: 380,
    currency: 'USD',
    discountRate: 40,
    coreHubServicesIncluded: true,
    accreditedProgrammes: 2,
    freeTraineeCertificates: 40,
    freeQuarterlyTools: 4,
    trainerCertificationEligible: true,
  },
};
