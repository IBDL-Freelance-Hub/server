export interface MemberProfileInput {
  fullNameEn?: string | null;
  fullNameAr?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  yearsOfExperience?: string | null;
  areasOfExpertise?: string[] | null;
  industriesServed?: string[] | null;
  languages?: string[] | null;
  bioEn?: string | null;
  bioAr?: string | null;
  cvFileId?: string | null;
  hasCv?: boolean | null;
  // Expressly not counted in percentage calculation per PRO-13d
  photoFileId?: string | null;
  linkedinUrl?: string | null;
}

export interface ProfileCompletionResult {
  completionPercentage: number;
  missingItems: string[];
}

const TOTAL_CANONICAL_FIELDS = 11;

export function calculateProfileCompletion(input: MemberProfileInput): ProfileCompletionResult {
  const missingItems: string[] = [];

  // 1. Full Name (populated in at least one language)
  const hasFullName = Boolean(input.fullNameEn?.trim()) || Boolean(input.fullNameAr?.trim());
  if (!hasFullName) {
    missingItems.push('fullName');
  }

  // 2. Email Address (always populated)
  const hasEmail = Boolean(input.email?.trim());
  if (!hasEmail) {
    missingItems.push('email');
  }

  // 3. Mobile Number (populated)
  const hasPhone = Boolean(input.phone?.trim());
  if (!hasPhone) {
    missingItems.push('phone');
  }

  // 4. Country (selected)
  const hasCountry = Boolean(input.country?.trim());
  if (!hasCountry) {
    missingItems.push('country');
  }

  // 5. City (non-empty)
  const hasCity = Boolean(input.city?.trim());
  if (!hasCity) {
    missingItems.push('city');
  }

  // 6. Years of Experience (band selected)
  const hasYearsOfExperience = Boolean(input.yearsOfExperience?.trim());
  if (!hasYearsOfExperience) {
    missingItems.push('yearsOfExperience');
  }

  // 7. Areas of Expertise (at least one)
  const hasAreasOfExpertise =
    Array.isArray(input.areasOfExpertise) && input.areasOfExpertise.length > 0;
  if (!hasAreasOfExpertise) {
    missingItems.push('areasOfExpertise');
  }

  // 8. Industries Served (at least one)
  const hasIndustriesServed =
    Array.isArray(input.industriesServed) && input.industriesServed.length > 0;
  if (!hasIndustriesServed) {
    missingItems.push('industriesServed');
  }

  // 9. Languages (at least one)
  const hasLanguages = Array.isArray(input.languages) && input.languages.length > 0;
  if (!hasLanguages) {
    missingItems.push('languages');
  }

  // 10. Professional Biography (non-empty in at least one language)
  const hasBio = Boolean(input.bioEn?.trim()) || Boolean(input.bioAr?.trim());
  if (!hasBio) {
    missingItems.push('bio');
  }

  // 11. Curriculum Vitae (CV document referenced on record)
  const hasCv = Boolean(input.hasCv) || Boolean(input.cvFileId?.trim());
  if (!hasCv) {
    missingItems.push('cv');
  }

  const populatedCount = TOTAL_CANONICAL_FIELDS - missingItems.length;
  const completionPercentage = Math.round((populatedCount / TOTAL_CANONICAL_FIELDS) * 100);

  return {
    completionPercentage,
    missingItems,
  };
}
