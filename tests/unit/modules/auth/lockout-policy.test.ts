import { evaluateLockout } from '../../../../src/modules/auth/domain/lockout-policy';

describe('Lockout Policy Domain Utility Unit Tests', () => {
  const baseTime = new Date('2026-09-10T00:00:00.000Z');

  it('should not lock account when there are fewer than 5 failed attempts', () => {
    const attempts = [
      { attemptedAt: new Date(baseTime.getTime() - 10 * 60 * 1000) },
      { attemptedAt: new Date(baseTime.getTime() - 8 * 60 * 1000) },
      { attemptedAt: new Date(baseTime.getTime() - 5 * 60 * 1000) },
      { attemptedAt: new Date(baseTime.getTime() - 2 * 60 * 1000) },
    ];

    const result = evaluateLockout(attempts, baseTime);

    expect(result.isLocked).toBe(false);
    expect(result.remainingLockoutMs).toBe(0);
    expect(result.failedCountInWindow).toBe(4);
  });

  it('should lock account when 5 failed attempts occur within 15 minutes', () => {
    const attempts = [
      { attemptedAt: new Date(baseTime.getTime() - 14 * 60 * 1000) },
      { attemptedAt: new Date(baseTime.getTime() - 12 * 60 * 1000) },
      { attemptedAt: new Date(baseTime.getTime() - 10 * 60 * 1000) },
      { attemptedAt: new Date(baseTime.getTime() - 5 * 60 * 1000) },
      { attemptedAt: new Date(baseTime.getTime() - 1 * 60 * 1000) },
    ];

    // Reference time is baseTime (1 min after 5th attempt)
    const result = evaluateLockout(attempts, baseTime);

    expect(result.isLocked).toBe(true);
    expect(result.failedCountInWindow).toBe(5);
    // Lockout ends 30 minutes after 5th attempt (1 min ago -> 29 minutes remaining)
    expect(result.remainingLockoutMs).toBe(29 * 60 * 1000);
  });

  it('should unlock automatically after 30 minutes have elapsed since the 5th attempt', () => {
    const fifthAttemptTime = new Date(baseTime.getTime() - 31 * 60 * 1000);
    const attempts = [
      { attemptedAt: new Date(baseTime.getTime() - 40 * 60 * 1000) },
      { attemptedAt: new Date(baseTime.getTime() - 38 * 60 * 1000) },
      { attemptedAt: new Date(baseTime.getTime() - 36 * 60 * 1000) },
      { attemptedAt: new Date(baseTime.getTime() - 34 * 60 * 1000) },
      { attemptedAt: fifthAttemptTime },
    ];

    // Reference time is 31 minutes after 5th attempt -> lockout has expired
    const result = evaluateLockout(attempts, baseTime);

    expect(result.isLocked).toBe(false);
    expect(result.remainingLockoutMs).toBe(0);
  });

  it('should ignore older attempts outside the 15-minute sliding window', () => {
    const attempts = [
      { attemptedAt: new Date(baseTime.getTime() - 60 * 60 * 1000) }, // 1 hour ago (ignored)
      { attemptedAt: new Date(baseTime.getTime() - 45 * 60 * 1000) }, // 45 min ago (ignored)
      { attemptedAt: new Date(baseTime.getTime() - 30 * 60 * 1000) }, // 30 min ago (ignored)
      { attemptedAt: new Date(baseTime.getTime() - 10 * 60 * 1000) }, // 10 min ago
      { attemptedAt: new Date(baseTime.getTime() - 2 * 60 * 1000) }, // 2 min ago
    ];

    const result = evaluateLockout(attempts, baseTime);

    expect(result.isLocked).toBe(false);
    expect(result.failedCountInWindow).toBe(2);
  });
});
