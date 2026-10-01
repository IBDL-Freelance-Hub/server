import {
  formatSequentialReference,
  generateRequestReference,
  isValidRequestReference,
  parseReferenceSequence,
} from '../../../../src/modules/requests/domain/reference-generator';

describe('ReferenceGenerator Pure Domain Unit Tests (REQ-YYYY-0nnn)', () => {
  it('should generate sequential reference code adhering to REQ-YYYY-0nnn format', () => {
    const ref1 = formatSequentialReference(2026, 1);
    expect(ref1).toBe('REQ-2026-0001');
    expect(isValidRequestReference(ref1)).toBe(true);

    const ref25 = formatSequentialReference(2026, 25);
    expect(ref25).toBe('REQ-2026-0025');

    const ref150 = formatSequentialReference(2026, 150);
    expect(ref150).toBe('REQ-2026-0150');

    const ref1000 = formatSequentialReference(2026, 1000);
    expect(ref1000).toBe('REQ-2026-1000');
  });

  it('generateRequestReference helper should generate formatted sequential code', () => {
    const ref = generateRequestReference(5, 2026);
    expect(ref).toBe('REQ-2026-0005');
  });

  it('should validate valid sequential reference codes and reject invalid ones', () => {
    expect(isValidRequestReference('REQ-2026-0001')).toBe(true);
    expect(isValidRequestReference('REQ-2026-0025')).toBe(true);
    expect(isValidRequestReference('REQ-2026-1000')).toBe(true);
    expect(isValidRequestReference('REQ-26-0001')).toBe(false); // 2-digit year
    expect(isValidRequestReference('REQ-2026-ABC')).toBe(false); // non-digits
    expect(isValidRequestReference('INVALID')).toBe(false);
  });

  it('should parse year and sequence number correctly', () => {
    const parsed = parseReferenceSequence('REQ-2026-0042');
    expect(parsed).toEqual({ year: 2026, sequence: 42 });

    const invalid = parseReferenceSequence('INVALID-FORMAT');
    expect(invalid).toBeNull();
  });
});
