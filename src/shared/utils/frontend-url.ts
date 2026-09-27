import { env } from '../../config/env.config';

/**
 * Returns the canonical base URL of the client frontend.
 *
 * Precedence:
 * 1. Explicit FRONTEND_URL environment variable (stripped of trailing slashes).
 * 2. Valid CORS_ORIGIN if set to a concrete http/https domain (not wildcard and not localhost in production).
 * 3. In development/test mode: http://localhost:3000.
 * 4. In production mode: https://freelancers.ibdl.net.
 */
export function getFrontendBaseUrl(): string {
  const customUrl = process.env.FRONTEND_URL?.trim();
  if (customUrl && customUrl !== '') {
    const isLocal = customUrl.includes('localhost') || customUrl.includes('127.0.0.1');
    if (!isLocal || process.env.NODE_ENV !== 'production') {
      return customUrl.replace(/\/+$/, '');
    }
  }

  // Vercel production and preview deployment variables
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, '')}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
  }

  const corsOrigin = env.CORS_ORIGIN?.trim();
  if (
    corsOrigin &&
    corsOrigin !== '*' &&
    (corsOrigin.startsWith('http://') || corsOrigin.startsWith('https://'))
  ) {
    const firstOrigin = (corsOrigin.split(',')[0] || '').trim();
    const isLocal = firstOrigin.includes('localhost') || firstOrigin.includes('127.0.0.1');
    if (!isLocal || (process.env.NODE_ENV !== 'production' && !process.env.VERCEL)) {
      return firstOrigin.replace(/\/+$/, '');
    }
  }

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return 'http://localhost:3000';
  }

  return 'https://ibdlfreelancehub.vercel.app';
}
