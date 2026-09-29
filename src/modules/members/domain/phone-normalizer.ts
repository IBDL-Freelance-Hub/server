import { ValidationError } from '../../../shared/errors';

export type SupportedCountryKey = 'EG' | 'SA' | 'AE' | 'KW' | 'OM';

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
  if (['UNITED ARAB EMIRATES', 'UAE', 'AE', '+971', '971'].includes(normalized)) {
    return 'AE';
  }
  if (['KUWAIT', 'KW', '+965', '965'].includes(normalized)) {
    return 'KW';
  }
  if (['OMAN', 'OM', '+968', '968'].includes(normalized)) {
    return 'OM';
  }
  throw new ValidationError(`Unsupported or invalid country for phone normalization: ${country}`);
}

export function isValidMobileForCountry(phone: string, country?: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.trim().replace(/[\s\-()]/g, '');
  const c = (country || '').trim().toUpperCase();

  const isEG =
    ['EGYPT', 'EG', '+20', '20'].includes(c) ||
    cleaned.startsWith('+20') ||
    cleaned.startsWith('0020');
  const isSA =
    ['SAUDI ARABIA', 'SAUDI', 'KSA', 'SA', '+966', '966'].includes(c) ||
    cleaned.startsWith('+966') ||
    cleaned.startsWith('00966');
  const isAE =
    ['UNITED ARAB EMIRATES', 'UAE', 'AE', '+971', '971'].includes(c) ||
    cleaned.startsWith('+971') ||
    cleaned.startsWith('00971');
  const isKW =
    ['KUWAIT', 'KW', '+965', '965'].includes(c) ||
    cleaned.startsWith('+965') ||
    cleaned.startsWith('00965');

  if (isEG) {
    if (cleaned.startsWith('+20')) return /^\+200?1[0125]\d{8}$/.test(cleaned);
    if (cleaned.startsWith('0020')) return /^00200?1[0125]\d{8}$/.test(cleaned);
    return /^01[0125]\d{8}$/.test(cleaned);
  }
  if (isSA) {
    if (cleaned.startsWith('+966')) return /^\+9660?5\d{8}$/.test(cleaned);
    if (cleaned.startsWith('00966')) return /^009660?5\d{8}$/.test(cleaned);
    return /^0?5\d{8}$/.test(cleaned);
  }
  if (isAE) {
    if (cleaned.startsWith('+971')) return /^\+9710?5[024568]\d{7}$/.test(cleaned);
    if (cleaned.startsWith('00971')) return /^009710?5[024568]\d{7}$/.test(cleaned);
    return /^0?5[024568]\d{7}$/.test(cleaned);
  }
  if (isKW) {
    if (cleaned.startsWith('+965')) return /^\+9650?[569]\d{7}$/.test(cleaned);
    if (cleaned.startsWith('00965')) return /^009650?[569]\d{7}$/.test(cleaned);
    return /^0?[569]\d{7}$/.test(cleaned);
  }

  return /^\+?\d{7,15}$/.test(cleaned);
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
      throw new ValidationError(
        `Invalid Egyptian mobile phone number format: ${rawPhone}. Expected 11 digits starting with 010, 011, 012, or 015.`,
      );
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
      throw new ValidationError(
        `Invalid Saudi mobile phone number format: ${rawPhone}. Expected 9 digits starting with 5 (or 05).`,
      );
    }
    return `+966${cleaned}`;
  }

  if (countryKey === 'AE') {
    if (cleaned.startsWith('+971')) {
      cleaned = cleaned.slice(4);
    } else if (cleaned.startsWith('00971')) {
      cleaned = cleaned.slice(5);
    } else if (cleaned.startsWith('971')) {
      cleaned = cleaned.slice(3);
    }

    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }

    if (!/^5[024568]\d{7}$/.test(cleaned)) {
      throw new ValidationError(
        `Invalid UAE mobile phone number format: ${rawPhone}. Expected 9 digits starting with 50, 52, 54, 55, 56, or 58.`,
      );
    }
    return `+971${cleaned}`;
  }

  if (countryKey === 'KW') {
    if (cleaned.startsWith('+965')) {
      cleaned = cleaned.slice(4);
    } else if (cleaned.startsWith('00965')) {
      cleaned = cleaned.slice(5);
    } else if (cleaned.startsWith('965')) {
      cleaned = cleaned.slice(3);
    }

    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }

    if (!/^[569]\d{7}$/.test(cleaned)) {
      throw new ValidationError(
        `Invalid Kuwait mobile phone number format: ${rawPhone}. Expected 8 digits starting with 5, 6, or 9.`,
      );
    }
    return `+965${cleaned}`;
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
