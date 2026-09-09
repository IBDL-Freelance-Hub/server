import { ValidationError } from '../../../shared/errors';

export type SupportedCountryKey = 'EG' | 'SA' | 'OM';

export function normalizeCountryKey(country: string): SupportedCountryKey {
  if (!country || typeof country !== 'string') {
    throw new ValidationError('Country is required for phone normalization');
  }

  const normalized = country.trim().toUpperCase();
  if (['EGYPT', 'EG', '+20', '20'].includes(normalized)) {
    return 'EG';
  }
  if (['SAUDI ARABIA', 'SAUDI', 'KSA', 'SA', '+966', '966'].includes(normalized)) {
    return 'SA';
  }
  if (['OMAN', 'OM', '+968', '968'].includes(normalized)) {
    return 'OM';
  }
  throw new ValidationError(`Unsupported or invalid country for phone normalization: ${country}`);
}

export function normalizePhoneNumber(rawPhone: string, country: string): string {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new ValidationError('Phone number is required');
  }

  const countryKey = normalizeCountryKey(country);
  let cleaned = rawPhone.trim().replace(/[\s().-]/g, '');

  if (countryKey === 'EG') {
    if (cleaned.startsWith('+20')) {
      cleaned = cleaned.slice(3);
    } else if (cleaned.startsWith('0020')) {
      cleaned = cleaned.slice(4);
    } else if (cleaned.startsWith('20')) {
      cleaned = cleaned.slice(2);
    }

    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }

    if (!/^1[0125]\d{8}$/.test(cleaned)) {
      throw new ValidationError(`Invalid Egyptian mobile phone number format: ${rawPhone}`);
    }
    return `+20${cleaned}`;
  }

  if (countryKey === 'SA') {
    if (cleaned.startsWith('+966')) {
      cleaned = cleaned.slice(4);
    } else if (cleaned.startsWith('00966')) {
      cleaned = cleaned.slice(5);
    } else if (cleaned.startsWith('966')) {
      cleaned = cleaned.slice(3);
    }

    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }

    if (!/^5\d{8}$/.test(cleaned)) {
      throw new ValidationError(`Invalid Saudi mobile phone number format: ${rawPhone}`);
    }
    return `+966${cleaned}`;
  }

  if (countryKey === 'OM') {
    if (cleaned.startsWith('+968')) {
      cleaned = cleaned.slice(4);
    } else if (cleaned.startsWith('00968')) {
      cleaned = cleaned.slice(5);
    } else if (cleaned.startsWith('968')) {
      cleaned = cleaned.slice(3);
    }

    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }

    if (!/^[79]\d{7}$/.test(cleaned)) {
      throw new ValidationError(`Invalid Omani mobile phone number format: ${rawPhone}`);
    }
    return `+968${cleaned}`;
  }

  throw new ValidationError(`Unsupported country: ${country}`);
}
