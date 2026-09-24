import { Request, Response, NextFunction } from 'express';
import { createRateLimiter } from '../../../src/shared/middleware/rate-limit.middleware';

describe('Rate Limiter Middleware Unit Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      id: 'req-rate-test-1',
      headers: {},
      socket: { remoteAddress: '192.168.1.100' } as unknown as Request['socket'],
      ip: '192.168.1.100',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      getHeader: jest.fn(),
    };

    mockNext = jest.fn();
  });

  it('should allow requests under the limit', async () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 5,
      skipInTests: false,
    });

    await new Promise<void>((resolve) => {
      limiter(mockReq as Request, mockRes as Response, () => {
        mockNext();
        resolve();
      });
    });

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should block requests exceeding the limit with 429 and standard error envelope', async () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: 'Rate limit exceeded for test',
      skipInTests: false,
    });

    // Request 1: OK
    await new Promise<void>((resolve) => {
      limiter(mockReq as Request, mockRes as Response, () => resolve());
    });

    // Request 2: OK
    await new Promise<void>((resolve) => {
      limiter(mockReq as Request, mockRes as Response, () => resolve());
    });

    // Request 3: Blocked
    await new Promise<void>((resolve) => {
      (mockRes.json as jest.Mock).mockImplementation(() => {
        resolve();
        return mockRes;
      });
      limiter(mockReq as Request, mockRes as Response, () => {
        resolve();
      });
    });

    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded for test',
        requestId: 'req-rate-test-1',
      }),
    );
  });
});
