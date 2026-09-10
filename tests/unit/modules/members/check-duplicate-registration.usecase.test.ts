import { PrismaClient } from '@prisma/client';
import { CheckDuplicateRegistrationUseCase } from '../../../../src/modules/members/application/check-duplicate-registration.usecase';
import { MemoryRateLimiter } from '../../../../src/shared/providers/rate-limiter.provider';

describe('CheckDuplicateRegistrationUseCase Unit Tests (Missing Part A)', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let rateLimiter: MemoryRateLimiter;
  let useCase: CheckDuplicateRegistrationUseCase;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      member: {
        findUnique: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    rateLimiter = new MemoryRateLimiter(5000);
    useCase = new CheckDuplicateRegistrationUseCase(mockPrisma, rateLimiter);
  });

  it('should return isDuplicate: false when email and phone do not exist in live DB', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await useCase.execute(
      { email: 'newuser@example.com', mobile: '1001234567', country: 'EG' },
      '192.168.1.100',
    );

    expect(result.isDuplicate).toBe(false);
    expect(result.clashType).toBe('none');
    expect(result.emailClash).toBe(false);
    expect(result.mobileClash).toBe(false);
  });

  it('should return email clash when email matches live User record', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await useCase.execute(
      { email: 'existing@example.com', mobile: '1001234567', country: 'EG' },
      '192.168.1.101',
    );

    expect(result.isDuplicate).toBe(true);
    expect(result.clashType).toBe('email');
    expect(result.emailClash).toBe(true);
    expect(result.mobileClash).toBe(false);
  });

  it('should return mobile clash when phone matches live Member record', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({ id: 'member-1' });

    const result = await useCase.execute(
      { email: 'new@example.com', mobile: '1001234567', country: 'EG' },
      '192.168.1.102',
    );

    expect(result.isDuplicate).toBe(true);
    expect(result.clashType).toBe('mobile');
    expect(result.emailClash).toBe(false);
    expect(result.mobileClash).toBe(true);
  });

  it('should return clashType "both" when both email and mobile exist', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue({ id: 'member-1' });

    const result = await useCase.execute(
      { email: 'clash@example.com', mobile: '1001234567', country: 'EG' },
      '192.168.1.103',
    );

    expect(result.isDuplicate).toBe(true);
    expect(result.clashType).toBe('both');
    expect(result.emailClash).toBe(true);
    expect(result.mobileClash).toBe(true);
  });

  it('should not query member phone when country is omitted', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await useCase.execute(
      { email: 'no-country@example.com', mobile: '1001234567' },
      '192.168.1.104',
    );

    expect(result.isDuplicate).toBe(false);
    expect(mockPrisma.member.findUnique).not.toHaveBeenCalled();
  });

  it('should throw TooManyRequestsError when IP exceeds 30 requests within 15m window', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    const testIp = '10.200.1.55';
    for (let i = 0; i < 30; i++) {
      await useCase.execute({ email: `user${i}@example.com` }, testIp);
    }

    await expect(useCase.execute({ email: 'spammer@example.com' }, testIp)).rejects.toThrow(
      'Too many duplicate check attempts from this IP',
    );
  });

  it('MemoryRateLimiter should enforce max capacity bound and evict oldest keys', async () => {
    const smallLimiter = new MemoryRateLimiter(2); // Max capacity of 2 IPs
    const customUseCase = new CheckDuplicateRegistrationUseCase(mockPrisma, smallLimiter);

    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    // Add IP-1 and IP-2
    await customUseCase.execute({ email: 'u1@ex.com' }, 'IP-1');
    await customUseCase.execute({ email: 'u2@ex.com' }, 'IP-2');

    // Add IP-3, which exceeds max capacity 2 and evicts IP-1
    await customUseCase.execute({ email: 'u3@ex.com' }, 'IP-3');

    // IP-1 should have been evicted, so its request count starts over at 1
    const res = await customUseCase.execute({ email: 'u1@ex.com' }, 'IP-1');
    expect(res.isDuplicate).toBe(false);
  });
});
