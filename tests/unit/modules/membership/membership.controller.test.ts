import { Request, Response, NextFunction } from 'express';
import { MembershipController } from '../../../../src/modules/membership/presentation/membership.controller';
import { UpgradeMembershipUseCase } from '../../../../src/modules/membership/application/upgrade-membership.usecase';
import { GetMembershipTiersUseCase } from '../../../../src/modules/membership/application/get-membership-tiers.usecase';
import { MembershipTier, MembershipStatus } from '@prisma/client';
import { AuthenticationError } from '../../../../src/shared/errors';

describe('MembershipController Unit Tests (BRU-67, MEM-52, PAY-05)', () => {
  let controller: MembershipController;
  let mockUpgradeUseCase: jest.Mocked<UpgradeMembershipUseCase>;
  let mockGetTiersUseCase: jest.Mocked<GetMembershipTiersUseCase>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockUpgradeUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UpgradeMembershipUseCase>;

    mockGetTiersUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetMembershipTiersUseCase>;

    controller = new MembershipController(mockUpgradeUseCase, mockGetTiersUseCase);

    mockReq = {
      headers: {},
      socket: { remoteAddress: '127.0.0.1' } as unknown as Request['socket'],
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('POST /memberships/upgrade', () => {
    it('should return HTTP 402 with success: true and separate outstandingUpgradeAttempt when payment is DECLINED (BRU-67, MEM-52)', async () => {
      mockReq = {
        headers: {},
        user: {
          id: 'user-uuid-1',
          email: 'test@example.com',
          userType: 'MEMBER',
          status: 'ACTIVE',
        },
        body: {
          targetTier: MembershipTier.PROFESSIONAL,
          simulationOutcome: 'FAIL',
        },
        id: 'req-test-123',
        ip: '127.0.0.1',
      };

      const declinePayload = {
        success: true,
        paymentStatus: 'DECLINED' as const,
        transactionId: 'txn_9f8c12a4-5678-4abc-def0-123456789abc',
        failureReason:
          'Payment transaction was declined by the issuing bank (insufficient funds or fraud check).',
        membership: {
          id: 'membership-uuid-1',
          tier: MembershipTier.ESSENTIAL,
          status: MembershipStatus.ACTIVE,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2027-01-01T00:00:00.000Z'),
          price: 0,
        },
        outstandingUpgradeAttempt: {
          targetTier: MembershipTier.PROFESSIONAL,
          state: 'declined' as const,
          transactionRef: 'txn_9f8c12a4-5678-4abc-def0-123456789abc',
        },
        message:
          'Payment transaction was declined. Your active membership remains unchanged and unaffected.',
      };

      mockUpgradeUseCase.execute.mockResolvedValue(declinePayload);

      await controller.upgrade(mockReq as Request, mockRes as Response, mockNext);

      // Verify HTTP 402 Payment Required status code
      expect(mockRes.status).toHaveBeenCalledWith(402);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message:
          'Payment transaction was declined. Your active membership remains unchanged and unaffected.',
        data: expect.objectContaining({
          paymentStatus: 'DECLINED',
          failureReason:
            'Payment transaction was declined by the issuing bank (insufficient funds or fraud check).',
          membership: expect.objectContaining({
            tier: MembershipTier.ESSENTIAL,
            status: MembershipStatus.ACTIVE,
          }),
          outstandingUpgradeAttempt: {
            targetTier: MembershipTier.PROFESSIONAL,
            state: 'declined',
            transactionRef: 'txn_9f8c12a4-5678-4abc-def0-123456789abc',
          },
        }),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return HTTP 200 when upgrade succeeds', async () => {
      mockReq = {
        headers: {},
        user: {
          id: 'user-uuid-1',
          email: 'test@example.com',
          userType: 'MEMBER',
          status: 'ACTIVE',
        },
        body: {
          targetTier: MembershipTier.PROFESSIONAL,
          simulationOutcome: 'SUCCESS',
        },
        id: 'req-test-success',
        ip: '127.0.0.1',
      };

      const successPayload = {
        success: true,
        paymentStatus: 'SUCCESSFUL' as const,
        transactionId: 'txn_success_123',
        membership: {
          id: 'membership-uuid-1',
          tier: MembershipTier.PROFESSIONAL,
          status: MembershipStatus.ACTIVE,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2027-01-01T00:00:00.000Z'),
          price: 180,
        },
        message: 'Successfully upgraded to PROFESSIONAL membership.',
      };

      mockUpgradeUseCase.execute.mockResolvedValue(successPayload);

      await controller.upgrade(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: successPayload,
      });
    });

    it('should forward AuthenticationError if user is not authenticated', async () => {
      mockReq = {
        user: undefined,
        body: { targetTier: MembershipTier.PROFESSIONAL },
      };

      await controller.upgrade(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('GET /memberships/tiers', () => {
    it('should return HTTP 200 with tiers catalog', async () => {
      mockReq = {
        user: {
          id: 'user-uuid-1',
          email: 'test@example.com',
          userType: 'MEMBER',
          status: 'ACTIVE',
        },
      };

      const mockTiers = [
        {
          tier: MembershipTier.ESSENTIAL,
          name: 'Essential',
          isCurrentPlan: true,
          canUpgrade: false,
          annualFee: 0,
          currency: 'USD',
          memberRateDiscount: 15,
          coreHubServicesIncluded: false,
          freeEligibleToolsPerQuarter: 0,
          additionalPurchaseRate: 15,
          programmeAccreditationsIncluded: 0,
          freeTraineeCertificates: 0,
          trainerCertificationEligibility: false,
        },
        {
          tier: MembershipTier.PROFESSIONAL,
          name: 'Professional',
          isCurrentPlan: false,
          canUpgrade: true,
          annualFee: 180,
          currency: 'USD',
          memberRateDiscount: 30,
          coreHubServicesIncluded: false,
          freeEligibleToolsPerQuarter: 0,
          additionalPurchaseRate: 30,
          programmeAccreditationsIncluded: 1,
          freeTraineeCertificates: 20,
          trainerCertificationEligibility: false,
        },
      ];

      mockGetTiersUseCase.execute.mockResolvedValue(mockTiers);

      await controller.getTiers(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockTiers,
      });
    });
  });
});
