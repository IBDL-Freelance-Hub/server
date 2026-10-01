import { EngagementRequestStatus } from '@prisma/client';
import { ValidationError } from '../../../shared/errors';

export const ALLOWED_STATUS_TRANSITIONS: Record<
  EngagementRequestStatus,
  readonly EngagementRequestStatus[]
> = {
  [EngagementRequestStatus.SUBMITTED]: [
    EngagementRequestStatus.UNDER_REVIEW,
    EngagementRequestStatus.CANCELLED,
    EngagementRequestStatus.REJECTED,
  ],
  [EngagementRequestStatus.UNDER_REVIEW]: [
    EngagementRequestStatus.AWAITING_RESPONSE,
    EngagementRequestStatus.AWAITING_PAYMENT,
    EngagementRequestStatus.PAYMENT_CONFIRMED, // When approved payable amount is $0
    EngagementRequestStatus.CANCELLED,
    EngagementRequestStatus.REJECTED,
  ],
  [EngagementRequestStatus.AWAITING_RESPONSE]: [
    EngagementRequestStatus.UNDER_REVIEW,
    EngagementRequestStatus.CANCELLED,
    EngagementRequestStatus.REJECTED,
  ],
  [EngagementRequestStatus.AWAITING_PAYMENT]: [
    EngagementRequestStatus.PAYMENT_CONFIRMED,
    EngagementRequestStatus.CANCELLED,
    EngagementRequestStatus.REJECTED,
  ],
  [EngagementRequestStatus.PAYMENT_CONFIRMED]: [
    EngagementRequestStatus.FULFILLED,
    EngagementRequestStatus.REJECTED,
  ],
  [EngagementRequestStatus.FULFILLED]: [], // Terminal state
  [EngagementRequestStatus.CANCELLED]: [], // Terminal closed state
  [EngagementRequestStatus.REJECTED]: [], // Terminal closed state
};

export function canTransitionRequestStatus(
  currentStatus: EngagementRequestStatus,
  targetStatus: EngagementRequestStatus,
): boolean {
  if (isTerminalRequestStatus(currentStatus)) return false;
  if (currentStatus === targetStatus) return true;
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

export function isTerminalRequestStatus(status: EngagementRequestStatus): boolean {
  const terminalStates = [
    EngagementRequestStatus.FULFILLED,
    EngagementRequestStatus.CANCELLED,
    EngagementRequestStatus.REJECTED,
  ] as const;
  return (terminalStates as readonly EngagementRequestStatus[]).includes(status);
}

/**
 * Member can cancel a request from submission up until payment is confirmed.
 * Once payment_confirmed or fulfilled (or already closed), member cancellation is forbidden.
 */
export function canMemberCancelRequest(status: EngagementRequestStatus): boolean {
  const cancellableStates = [
    EngagementRequestStatus.SUBMITTED,
    EngagementRequestStatus.UNDER_REVIEW,
    EngagementRequestStatus.AWAITING_RESPONSE,
    EngagementRequestStatus.AWAITING_PAYMENT,
  ] as const;
  return (cancellableStates as readonly EngagementRequestStatus[]).includes(status);
}

export function assertValidRequestTransition(
  currentStatus: EngagementRequestStatus,
  targetStatus: EngagementRequestStatus,
): void {
  if (!canTransitionRequestStatus(currentStatus, targetStatus)) {
    throw new ValidationError(
      `Invalid request status transition from '${currentStatus}' to '${targetStatus}'.`,
    );
  }
}
