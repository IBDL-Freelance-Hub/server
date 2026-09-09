import {
  calculateProfileCompletion,
  MemberProfileInput,
} from '../../../../src/modules/members/domain/profile-completion';

describe('Profile Completion Engine Unit Tests', () => {
  const completeProfile: Required<MemberProfileInput> = {
    fullNameEn: 'Ahmed Hassan',
    fullNameAr: 'أحمد حسن',
    email: 'ahmed.hassan@example.com',
    phone: '+201012345678',
    country: 'Egypt',
    city: 'Cairo',
    yearsOfExperience: '5-10',
    areasOfExpertise: ['Software Engineering', 'Project Management'],
    industriesServed: ['Financial Services', 'Technology'],
    languages: ['Arabic', 'English'],
    bioEn: 'Senior software consultant with 8 years of experience.',
    bioAr: 'استشاري برمجيات خبير.',
    cvFileId: 'file-uuid-12345',
    hasCv: true,
    photoFileId: 'photo-uuid-67890',
    linkedinUrl: 'https://linkedin.com/in/ahmedhassan',
  };

  it('should return 100% completion when all 11 canonical fields are populated', () => {
    const result = calculateProfileCompletion(completeProfile);

    expect(result.completionPercentage).toBe(100);
    expect(result.missingItems).toHaveLength(0);
  });

  it('should return 0% completion when all fields are empty', () => {
    const emptyInput: MemberProfileInput = {
      fullNameEn: '',
      fullNameAr: '   ',
      email: null,
      phone: '',
      country: null,
      city: '',
      yearsOfExperience: '',
      areasOfExpertise: [],
      industriesServed: [],
      languages: [],
      bioEn: '',
      bioAr: '',
      cvFileId: null,
      hasCv: false,
    };

    const result = calculateProfileCompletion(emptyInput);

    expect(result.completionPercentage).toBe(0);
    expect(result.missingItems).toHaveLength(11);
    expect(result.missingItems).toEqual([
      'fullName',
      'email',
      'phone',
      'country',
      'city',
      'yearsOfExperience',
      'areasOfExpertise',
      'industriesServed',
      'languages',
      'bio',
      'cv',
    ]);
  });

  it('should return partial completion percentage and accurate missing items', () => {
    // 5 out of 11 populated fields -> Math.round((5/11)*100) = 45%
    const partialInput: MemberProfileInput = {
      fullNameEn: 'Sarah Al-Otaibi',
      email: 'sarah@example.sa',
      phone: '+966501234567',
      country: 'Saudi Arabia',
      city: 'Riyadh',
      yearsOfExperience: '',
      areasOfExpertise: [],
      industriesServed: [],
      languages: [],
      bioEn: '',
      bioAr: '',
      cvFileId: null,
      hasCv: false,
    };

    const result = calculateProfileCompletion(partialInput);

    expect(result.completionPercentage).toBe(45);
    expect(result.missingItems).toEqual([
      'yearsOfExperience',
      'areasOfExpertise',
      'industriesServed',
      'languages',
      'bio',
      'cv',
    ]);
  });

  it('should count fullName as populated if fullNameAr is provided without fullNameEn', () => {
    const arabicOnlyNameInput: MemberProfileInput = {
      ...completeProfile,
      fullNameEn: '',
      fullNameAr: 'أحمد حسن',
    };

    const result = calculateProfileCompletion(arabicOnlyNameInput);

    expect(result.completionPercentage).toBe(100);
    expect(result.missingItems).not.toContain('fullName');
  });

  it('should count bio as populated if bioAr is provided without bioEn', () => {
    const arabicOnlyBioInput: MemberProfileInput = {
      ...completeProfile,
      bioEn: '',
      bioAr: 'نبذة شخصية باللغة العربية',
    };

    const result = calculateProfileCompletion(arabicOnlyBioInput);

    expect(result.completionPercentage).toBe(100);
    expect(result.missingItems).not.toContain('bio');
  });

  it('should count cv as populated if hasCv is true even without cvFileId string', () => {
    const hasCvFlagInput: MemberProfileInput = {
      ...completeProfile,
      cvFileId: null,
      hasCv: true,
    };

    const result = calculateProfileCompletion(hasCvFlagInput);

    expect(result.completionPercentage).toBe(100);
    expect(result.missingItems).not.toContain('cv');
  });

  it('should NEVER count photoFileId or linkedinUrl toward completion percentage (PRO-13d)', () => {
    // 10 out of 11 populated fields (missing CV) -> Math.round((10/11)*100) = 91%
    const baseWithoutCv: MemberProfileInput = {
      ...completeProfile,
      cvFileId: null,
      hasCv: false,
      photoFileId: null,
      linkedinUrl: null,
    };

    const resultWithoutPhotoOrLinkedin = calculateProfileCompletion(baseWithoutCv);

    // Now populate photo and linkedin
    const withPhotoAndLinkedin: MemberProfileInput = {
      ...baseWithoutCv,
      photoFileId: 'photo-123',
      linkedinUrl: 'https://linkedin.com/in/test',
    };

    const resultWithPhotoAndLinkedin = calculateProfileCompletion(withPhotoAndLinkedin);

    // Percentage must remain identical (91%)
    expect(resultWithoutPhotoOrLinkedin.completionPercentage).toBe(91);
    expect(resultWithPhotoAndLinkedin.completionPercentage).toBe(91);
    expect(resultWithPhotoAndLinkedin.missingItems).toEqual(['cv']);
    expect(resultWithPhotoAndLinkedin.missingItems).not.toContain('photo');
    expect(resultWithPhotoAndLinkedin.missingItems).not.toContain('linkedinUrl');
  });
});
