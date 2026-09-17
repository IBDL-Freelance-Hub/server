import { PrismaClient, MembershipTier, MembershipStatus } from '@prisma/client';
import { UpgradeMembershipUseCase } from '../../../../src/modules/membership/application/upgrade-membership.usecase';
import { PaymentSimulatorService } from '../../../../src/modules/membership/infrastructure/payment-simulator.service';
import { NotFoundError, BusinessRuleError } from '../../../../src/shared/errors';

describe('UpgradeMembershipUseCase Unit Tests (MEM-07 to MEM-18, PAY-01 to PAY-12, SEC-33)', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let paymentSimulator: PaymentSimulatorService;
  let useCase: UpgradeMembershipUseCase;

  const startDate = new Date('2026-01-01T00:00:00Z');
  const endDate = new Date('2027-01-01T00:00:00Z');

  const mockMember = {
    id: 'member-uuid-1',
    userId: 'user-uuid-1',
    memberships: [
      {
        id: 'membership-uuid-1',
        memberId: 'member-uuid-1',
        tier: MembershipTier.ESSENTIAL,
        status: MembershipStatus.ACTIVE,
        price: 0.0,
        startDate,
        endDate,
        createdAt: startDate,
        updatedAt: startDate,
      },
    ],
  };

  beforeEach(() => {
    mockPrisma = {
      member: {
        findUnique: jest.fn(),
      },
      membership: {
        update: jest.fn(),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb(mockPrisma);
      }),
    } as unknown as jest.Mocked<PrismaClient>;

    paymentSimulator = new PaymentSimulatorService();
    useCase = new UpgradeMembershipUseCase(mockPrisma, paymentSimulator);
  });

  describe('Successful Upgrades (PAY-08, SEC-33)', () => {
    it('should successfully upgrade from ESSENTIAL to PROFESSIONAL with server-determined price $180', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockMember);
      (mockPrisma.membership.update as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'membership-uuid-1',
          memberId: 'member-uuid-1',
          ...data,
        }),
      );
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-uuid-1' });

      const result = await useCase.execute(
        'user-uuid-1',
        {
          targetTier: MembershipTier.PROFESSIONAL,
          simulationOutcome: 'SUCCESS',
        },
        { ipAddress: '127.0.0.1', requestId: 'req-upgrade-1' },
      );

      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe('SUCCESSFUL');
      expect(result.membership?.tier).toBe(MembershipTier.PROFESSIONAL);
      expect(result.membership?.price).toBe(180.0);
      expect(result.transactionId).toMatch(/^txn_/);

      // Verify Prisma membership update called with 1 year extension and server price
      expect(mockPrisma.membership.update).toHaveBeenCalledWith({
        where: { id: 'membership-uuid-1' },
        data: expect.objectContaining({
          tier: MembershipTier.PROFESSIONAL,
          status: MembershipStatus.ACTIVE,
          price: 180.0,
        }),
      });

      // Verify AuditLog record written
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'user-uuid-1',
          actorRole: 'MEMBER',
          action: 'MEMBERSHIP_UPGRADED',
          resource: 'Membership',
          resourceId: 'membership-uuid-1',
          newState: expect.objectContaining({
            tier: MembershipTier.PROFESSIONAL,
            price: 180.0,
          }),
        }),
      });
    });

    it('should successfully upgrade from PROFESSIONAL to MASTER with server-determined price $380', async () => {
      const proMember = {
        ...mockMember,
        memberships: [
          {
            ...mockMember.memberships[0],
            tier: MembershipTier.PROFESSIONAL,
            price: 180.0,
          },
        ],
      };

      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(proMember);
      (mockPrisma.membership.update as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'membership-uuid-1',
          memberId: 'member-uuid-1',
          ...data,
        }),
      );
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-uuid-2' });

      const result = await useCase.execute('user-uuid-1', {
        targetTier: MembershipTier.MASTER,
        simulationOutcome: 'SUCCESS',
      });

      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe('SUCCESSFUL');
      expect(result.membership?.tier).toBe(MembershipTier.MASTER);
      expect(result.membership?.price).toBe(380.0);
      expect(mockPrisma.membership.update).toHaveBeenCalledWith({
        where: { id: 'membership-uuid-1' },
        data: expect.objectContaining({
          tier: MembershipTier.MASTER,
          price: 380.0,
        }),
      });
    });
  });

  describe('Resilient Membership Rule on Declined Payments (PAY-05, MEM-14)', () => {
    it('should preserve active membership untouched when payment is DECLINED', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockMember);
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-declined' });

      const result = await useCase.execute('user-uuid-1', {
        targetTier: MembershipTier.PROFESSIONAL,
        simulationOutcome: 'FAIL',
      });

      // 1. Return failure payload
      expect(result.success).toBe(false);
      expect(result.paymentStatus).toBe('DECLINED');
      expect(result.failureReason).toBeDefined();
      expect(result.transactionId).toMatch(/^txn_/);

      // 2. Untouched membership returned in payload
      expect(result.membership?.tier).toBe(MembershipTier.ESSENTIAL);
      expect(result.membership?.status).toBe(MembershipStatus.ACTIVE);

      // 3. CRITICAL: Database membership record was NOT updated or deleted
      expect(mockPrisma.membership.update).not.toHaveBeenCalled();
      expect(mockPrisma.membership.create).not.toHaveBeenCalled();

      // 4. AuditLog records PAYMENT_DECLINED
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'user-uuid-1',
          action: 'PAYMENT_DECLINED',
          resource: 'Membership',
        }),
      });
    });
  });

  describe('Pending Payment Outcome (PAY-08)', () => {
    it('should record pending transaction without altering current active membership benefits', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(mockMember);
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-pending' });

      const result = await useCase.execute('user-uuid-1', {
        targetTier: MembershipTier.PROFESSIONAL,
        simulationOutcome: 'PENDING',
      });

      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe('PENDING');
      expect(result.membership?.tier).toBe(MembershipTier.ESSENTIAL);
      expect(mockPrisma.membership.update).not.toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PAYMENT_PENDING',
        }),
      });
    });
  });

  describe('Tier Hierarchy & Validation Rules (MEM-07)', () => {
    it('should throw BusinessRuleError when attempting to upgrade to current tier (same tier)', async () => {
      const proMember = {
        ...mockMember,
        memberships: [
          {
            ...mockMember.memberships[0],
            tier: MembershipTier.PROFESSIONAL,
          },
        ],
      };
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(proMember);

      await expect(
        useCase.execute('user-uuid-1', {
          targetTier: MembershipTier.PROFESSIONAL,
        }),
      ).rejects.toThrow(BusinessRuleError);

      expect(mockPrisma.membership.update).not.toHaveBeenCalled();
    });

    it('should throw BusinessRuleError when attempting a downgrade (MASTER to PROFESSIONAL)', async () => {
      const masterMember = {
        ...mockMember,
        memberships: [
          {
            ...mockMember.memberships[0],
            tier: MembershipTier.MASTER,
          },
        ],
      };
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(masterMember);

      await expect(
        useCase.execute('user-uuid-1', {
          targetTier: MembershipTier.PROFESSIONAL,
        }),
      ).rejects.toThrow(BusinessRuleError);

      expect(mockPrisma.membership.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when member does not exist', async () => {
      (mockPrisma.member.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        useCase.execute('unknown-user', {
          targetTier: MembershipTier.PROFESSIONAL,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
