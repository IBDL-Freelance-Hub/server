import { MembershipTier, MembershipStatus } from '@prisma/client';

export type BadgeType = 'PRIORITY' | 'FEATURED' | 'STANDARD';

export interface TierBadgeInfo {
  weight: number;
  badgeType: BadgeType;
}

/**
 * Summary object for public directory search & card listing (DIR-18, PRO-38).
 * Strictly omits private information (email, phone, cvUrl, files, internal metadata).
 */
export interface PublicTrainerListItem {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  titleEn: string | null;
  titleAr: string | null;
  bioEn: string | null;
  bioAr: string | null;
  photoUrl: string | null;
  country: string;
  city: string | null;
  areasOfExpertise: string[];
  industriesServed: string[];
  languages: string[];
  tier: MembershipTier;
  badgeType: BadgeType;
}

/**
 * Detailed object for the public trainer profile page (DIR-19, PRO-38).
 */
export interface PublicTrainerProfile extends PublicTrainerListItem {
  yearsOfExperience: string | null;
  linkedinUrl: string | null;
}

/**
 * Query parameters for searching and filtering the public directory.
 */
export interface DirectoryFilterCriteria {
  search?: string;
  expertise?: string | string[];
  industry?: string | string[];
  language?: string | string[];
  country?: string;
  city?: string;
  tier?: MembershipTier;
  page?: number;
  limit?: number;
}

/**
 * Paginated directory search result envelope.
 */
export interface DirectorySearchResult {
  trainers: PublicTrainerListItem[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Evaluates tier placement weight and public badge type (PRO-45, DIR-04).
 * - MASTER (Active): Priority placement (weight 3, 'PRIORITY')
 * - PROFESSIONAL (Active): Featured placement (weight 2, 'FEATURED')
 * - ESSENTIAL (Active) or GRACE/EXPIRED with retained opt-in (MEM-33b, MEM-81): Standard placement (weight 1, 'STANDARD')
 */
export function getTierBadgeAndWeight(
  tier: MembershipTier,
  status: MembershipStatus = MembershipStatus.ACTIVE,
): TierBadgeInfo {
  // If status is in grace period or expired, degrade to standard placement per PRO-45, MEM-33b, MEM-81
  if (status === MembershipStatus.GRACE_PERIOD || status === MembershipStatus.EXPIRED) {
    return {
      weight: 1,
      badgeType: 'STANDARD',
    };
  }

  switch (tier) {
    case MembershipTier.MASTER:
      return {
        weight: 3,
        badgeType: 'PRIORITY',
      };
    case MembershipTier.PROFESSIONAL:
      return {
        weight: 2,
        badgeType: 'FEATURED',
      };
    case MembershipTier.ESSENTIAL:
    default:
      return {
        weight: 1,
        badgeType: 'STANDARD',
      };
  }
}

/**
 * Generates a URL-safe slug from the trainer's English name or falls back to their ID.
 */
export function generateTrainerSlug(fullNameEn: string, id: string): string {
  const base = (fullNameEn || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const shortId = id ? id.replace(/-/g, '').slice(0, 8) : '';
  if (base && shortId) {
    return `${base}-${shortId}`;
  }
  return base || id;
}

/**
 * Parses firstName and lastName cleanly from bilingual member name records.
 */
export function parseTrainerName(member: { fullNameEn: string; fullNameAr?: string | null }): {
  firstName: string;
  lastName: string;
} {
  const nameToSplit = member.fullNameEn?.trim() || member.fullNameAr?.trim() || '';
  const parts = nameToSplit.split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  return { firstName, lastName };
}
