import {
  registerMemberSchema,
  checkDuplicateSchema,
  updateMemberProfileSchema,
} from '../../../../src/modules/members/presentation/members.schema';

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

  describe('checkDuplicateSchema Validation Tests', () => {
    it('should pass when only email is provided', () => {
      const res = checkDuplicateSchema.safeParse({ email: 'user@example.com' });
      expect(res.success).toBe(true);
    });

    it('should pass when both mobile and country are provided', () => {
      const res = checkDuplicateSchema.safeParse({ mobile: '1001234567', country: 'EG' });
      expect(res.success).toBe(true);
    });

    it('should fail when mobile is provided without country', () => {
      const res = checkDuplicateSchema.safeParse({ mobile: '1001234567' });
      expect(res.success).toBe(false);
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.path.join('.') === 'country');
        expect(issue?.message).toBe('Country is required when mobile number is provided.');
      }
    });

    it('should fail when mobile is provided with empty whitespace country', () => {
      const res = checkDuplicateSchema.safeParse({ mobile: '1001234567', country: '   ' });
      expect(res.success).toBe(false);
    });
  });

  describe('updateMemberProfileSchema Validation Tests', () => {
    it('should pass with empty object for partial patch', () => {
      const res = updateMemberProfileSchema.safeParse({});
      expect(res.success).toBe(true);
    });

    it('should pass with valid partial updates', () => {
      const res = updateMemberProfileSchema.safeParse({
        city: 'Alexandria',
        directoryOptIn: true,
        yearsOfExperience: '6-10',
        areasOfExpertise: ['Node.js', 'PostgreSQL'],
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.city).toBe('Alexandria');
        expect(res.data.directoryOptIn).toBe(true);
        expect(res.data.yearsOfExperience).toBe('6-10');
      }
    });

    it('should strictly reject any attempt to update email (PRO-04, VAL-50)', () => {
      const res = updateMemberProfileSchema.safeParse({
        email: 'newemail@example.com',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.path.join('.') === 'email');
        expect(issue?.message).toBe(
          'Email address is read-only and cannot be modified (PRO-04, VAL-50)',
        );
      }
    });

    it('should reject empty or whitespace city (VAL-52, VAL-57)', () => {
      const resEmpty = updateMemberProfileSchema.safeParse({ city: '' });
      expect(resEmpty.success).toBe(false);

      const resWhitespace = updateMemberProfileSchema.safeParse({ city: '   ' });
      expect(resWhitespace.success).toBe(false);
    });

    it('should reject empty, whitespace, or short fullNameEn (VAL-57)', () => {
      const resEmpty = updateMemberProfileSchema.safeParse({ fullNameEn: '' });
      expect(resEmpty.success).toBe(false);

      const resWhitespace = updateMemberProfileSchema.safeParse({ fullNameEn: '   ' });
      expect(resWhitespace.success).toBe(false);

      const resShort = updateMemberProfileSchema.safeParse({ fullNameEn: 'A' });
      expect(resShort.success).toBe(false);
    });

    it('should reject invalid phone number (less than 7 digits) (VAL-57)', () => {
      const res = updateMemberProfileSchema.safeParse({ phone: '12345' });
      expect(res.success).toBe(false);
      if (!res.success) {
        const issue = res.error.issues.find((i) => i.path.join('.') === 'phone');
        expect(issue?.message).toBe('Phone number must contain at least 7 digits');
      }
    });

    it('should reject invalid yearsOfExperience band', () => {
      const res = updateMemberProfileSchema.safeParse({ yearsOfExperience: 'invalid-band' });
      expect(res.success).toBe(false);
    });

    it('should reject bioEn or bioAr exceeding 5000 characters (VAL-08)', () => {
      const longBio = 'a'.repeat(5001);
      const resEn = updateMemberProfileSchema.safeParse({ bioEn: longBio });
      expect(resEn.success).toBe(false);
      if (!resEn.success) {
        const issue = resEn.error.issues.find((i) => i.path.join('.') === 'bioEn');
        expect(issue?.message).toBe(
          'This entry is too long. Shorten it to 5000 characters or fewer.',
        );
      }

      const resAr = updateMemberProfileSchema.safeParse({ bioAr: longBio });
      expect(resAr.success).toBe(false);
      if (!resAr.success) {
        const issue = resAr.error.issues.find((i) => i.path.join('.') === 'bioAr');
        expect(issue?.message).toBe('هذا الإدخال طويل جداً. يرجى تقصيره إلى 5000 حرفاً أو أقل.');
      }
    });

    it('should accept valid 5000 character bio (VAL-08)', () => {
      const validBio = 'a'.repeat(5000);
      const res = updateMemberProfileSchema.safeParse({ bioEn: validBio, bioAr: validBio });
      expect(res.success).toBe(true);
    });

    it('should allow clearing optional fields with null or empty string (VAL-53, VAL-56)', () => {
      const res = updateMemberProfileSchema.safeParse({
        bioEn: null,
        bioAr: '',
        linkedinUrl: null,
        fullNameAr: null,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.bioEn).toBeNull();
        expect(res.data.bioAr).toBeNull();
        expect(res.data.linkedinUrl).toBeNull();
        expect(res.data.fullNameAr).toBeNull();
      }
    });

    it('should reject invalid linkedinUrl format', () => {
      const res = updateMemberProfileSchema.safeParse({
        linkedinUrl: 'not-a-valid-url',
      });
      expect(res.success).toBe(false);
    });
  });
});
