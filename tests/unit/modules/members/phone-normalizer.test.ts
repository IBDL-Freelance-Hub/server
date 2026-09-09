import {
  normalizePhoneNumber,
  normalizeCountryKey,
} from '../../../../src/modules/members/domain/phone-normalizer';
import { ValidationError } from '../../../../src/shared/errors';

describe('Phone Normalizer Domain Unit Tests', () => {
  describe('normalizeCountryKey', () => {
    it('should correctly identify Egypt country aliases', () => {
      expect(normalizeCountryKey('Egypt')).toBe('EG');
      expect(normalizeCountryKey('eg')).toBe('EG');
      expect(normalizeCountryKey('+20')).toBe('EG');
      expect(normalizeCountryKey('20')).toBe('EG');
    });

    it('should correctly identify Saudi Arabia country aliases', () => {
      expect(normalizeCountryKey('Saudi Arabia')).toBe('SA');
      expect(normalizeCountryKey('ksa')).toBe('SA');
      expect(normalizeCountryKey('SA')).toBe('SA');
      expect(normalizeCountryKey('+966')).toBe('SA');
    });

    it('should correctly identify Oman country aliases', () => {
      expect(normalizeCountryKey('Oman')).toBe('OM');
      expect(normalizeCountryKey('om')).toBe('OM');
      expect(normalizeCountryKey('+968')).toBe('OM');
    });

    it('should throw ValidationError for unsupported country', () => {
      expect(() => normalizeCountryKey('United States')).toThrow(ValidationError);
      expect(() => normalizeCountryKey('UK')).toThrow(ValidationError);
    });
  });

  describe('Egyptian Phone Normalization (+20)', () => {
    it('should normalize standard Egyptian local mobile numbers', () => {
      expect(normalizePhoneNumber('01012345678', 'Egypt')).toBe('+201012345678');
      expect(normalizePhoneNumber('01123456789', 'EG')).toBe('+201123456789');
      expect(normalizePhoneNumber('01234567890', '+20')).toBe('+201234567890');
      expect(normalizePhoneNumber('01555555555', '20')).toBe('+201555555555');
    });

    it('should handle formatted Egyptian numbers with spaces, dashes, or international prefix', () => {
      expect(normalizePhoneNumber('+20 100 123 4567', 'Egypt')).toBe('+201001234567');
      expect(normalizePhoneNumber('0020-11-2345-6789', 'EG')).toBe('+201123456789');
      expect(normalizePhoneNumber('20(123)4567890', 'Egypt')).toBe('+201234567890');
    });

    it('should throw ValidationError for invalid Egyptian numbers', () => {
      // Invalid mobile prefix 019
      expect(() => normalizePhoneNumber('01912345678', 'Egypt')).toThrow(ValidationError);
      // Too short
      expect(() => normalizePhoneNumber('01012345', 'Egypt')).toThrow(ValidationError);
      // Landline format
      expect(() => normalizePhoneNumber('0223456789', 'Egypt')).toThrow(ValidationError);
    });
  });

  describe('Saudi Phone Normalization (+966)', () => {
    it('should normalize standard Saudi local mobile numbers', () => {
      expect(normalizePhoneNumber('0501234567', 'Saudi Arabia')).toBe('+966501234567');
      expect(normalizePhoneNumber('0559876543', 'KSA')).toBe('+966559876543');
    });

    it('should handle formatted Saudi numbers with spaces or international prefix', () => {
      expect(normalizePhoneNumber('+966 50 123 4567', 'SA')).toBe('+966501234567');
      expect(normalizePhoneNumber('00966-55-987-6543', '+966')).toBe('+966559876543');
    });

    it('should throw ValidationError for invalid Saudi numbers', () => {
      // Doesn't start with 5
      expect(() => normalizePhoneNumber('0401234567', 'KSA')).toThrow(ValidationError);
      // Too short
      expect(() => normalizePhoneNumber('050123', 'KSA')).toThrow(ValidationError);
    });
  });

  describe('Omani Phone Normalization (+968)', () => {
    it('should normalize standard Omani local mobile numbers starting with 7 or 9', () => {
      expect(normalizePhoneNumber('91234567', 'Oman')).toBe('+96891234567');
      expect(normalizePhoneNumber('71234567', 'OM')).toBe('+96871234567');
    });

    it('should handle formatted Omani numbers with spaces or international prefix', () => {
      expect(normalizePhoneNumber('+968 9123 4567', 'Oman')).toBe('+96891234567');
      expect(normalizePhoneNumber('00968-71-234-567', '+968')).toBe('+96871234567');
    });

    it('should throw ValidationError for invalid Omani numbers', () => {
      // Doesn't start with 7 or 9
      expect(() => normalizePhoneNumber('51234567', 'Oman')).toThrow(ValidationError);
      // Incorrect length
      expect(() => normalizePhoneNumber('912345', 'Oman')).toThrow(ValidationError);
    });
  });

  describe('Edge cases and empty inputs', () => {
    it('should throw ValidationError for empty phone or country inputs', () => {
      expect(() => normalizePhoneNumber('', 'Egypt')).toThrow(ValidationError);
      expect(() => normalizePhoneNumber('01012345678', '')).toThrow(ValidationError);
    });
  });
});
