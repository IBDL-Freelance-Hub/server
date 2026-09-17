import crypto from 'crypto';
import { MembershipTier } from '@prisma/client';

export type PaymentSimulationStatus = 'SUCCESSFUL' | 'PENDING' | 'DECLINED';

export interface ProcessPaymentInput {
  memberId: string;
  userId: string;
  amount: number;
  currency?: string;
  targetTier: MembershipTier;
  paymentMethodToken?: string;
  simulationOutcome?: 'SUCCESS' | 'FAIL' | 'PENDING';
}

export interface PaymentTransactionResult {
  transactionId: string;
  status: PaymentSimulationStatus;
  amount: number;
  currency: string;
  timestamp: Date;
  failureReason?: string;
}

export class PaymentSimulatorService {
  /**
   * Simulates processing a sandbox payment (PAY-01 to PAY-12).
   */
  async processPayment(input: ProcessPaymentInput): Promise<PaymentTransactionResult> {
    const transactionId = `txn_${crypto.randomUUID()}`;
    const timestamp = new Date();
    const currency = input.currency ?? 'USD';

    // Outcome determination based on sandbox parameters
    const isDeclined =
      input.simulationOutcome === 'FAIL' ||
      input.paymentMethodToken === 'mock-token-fail' ||
      input.paymentMethodToken === 'tok_declined';

    const isPending =
      input.simulationOutcome === 'PENDING' ||
      input.paymentMethodToken === 'mock-token-pending' ||
      input.paymentMethodToken === 'tok_pending';

    if (isDeclined) {
      return {
        transactionId,
        status: 'DECLINED',
        amount: input.amount,
        currency,
        timestamp,
        failureReason:
          'Payment transaction was declined by the issuing bank (insufficient funds or fraud check).',
      };
    }

    if (isPending) {
      return {
        transactionId,
        status: 'PENDING',
        amount: input.amount,
        currency,
        timestamp,
      };
    }

    // Default successful outcome
    return {
      transactionId,
      status: 'SUCCESSFUL',
      amount: input.amount,
      currency,
      timestamp,
    };
  }
}

export const paymentSimulatorService = new PaymentSimulatorService();
