export interface FailedAttempt {
  attemptedAt: Date;
}

export interface LockoutEvaluation {
  isLocked: boolean;
  remainingLockoutMs: number;
  failedCountInWindow: number;
}

export const LOCKOUT_CONFIG = {
  MAX_FAILED_ATTEMPTS: 5,
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes
} as const;

/**
 * Evaluates account lockout status according to platform security policy (SEC-22, ERR-92).
 * Pure domain function with zero external dependencies.
 */
export function evaluateLockout(
  failedAttempts: FailedAttempt[],
  referenceTime: Date = new Date(),
): LockoutEvaluation {
  const refTimeMs = referenceTime.getTime();
  const windowStartMs = refTimeMs - LOCKOUT_CONFIG.WINDOW_MS;

  // Sort chronologically ascending
  const sortedAttempts = [...failedAttempts].sort(
    (a, b) => a.attemptedAt.getTime() - b.attemptedAt.getTime(),
  );

  // Filter attempts occurring within the 15-minute sliding window up to referenceTime
  const windowAttempts = sortedAttempts.filter((attempt) => {
    const time = attempt.attemptedAt.getTime();
    return time >= windowStartMs && time <= refTimeMs;
  });

  const failedCountInWindow = windowAttempts.length;

  if (failedCountInWindow >= LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS) {
    // Lockout triggers from the 5th attempt in the window
    const triggerAttempt = windowAttempts[LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - 1];
    if (triggerAttempt) {
      const lockoutExpiresAt =
        triggerAttempt.attemptedAt.getTime() + LOCKOUT_CONFIG.LOCKOUT_DURATION_MS;

      if (refTimeMs < lockoutExpiresAt) {
        return {
          isLocked: true,
          remainingLockoutMs: lockoutExpiresAt - refTimeMs,
          failedCountInWindow,
        };
      }
    }
  }

  return {
    isLocked: false,
    remainingLockoutMs: 0,
    failedCountInWindow,
  };
}
