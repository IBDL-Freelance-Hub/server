import { EngagementRequestStatus } from '@prisma/client';
import {
  canTransitionRequestStatus,
  isTerminalRequestStatus,
  canMemberCancelRequest,
  assertValidRequestTransition,
} from '../../../../src/modules/requests/domain/request-state-machine';
import { ValidationError } from '../../../../src/shared/errors';

describe('RequestStateMachine Pure Domain Unit Tests (8-State Governed Workflow)', () => {
  it('should allow valid transitions from SUBMITTED', () => {
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.SUBMITTED,
        EngagementRequestStatus.UNDER_REVIEW,
      ),
    ).toBe(true);
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.SUBMITTED,
        EngagementRequestStatus.CANCELLED,
      ),
    ).toBe(true);
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.SUBMITTED,
        EngagementRequestStatus.REJECTED,
      ),
    ).toBe(true);
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.SUBMITTED,
        EngagementRequestStatus.FULFILLED,
      ),
    ).toBe(false);
  });

  it('should allow valid transitions from UNDER_REVIEW', () => {
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.UNDER_REVIEW,
        EngagementRequestStatus.AWAITING_RESPONSE,
      ),
    ).toBe(true);
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.UNDER_REVIEW,
        EngagementRequestStatus.AWAITING_PAYMENT,
      ),
    ).toBe(true);
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.UNDER_REVIEW,
        EngagementRequestStatus.PAYMENT_CONFIRMED, // When $0 payable approved
      ),
    ).toBe(true);
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.UNDER_REVIEW,
        EngagementRequestStatus.CANCELLED,
      ),
    ).toBe(true);
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.UNDER_REVIEW,
        EngagementRequestStatus.REJECTED,
      ),
    ).toBe(true);
  });

  it('should allow two-way transitions between UNDER_REVIEW and AWAITING_RESPONSE', () => {
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.AWAITING_RESPONSE,
        EngagementRequestStatus.UNDER_REVIEW,
      ),
    ).toBe(true);
  });

  it('should allow valid transitions from AWAITING_PAYMENT', () => {
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.AWAITING_PAYMENT,
        EngagementRequestStatus.PAYMENT_CONFIRMED,
      ),
    ).toBe(true);
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.AWAITING_PAYMENT,
        EngagementRequestStatus.CANCELLED,
      ),
    ).toBe(true);
  });

  it('should allow transition from PAYMENT_CONFIRMED to FULFILLED', () => {
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.PAYMENT_CONFIRMED,
        EngagementRequestStatus.FULFILLED,
      ),
    ).toBe(true);
  });

  it('should correctly determine who can cancel (member can cancel until payment_confirmed)', () => {
    // Cancellable by member:
    expect(canMemberCancelRequest(EngagementRequestStatus.SUBMITTED)).toBe(true);
    expect(canMemberCancelRequest(EngagementRequestStatus.UNDER_REVIEW)).toBe(true);
    expect(canMemberCancelRequest(EngagementRequestStatus.AWAITING_RESPONSE)).toBe(true);
    expect(canMemberCancelRequest(EngagementRequestStatus.AWAITING_PAYMENT)).toBe(true);

    // NOT cancellable by member once payment confirmed or beyond:
    expect(canMemberCancelRequest(EngagementRequestStatus.PAYMENT_CONFIRMED)).toBe(false);
    expect(canMemberCancelRequest(EngagementRequestStatus.FULFILLED)).toBe(false);
    expect(canMemberCancelRequest(EngagementRequestStatus.CANCELLED)).toBe(false);
    expect(canMemberCancelRequest(EngagementRequestStatus.REJECTED)).toBe(false);
  });

  it('should prevent transitions out of terminal states (FULFILLED, CANCELLED, REJECTED)', () => {
    expect(isTerminalRequestStatus(EngagementRequestStatus.FULFILLED)).toBe(true);
    expect(isTerminalRequestStatus(EngagementRequestStatus.CANCELLED)).toBe(true);
    expect(isTerminalRequestStatus(EngagementRequestStatus.REJECTED)).toBe(true);

    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.FULFILLED,
        EngagementRequestStatus.UNDER_REVIEW,
      ),
    ).toBe(false);
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.CANCELLED,
        EngagementRequestStatus.SUBMITTED,
      ),
    ).toBe(false);
    expect(
      canTransitionRequestStatus(
        EngagementRequestStatus.REJECTED,
        EngagementRequestStatus.SUBMITTED,
      ),
    ).toBe(false);
  });

  it('assertValidRequestTransition should throw ValidationError on disallowed transitions', () => {
    expect(() =>
      assertValidRequestTransition(
        EngagementRequestStatus.SUBMITTED,
        EngagementRequestStatus.FULFILLED,
      ),
    ).toThrow(ValidationError);

    expect(() =>
      assertValidRequestTransition(
        EngagementRequestStatus.SUBMITTED,
        EngagementRequestStatus.UNDER_REVIEW,
      ),
    ).not.toThrow();
  });
});
