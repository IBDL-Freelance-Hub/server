import { upgradeMembershipSchema } from '../../../../src/modules/membership/presentation/membership.schema';

describe('Membership Schema Validation Tests (SEC-33, MEM-07)', () => {
  it('should accept valid upgrade to PROFESSIONAL', () => {
    const result = upgradeMembershipSchema.safeParse({
      targetTier: 'PROFESSIONAL',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetTier).toBe('PROFESSIONAL');
    }
  });

  it('should accept valid upgrade to MASTER with simulation flags', () => {
    const result = upgradeMembershipSchema.safeParse({
      targetTier: 'MASTER',
      paymentMethodToken: 'mock-token-success',
      simulationOutcome: 'SUCCESS',
    });

    expect(result.success).toBe(true);
  });

  it('should strictly reject client-supplied price field (SEC-33)', () => {
    const result = upgradeMembershipSchema.safeParse({
      targetTier: 'PROFESSIONAL',
      price: 10.0,
    });

    expect(result.success).toBe(false);
  });

  it('should strictly reject client-supplied amount field (SEC-33)', () => {
    const result = upgradeMembershipSchema.safeParse({
      targetTier: 'MASTER',
      amount: 1.0,
    });

    expect(result.success).toBe(false);
  });

  it('should strictly reject client-supplied discount field (SEC-33)', () => {
    const result = upgradeMembershipSchema.safeParse({
      targetTier: 'PROFESSIONAL',
      discount: 50,
    });

    expect(result.success).toBe(false);
  });

  it('should reject ESSENTIAL as target upgrade tier', () => {
    const result = upgradeMembershipSchema.safeParse({
      targetTier: 'ESSENTIAL',
    });

    expect(result.success).toBe(false);
  });

  it('should reject unknown target tier', () => {
    const result = upgradeMembershipSchema.safeParse({
      targetTier: 'DIAMOND',
    });

    expect(result.success).toBe(false);
  });
});
