/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PrismaClient,
  CatalogItemCategory,
  PricingModel,
  EngagementRequestStatus,
  UserType,
  PaymentMethod,
  StaffRole,
  MembershipTier,
  MembershipStatus,
} from '@prisma/client';
import {
  formatSequentialInvoiceNumber,
  isValidInvoiceNumber,
  parseInvoiceSequence,
  generateAtomicInvoiceNumber,
} from '../../../../src/modules/transactions/domain/invoice-reference';
import { RecordTransactionUseCase } from '../../../../src/modules/transactions/application/record-transaction.usecase';
import { ListTransactionsUseCase } from '../../../../src/modules/transactions/application/list-transactions.usecase';
import { GetTransactionByInvoiceUseCase } from '../../../../src/modules/transactions/application/get-transaction-by-invoice.usecase';
import { AdminMarkPaidUseCase } from '../../../../src/modules/requests/application/admin-mark-paid.usecase';
import { PayMemberRequestUseCase } from '../../../../src/modules/requests/application/pay-member-request.usecase';
import { ValidationError, NotFoundError } from '../../../../src/shared/errors';

const prisma = new PrismaClient();
jest.setTimeout(60000);

describe('Transactions & Invoicing Ledger Module', () => {
  let recordTxUseCase: RecordTransactionUseCase;
  let listTxUseCase: ListTransactionsUseCase;
  let getTxUseCase: GetTransactionByInvoiceUseCase;
  let adminMarkPaidUseCase: AdminMarkPaidUseCase;
  let payMemberRequestUseCase: PayMemberRequestUseCase;

  let testUserA: any;
  let testMemberA: any;
  let testUserB: any;
  let testMemberB: any;
  let testStaffUser: any;
  let testCatalogItem: any;
  let testCatalogItem2: any;
  const createdTxIds: string[] = [];
  const createdRequestIds: string[] = [];

  const mockNotifSvc = {
    saveInAppNotification: jest.fn().mockResolvedValue(undefined),
    dispatchEmailOnly: jest.fn().mockResolvedValue(undefined),
    dispatchNotification: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    recordTxUseCase = new RecordTransactionUseCase(prisma);
    listTxUseCase = new ListTransactionsUseCase(prisma);
    getTxUseCase = new GetTransactionByInvoiceUseCase(prisma);
    adminMarkPaidUseCase = new AdminMarkPaidUseCase(prisma, mockNotifSvc as any);
    payMemberRequestUseCase = new PayMemberRequestUseCase(prisma, mockNotifSvc as any);

    const suffix = Date.now().toString();

    // User A (Member)
    testUserA = await prisma.user.create({
      data: {
        email: `tx-user-a-${suffix}@example.com`,
        emailNormalized: `tx-user-a-${suffix}@example.com`,
        passwordHash: 'dummy',
        userType: UserType.MEMBER,
      },
    });

    testMemberA = await prisma.member.create({
      data: {
        userId: testUserA.id,
        fullNameEn: 'Transaction Member A',
        phone: `+1${suffix.slice(-9)}`,
        phoneNormalized: `+1${suffix.slice(-9)}`,
        country: 'EG',
        yearsOfExperience: '5',
      },
    });

    // User B (Member)
    testUserB = await prisma.user.create({
      data: {
        email: `tx-user-b-${suffix}@example.com`,
        emailNormalized: `tx-user-b-${suffix}@example.com`,
        passwordHash: 'dummy',
        userType: UserType.MEMBER,
      },
    });

    testMemberB = await prisma.member.create({
      data: {
        userId: testUserB.id,
        fullNameEn: 'Transaction Member B',
        phone: `+2${suffix.slice(-9)}`,
        phoneNormalized: `+2${suffix.slice(-9)}`,
        country: 'EG',
        yearsOfExperience: '3',
      },
    });

    // Staff User (Finance Officer)
    testStaffUser = await prisma.user.create({
      data: {
        email: `tx-staff-${suffix}@example.com`,
        emailNormalized: `tx-staff-${suffix}@example.com`,
        passwordHash: 'dummy',
        userType: UserType.STAFF,
      },
    });

    await prisma.staff.create({
      data: {
        userId: testStaffUser.id,
        role: StaffRole.FINANCE_OFFICER,
      },
    });

    // Catalog Items
    testCatalogItem = await prisma.catalogItem.create({
      data: {
        slug: `tx-item-${suffix}`,
        nameEn: 'Transaction Test Service',
        nameAr: 'خدمة اختبار الفواتير',
        category: CatalogItemCategory.CORE_SERVICE,
        pricingModel: PricingModel.FIXED,
        basePrice: 150.0,
        isActive: true,
      },
    });

    testCatalogItem2 = await prisma.catalogItem.create({
      data: {
        slug: `tx-item-2-${suffix}`,
        nameEn: 'Transaction Test Service 2',
        nameAr: 'خدمة اختبار الفواتير 2',
        category: CatalogItemCategory.CORE_SERVICE,
        pricingModel: PricingModel.FIXED,
        basePrice: 150.0,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    const userIds = [testUserA?.id, testUserB?.id, testStaffUser?.id].filter(Boolean);
    const memberIds = [testMemberA?.id, testMemberB?.id].filter(Boolean);

    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: userIds } },
          { resourceId: { in: createdRequestIds } },
          { resourceId: { in: createdTxIds } },
        ],
      },
    });

    await prisma.transaction.deleteMany({
      where: {
        OR: [{ id: { in: createdTxIds } }, { userId: { in: userIds } }],
      },
    });

    await prisma.engagementRequest.deleteMany({
      where: {
        OR: [{ id: { in: createdRequestIds } }, { memberId: { in: memberIds } }],
      },
    });

    if (testCatalogItem) {
      await prisma.catalogItem.delete({ where: { id: testCatalogItem.id } }).catch(() => {});
    }
    if (testCatalogItem2) {
      await prisma.catalogItem.delete({ where: { id: testCatalogItem2.id } }).catch(() => {});
    }

    if (testStaffUser) {
      await prisma.staff.deleteMany({ where: { userId: testStaffUser.id } });
      await prisma.user.delete({ where: { id: testStaffUser.id } }).catch(() => {});
    }

    if (testMemberA) {
      await prisma.member.delete({ where: { id: testMemberA.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUserA.id } }).catch(() => {});
    }

    if (testMemberB) {
      await prisma.member.delete({ where: { id: testMemberB.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUserB.id } }).catch(() => {});
    }

    await prisma.$disconnect();
  });

  describe('1. Domain: Invoice Reference Generation', () => {
    it('should format sequential invoice numbers with 5-digit zero padding', () => {
      expect(formatSequentialInvoiceNumber(2026, 1)).toBe('INV-2026-00001');
      expect(formatSequentialInvoiceNumber(2026, 42)).toBe('INV-2026-00042');
      expect(formatSequentialInvoiceNumber(2026, 10000)).toBe('INV-2026-10000');
    });

    it('should validate canonical invoice numbers correctly', () => {
      expect(isValidInvoiceNumber('INV-2026-00001')).toBe(true);
      expect(isValidInvoiceNumber('INV-2026-999999')).toBe(true);
      expect(isValidInvoiceNumber('INV-26-0001')).toBe(false);
      expect(isValidInvoiceNumber('REQ-2026-0001')).toBe(false);
      expect(isValidInvoiceNumber('')).toBe(false);
    });

    it('should parse year and sequence from invoice number', () => {
      const parsed = parseInvoiceSequence('INV-2026-00123');
      expect(parsed).toEqual({ year: 2026, sequence: 123 });
      expect(parseInvoiceSequence('INVALID')).toBeNull();
    });

    it('should generate monotonic atomic sequence numbers in PostgreSQL', async () => {
      const inv1 = await generateAtomicInvoiceNumber(prisma);
      const inv2 = await generateAtomicInvoiceNumber(prisma);
      const p1 = parseInvoiceSequence(inv1);
      const p2 = parseInvoiceSequence(inv2);

      expect(p1).not.toBeNull();
      expect(p2).not.toBeNull();
      expect(p2!.sequence).toBe(p1!.sequence + 1);
    });
  });

  describe('2. Application: RecordTransactionUseCase', () => {
    it('should reject negative amountCents', async () => {
      await expect(
        recordTxUseCase.execute({
          userId: testUserA.id,
          sourceType: 'REQUEST',
          sourceId: 'req-1',
          amountCents: -500,
          paymentReference: 'REF-NEG',
          billingDetails: {},
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject empty paymentReference', async () => {
      await expect(
        recordTxUseCase.execute({
          userId: testUserA.id,
          sourceType: 'REQUEST',
          sourceId: 'req-1',
          amountCents: 5000,
          paymentReference: '   ',
          billingDetails: {},
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should atomically record a transaction and emit audit log', async () => {
      const ref = `PAY-TEST-${Date.now()}`;
      const result = await recordTxUseCase.execute({
        userId: testUserA.id,
        sourceType: 'REQUEST',
        sourceId: 'test-source-id',
        amountCents: 15000,
        currency: 'USD',
        paymentMethod: PaymentMethod.ADMIN_MANUAL,
        paymentReference: ref,
        billingDetails: {
          memberName: 'Transaction Member A',
          itemTitle: 'Transaction Test Service',
          finalPrice: 150.0,
        },
      });

      createdTxIds.push(result.id);

      expect(result.id).toBeDefined();
      expect(result.invoiceNumber).toMatch(/^INV-\d{4}-\d{5,}$/);
      expect(result.status).toBe('PAID');
      expect(result.isIdempotent).toBe(false);

      // Verify AuditLog was created
      const audit = await prisma.auditLog.findFirst({
        where: {
          resource: 'Transaction',
          resourceId: result.id,
          action: 'TRANSACTION_RECORDED',
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorId).toBe(testUserA.id);
    });

    it('should enforce idempotency when same paymentReference is recorded again', async () => {
      const ref = `PAY-IDEM-${Date.now()}`;
      const first = await recordTxUseCase.execute({
        userId: testUserA.id,
        sourceType: 'REQUEST',
        sourceId: 'req-idem-1',
        amountCents: 5000,
        paymentReference: ref,
        billingDetails: { test: true },
      });
      createdTxIds.push(first.id);

      const second = await recordTxUseCase.execute({
        userId: testUserA.id,
        sourceType: 'REQUEST',
        sourceId: 'req-idem-1',
        amountCents: 5000,
        paymentReference: ref,
        billingDetails: { test: true },
      });

      expect(second.id).toBe(first.id);
      expect(second.invoiceNumber).toBe(first.invoiceNumber);
      expect(second.isIdempotent).toBe(true);
    });
  });

  describe('3. Application: List & Get Transactions with Tenant Isolation', () => {
    let txAId: string;
    let txBId: string;
    let invA: string;
    let invB: string;

    beforeAll(async () => {
      const refA = `PAY-ISO-A-${Date.now()}`;
      const resA = await recordTxUseCase.execute({
        userId: testUserA.id,
        sourceType: 'REQUEST',
        sourceId: 'req-iso-a',
        amountCents: 7500,
        paymentReference: refA,
        billingDetails: { owner: 'A' },
      });
      createdTxIds.push(resA.id);
      txAId = resA.id;
      invA = resA.invoiceNumber;

      const refB = `PAY-ISO-B-${Date.now()}`;
      const resB = await recordTxUseCase.execute({
        userId: testUserB.id,
        sourceType: 'REQUEST',
        sourceId: 'req-iso-b',
        amountCents: 9000,
        paymentReference: refB,
        billingDetails: { owner: 'B' },
      });
      createdTxIds.push(resB.id);
      txBId = resB.id;
      invB = resB.invoiceNumber;
    });

    it('Member A should only see their own transactions in listTransactions', async () => {
      const result = await listTxUseCase.execute({
        requesterUserId: testUserA.id,
        isStaff: false,
      });

      const userIds = result.items.map((i) => i.userId);
      expect(userIds.every((uid) => uid === testUserA.id)).toBe(true);
      expect(result.items.some((i) => i.id === txAId)).toBe(true);
      expect(result.items.some((i) => i.id === txBId)).toBe(false);
    });

    it('Staff can view transactions across all users and filter by targetUserId', async () => {
      const allResult = await listTxUseCase.execute({
        requesterUserId: testStaffUser.id,
        isStaff: true,
      });
      expect(allResult.items.some((i) => i.id === txAId)).toBe(true);
      expect(allResult.items.some((i) => i.id === txBId)).toBe(true);

      const filteredResult = await listTxUseCase.execute({
        requesterUserId: testStaffUser.id,
        isStaff: true,
        targetUserId: testUserB.id,
      });
      expect(filteredResult.items.every((i) => i.userId === testUserB.id)).toBe(true);
      expect(filteredResult.items.some((i) => i.id === txBId)).toBe(true);
      expect(filteredResult.items.some((i) => i.id === txAId)).toBe(false);
    });

    it('Member A cannot view Member B invoice via GetTransactionByInvoice (Tenant Isolation)', async () => {
      // Member A viewing Member A invoice -> OK
      const myInvoice = await getTxUseCase.execute({
        invoiceNumber: invA,
        requesterUserId: testUserA.id,
        isStaff: false,
      });
      expect(myInvoice.id).toBe(txAId);
      expect(myInvoice.invoiceNumber).toBe(invA);

      // Member A attempting to view Member B invoice -> NotFoundError (no leakage)
      await expect(
        getTxUseCase.execute({
          invoiceNumber: invB,
          requesterUserId: testUserA.id,
          isStaff: false,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('Staff can view any invoice via GetTransactionByInvoice', async () => {
      const invoiceA = await getTxUseCase.execute({
        invoiceNumber: invA,
        requesterUserId: testStaffUser.id,
        isStaff: true,
      });
      expect(invoiceA.id).toBe(txAId);

      const invoiceB = await getTxUseCase.execute({
        invoiceNumber: invB,
        requesterUserId: testStaffUser.id,
        isStaff: true,
      });
      expect(invoiceB.id).toBe(txBId);
    });
  });

  describe('4. Integration: AdminMarkPaid records polymorphic transaction', () => {
    it('should create an invoice in the transaction ledger when admin marks paid', async () => {
      const suffix = Date.now().toString();
      const refCode = `REQ-2026-${suffix.slice(-4)}`;

      // Create an engagement request in AWAITING_PAYMENT
      const req = await prisma.engagementRequest.create({
        data: {
          referenceCode: refCode,
          memberId: testMemberA.id,
          catalogItemId: testCatalogItem.id,
          status: EngagementRequestStatus.AWAITING_PAYMENT,
          category: CatalogItemCategory.CORE_SERVICE,
          tierAtRequest: MembershipTier.ESSENTIAL,
          membershipStatusAtRequest: MembershipStatus.ACTIVE,
          basePrice: 150.0,
          discountPercentage: 0,
          finalPrice: 150.0,
          currency: 'USD',
        },
      });
      createdRequestIds.push(req.id);

      const paymentRef = `BANK-${suffix}`;
      const result = await adminMarkPaidUseCase.execute(
        req.id,
        { paymentRef, adminNotes: 'Bank transfer received via HSBC' },
        {
          userId: testStaffUser.id,
          staffRole: StaffRole.FINANCE_OFFICER,
          ipAddress: '127.0.0.1',
          requestId: 'test-admin-pay',
        },
      );

      expect(result.status).toBe(EngagementRequestStatus.PAYMENT_CONFIRMED);
      expect(result.paymentReference).toBe(paymentRef);
      expect(result.invoiceNumber).toBeDefined();
      expect(result.invoiceNumber).toMatch(/^INV-\d{4}-\d{5,}$/);

      // Verify Transaction row exists
      const tx = await prisma.transaction.findUnique({
        where: { paymentReference: paymentRef },
      });
      expect(tx).not.toBeNull();
      createdTxIds.push(tx!.id);
      expect(tx?.invoiceNumber).toBe(result.invoiceNumber);
      expect(tx?.amountCents).toBe(15000);
      expect(tx?.sourceType).toBe('REQUEST');
      expect(tx?.sourceId).toBe(req.id);
      expect(tx?.paymentMethod).toBe(PaymentMethod.ADMIN_MANUAL);

      // Idempotency: marking again returns the same invoice
      const idempotentResult = await adminMarkPaidUseCase.execute(
        req.id,
        { paymentRef },
        {
          userId: testStaffUser.id,
          staffRole: StaffRole.FINANCE_OFFICER,
          ipAddress: '127.0.0.1',
          requestId: 'test-admin-pay-2',
        },
      );
      expect(idempotentResult.isIdempotent).toBe(true);
      expect(idempotentResult.invoiceNumber).toBe(result.invoiceNumber);
    });
  });

  describe('5. Integration: Member Pay Request records transaction via simulated gateway', () => {
    it('should allow member to pay awaiting_payment request and record transaction', async () => {
      const suffix = Date.now().toString();
      const refCode = `REQ-2026-${suffix.slice(-4)}`;

      // Create request in AWAITING_PAYMENT for Member A
      const req = await prisma.engagementRequest.create({
        data: {
          referenceCode: refCode,
          memberId: testMemberA.id,
          catalogItemId: testCatalogItem2.id,
          status: EngagementRequestStatus.AWAITING_PAYMENT,
          category: CatalogItemCategory.CORE_SERVICE,
          tierAtRequest: MembershipTier.ESSENTIAL,
          membershipStatusAtRequest: MembershipStatus.ACTIVE,
          basePrice: 150.0,
          discountPercentage: 0,
          finalPrice: 150.0,
          currency: 'USD',
        },
      });
      createdRequestIds.push(req.id);

      // Member B trying to pay Member A request -> NotFoundError
      await expect(payMemberRequestUseCase.execute(testUserB.id, req.id, {})).rejects.toThrow(
        NotFoundError,
      );

      // Member A paying -> Success
      const payResult = await payMemberRequestUseCase.execute(testUserA.id, req.id, {});
      expect(payResult.status).toBe(EngagementRequestStatus.PAYMENT_CONFIRMED);
      expect(payResult.paymentReference).toMatch(/^PAY-SIM-/);
      expect(payResult.invoiceNumber).toMatch(/^INV-\d{4}-\d{5,}$/);

      // Verify transaction ledger
      const tx = await prisma.transaction.findUnique({
        where: { paymentReference: payResult.paymentReference },
      });
      expect(tx).not.toBeNull();
      createdTxIds.push(tx!.id);
      expect(tx?.amountCents).toBe(15000);
      expect(tx?.paymentMethod).toBe(PaymentMethod.SIMULATED_GATEWAY);
      expect(tx?.userId).toBe(testUserA.id);

      // Idempotency: paying again returns existing invoice
      const payAgain = await payMemberRequestUseCase.execute(testUserA.id, req.id, {});
      expect(payAgain.isIdempotent).toBe(true);
      expect(payAgain.invoiceNumber).toBe(payResult.invoiceNumber);
    });
  });
});
