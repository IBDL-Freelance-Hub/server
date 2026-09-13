import { Request } from 'express';
import { getClientIp } from '../../../../src/shared/utils/ip-resolver';
import { TokenRateLimiterService } from '../../../../src/modules/auth/infrastructure/token-rate-limiter.service';
import { TokenPurpose } from '@prisma/client';

describe('Client IP Resolver & Independent IP Lockout Validation', () => {
  describe('getClientIp Helper', () => {
    it('should extract client IP from x-real-client-ip header', () => {
      const req = {
        headers: { 'x-real-client-ip': '203.0.113.195' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('should take first IP if x-real-client-ip contains comma-separated values', () => {
      const req = {
        headers: { 'x-real-client-ip': '198.51.100.42, 10.0.0.1' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      expect(getClientIp(req)).toBe('198.51.100.42');
    });

    it('should fallback to req.ip if x-real-client-ip is missing', () => {
      const req = {
        headers: {},
        ip: '192.168.1.100',
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      expect(getClientIp(req)).toBe('192.168.1.100');
    });
  });

  describe('Independent Multi-IP Rate-Limiting & Lockout', () => {
    it('should track failing requests from distinct x-real-client-ip values independently without triggering shared lockout', async () => {
      const logs: { ipAddress: string; email: string; purpose: TokenPurpose; requestedAt: Date }[] =
        [];

      const mockPrisma = {
        securityConfig: {
          findFirst: jest.fn().mockResolvedValue({
            tokenRequestMaxPerEmail: 10,
            tokenRequestWindowMinutesPerEmail: 60,
            tokenRequestMaxPerIp: 3,
            tokenRequestWindowMinutesPerIp: 60,
          }),
        },
        tokenRequestLog: {
          create: jest.fn().mockImplementation(({ data }) => {
            logs.push(data);
            return Promise.resolve({ id: `log-${logs.length}`, ...data });
          }),
          count: jest.fn().mockImplementation(({ where }) => {
            const count = logs.filter(
              (l) => l.ipAddress === where.ipAddress && l.purpose === where.purpose,
            ).length;
            return Promise.resolve(count);
          }),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        },
      };

      const rateLimiter = new TokenRateLimiterService(
        mockPrisma as unknown as import('@prisma/client').PrismaClient,
      );

      const ip1 = '203.0.113.195';
      const ip2 = '198.51.100.42';

      // Simulate 3 requests from IP 1 (hitting max limit of 3)
      const res1 = await rateLimiter.checkAndLogRequest({
        purpose: TokenPurpose.ACTIVATION,
        email: 'user1@example.com',
        ipAddress: ip1,
      });
      expect(res1.allowed).toBe(true);

      const res2 = await rateLimiter.checkAndLogRequest({
        purpose: TokenPurpose.ACTIVATION,
        email: 'user2@example.com',
        ipAddress: ip1,
      });
      expect(res2.allowed).toBe(true);

      const res3 = await rateLimiter.checkAndLogRequest({
        purpose: TokenPurpose.ACTIVATION,
        email: 'user3@example.com',
        ipAddress: ip1,
      });
      expect(res3.allowed).toBe(true);

      // 4th request from IP 1 -> should be rate limited / blocked
      const res4 = await rateLimiter.checkAndLogRequest({
        purpose: TokenPurpose.ACTIVATION,
        email: 'user4@example.com',
        ipAddress: ip1,
      });
      expect(res4.allowed).toBe(false);

      // Request from IP 2 (distinct x-real-client-ip) -> should NOT be blocked by IP 1 lockout
      const resIp2 = await rateLimiter.checkAndLogRequest({
        purpose: TokenPurpose.ACTIVATION,
        email: 'user5@example.com',
        ipAddress: ip2,
      });
      expect(resIp2.allowed).toBe(true);
    });
  });
});
