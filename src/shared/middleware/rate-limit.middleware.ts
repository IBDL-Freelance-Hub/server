import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { getClientIp } from '../utils';

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  skipInTests?: boolean;
}) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    skipInTests = true,
  } = options;

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => getClientIp(req),
    skip: () => Boolean(skipInTests && process.env.NODE_ENV === 'test'),
    handler: (req: Request, res: Response) => {
      const requestId = req.id || 'N/A';
      const timestamp = new Date().toISOString();
      res.status(429).json({
        success: false,
        code: 'TOO_MANY_REQUESTS',
        message,
        details: null,
        requestId,
        timestamp,
      });
    },
  });
}

// 1. General API-wide Rate Limiter: 300 requests per 15 minutes
export const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests to the API. Please try again later.',
});

// 2. Auth Login Rate Limiter: 10 requests per 1 minute
export const authLoginRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many login attempts from this IP. Please try again after 1 minute.',
});

// 3. Sensitive Auth Tokens Rate Limiter: 5 requests per 15 minutes (/forgot-password, /resend-activation)
export const sensitiveAuthTokenRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many token requests from this IP. Please try again after 15 minutes.',
});

// 4. Member Registration Rate Limiter: 10 requests per 1 hour
export const registrationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many account registrations from this IP. Please try again later.',
});

// 5. Files Module Rate Limiter: 10 requests per 5 minutes
export const filesRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many file operations from this IP. Please try again later.',
});
