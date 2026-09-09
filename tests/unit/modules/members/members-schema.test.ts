import { registerMemberSchema } from '../../../../src/modules/members/presentation/members.schema';

describe('Member Registration Zod Schema Unit Tests', () => {
  const validPayload = {
    fullName: 'Mohamed Ali',
    email: '  MOHAMED.ALI@EXAMPLE.COM ',
    mobile: '+20 101 234 5678',
    country: 'Egypt',
    yearsOfExperience: '6-10' as const,
    termsAccepted: true as const,
  };

  it('should successfully parse and normalize a valid registration payload', () => {
    const result = registerMemberSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe('Mohamed Ali');
      expect(result.data.email).toBe('mohamed.ali@example.com');
      expect(result.data.mobile).toBe('+20 101 234 5678');
      expect(result.data.country).toBe('Egypt');
      expect(result.data.yearsOfExperience).toBe('6-10');
      expect(result.data.areasOfExpertise).toEqual([]);
      expect(result.data.industriesServed).toEqual([]);
      expect(result.data.directoryOptIn).toBe(false);
      expect(result.data.termsAccepted).toBe(true);
    }
  });

  it('should fail when termsAccepted is false', () => {
    const payload = {
      ...validPayload,
      termsAccepted: false,
    };

    const result = registerMemberSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'termsAccepted');
      expect(issue?.message).toBe('You must agree to the terms to complete registration.');
    }
  });

  it('should fail when termsAccepted is missing', () => {
    const { termsAccepted: _, ...payloadWithoutTerms } = validPayload;

    const result = registerMemberSchema.safeParse(payloadWithoutTerms);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'termsAccepted');
      expect(issue?.message).toBe('You must agree to the terms to complete registration.');
    }
  });

  it('should fail when yearsOfExperience is an invalid band', () => {
    const payload = {
      ...validPayload,
      yearsOfExperience: '20+ years',
    };

    const result = registerMemberSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'yearsOfExperience');
      expect(issue?.message).toBe('Invalid years of experience band selected');
    }
  });

  it('should fail when email format is invalid', () => {
    const payload = {
      ...validPayload,
      email: 'not-an-email',
    };

    const result = registerMemberSchema.safeParse(payload);

    expect(result.success).toBe(false);
  });

  it('should fail when mobile contains fewer than 7 digits', () => {
    const payload = {
      ...validPayload,
      mobile: '123-45',
    };

    const result = registerMemberSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'mobile');
      expect(issue?.message).toBe('Mobile number must contain at least 7 digits');
    }
  });

  it('should validate linkedinUrl correctly when present', () => {
    // Valid LinkedIn URL
    const validUrlPayload = {
      ...validPayload,
      linkedinUrl: 'https://linkedin.com/in/mohamedali',
    };
    expect(registerMemberSchema.safeParse(validUrlPayload).success).toBe(true);

    // Empty string LinkedIn URL
    const emptyUrlPayload = {
      ...validPayload,
      linkedinUrl: '',
    };
    expect(registerMemberSchema.safeParse(emptyUrlPayload).success).toBe(true);

    // Invalid LinkedIn URL string
    const invalidUrlPayload = {
      ...validPayload,
      linkedinUrl: 'invalid-url-string',
    };
    expect(registerMemberSchema.safeParse(invalidUrlPayload).success).toBe(false);
  });
});
