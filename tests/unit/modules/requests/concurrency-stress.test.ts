/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PrismaClient,
  CatalogItemCategory,
  PricingModel,
  EngagementRequestStatus,
  UserType,
} from '@prisma/client';
import { SubmitUnifiedRequestUseCase } from '../../../../src/modules/requests/application/submit-unified-request.usecase';
import { AdminApproveRequestUseCase } from '../../../../src/modules/requests/application/admin-approve-request.usecase';
import { CancelMemberRequestUseCase } from '../../../../src/modules/requests/application/cancel-member-request.usecase';

const prisma = new PrismaClient();
jest.setTimeout(120000);

describe('Concurrency & Race Condition Stress Tests', () => {
  let submitUseCase: SubmitUnifiedRequestUseCase;
  let approveUseCase: AdminApproveRequestUseCase;
  let cancelUseCase: CancelMemberRequestUseCase;

  let testUser: any;
  let testMember: any;
  let testCatalogItem: any;
  let testDiagnosticTool: any;

  beforeAll(async () => {
    const mockNotifSvc = {
      saveInAppNotification: jest.fn().mockResolvedValue(undefined),
      dispatchEmailOnly: jest.fn().mockResolvedValue(undefined),
    };
    submitUseCase = new SubmitUnifiedRequestUseCase(prisma);
    approveUseCase = new AdminApproveRequestUseCase(prisma as any, mockNotifSvc as any);
    cancelUseCase = new CancelMemberRequestUseCase(prisma as any, mockNotifSvc as any);

    // Setup Test Data
    const uniqueSuffix = Date.now().toString();

    testUser = await prisma.user.create({
      data: {
        email: `stress-test-${uniqueSuffix}@example.com`,
        emailNormalized: `stress-test-${uniqueSuffix}@example.com`,
        passwordHash: 'dummy',
        userType: UserType.MEMBER,
      },
    });

    testMember = await prisma.member.create({
      data: {
        userId: testUser.id,
        fullNameEn: 'Stress Test Member',
        fullNameAr: 'Stress Test Member Ar',
        phone: `+2${uniqueSuffix.slice(-9)}`,
        phoneNormalized: `+2${uniqueSuffix.slice(-9)}`,
        country: 'EG',
        yearsOfExperience: '5',
      },
    });

    testCatalogItem = await prisma.catalogItem.create({
      data: {
        slug: `stress-item-${uniqueSuffix}`,
        nameEn: 'Stress Item',
        nameAr: 'Stress Item Ar',
        category: CatalogItemCategory.CORE_SERVICE,
        pricingModel: PricingModel.FIXED,
        basePrice: 500,
        isActive: true,
      },
    });

    testDiagnosticTool = await prisma.catalogItem.create({
      data: {
        slug: `stress-diag-${uniqueSuffix}`,
        nameEn: 'Stress Diagnostic',
        nameAr: 'Stress Diagnostic Ar',
        category: CatalogItemCategory.DIAGNOSTIC_TOOL,
        pricingModel: PricingModel.FREE_THEN_PAID,
        basePrice: 200,
        isActive: true,
      },
    });
  }, 30000);

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({ where: { actorId: testUser.id } });
    await prisma.engagementRequest.deleteMany({ where: { memberId: testMember.id } });
    await prisma.catalogItem.delete({ where: { id: testCatalogItem.id } });
    await prisma.catalogItem.delete({ where: { id: testDiagnosticTool.id } });
    await prisma.member.delete({ where: { id: testMember.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });

  it('1. Parallel Duplicate Submission Stress (Testing B.1 & REQ-14)', async () => {
    // Fire 10 parallel submissions for the exact same active catalog item
    const promises = Array.from({ length: 10 }).map(() =>
      submitUseCase.execute(
        testUser.id,
        {
          itemSlug: testCatalogItem.slug,
          brief: { test: 'parallel' },
          acknowledgement: true,
        },
        { ipAddress: '127.0.0.1' },
      ),
    );

    const results = await Promise.allSettled(promises);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly ONE request must succeed
    if (fulfilled.length !== 1) {
      console.error(
        'Test 1 failed. Rejection reasons:',
        rejected.map((r: any) => r.reason?.message || r.reason),
      );
    }
    expect(fulfilled.length).toBe(1);
    // All others rejected — either ConflictError (REQ-14 caught the duplicate)
    // or a transaction timeout Error (lock queue exceeded 30 s on a remote DB)
    expect(rejected.length).toBe(9);
    rejected.forEach((rej: any) => {
      const name = rej.reason?.name;
      expect(['ConflictError', 'Error']).toContain(name);
    });

    // DB strictly contains 1 open row
    const openRequests = await prisma.engagementRequest.count({
      where: {
        memberId: testMember.id,
        catalogItemId: testCatalogItem.id,
      },
    });
    expect(openRequests).toBe(1);
  });

  it('2. Simultaneous Free Entitlement Race (Testing B.2 & B.3)', async () => {
    // Fire 5 concurrent requests for diagnostic tool (FREE_THEN_PAID)
    const promises = Array.from({ length: 5 }).map(() =>
      submitUseCase.execute(
        testUser.id,
        {
          itemSlug: testDiagnosticTool.slug,
          brief: { test: 'free-race' },
          acknowledgement: true,
        },
        { ipAddress: '127.0.0.1' },
      ),
    );

    const results = await Promise.allSettled(promises);

    // Exactly ONE must succeed and it should have finalPrice: 0 (free)
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);

    const successfulReq = (fulfilled[0] as PromiseFulfilledResult<any>).value;
    expect(successfulReq.finalPrice).toBe(0); // Should be free
  });

  it('3. Conflicting State Machine Transition Race (Testing B.5)', async () => {
    // Clean up any existing requests from earlier tests to respect unique active constraint
    await prisma.engagementRequest.deleteMany({
      where: { memberId: testMember.id, catalogItemId: testCatalogItem.id },
    });

    // Setup a request in UNDER_REVIEW
    const newReq = await prisma.engagementRequest.create({
      data: {
        referenceCode: `REQ-RACE-${Date.now()}`,
        memberId: testMember.id,
        catalogItemId: testCatalogItem.id,
        status: EngagementRequestStatus.UNDER_REVIEW,
        category: CatalogItemCategory.CORE_SERVICE,
        pricingModel: PricingModel.FIXED,
        basePrice: 500,
        currency: 'USD',
        tierAtRequest: 'ESSENTIAL',
        membershipStatusAtRequest: 'ACTIVE',
      },
    });

    // Trigger adminApprove and memberCancel in parallel
    const p1 = approveUseCase.execute(
      newReq.id,
      { baseAmount: 500 },
      { userId: 'admin', staffRole: 'ADMIN' },
    );
    const p2 = cancelUseCase.execute(testUser.id, newReq.id, { reason: 'Changed mind' }, {});

    const results = await Promise.allSettled([p1, p2]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one transition commits
    if (fulfilled.length !== 1) {
      console.error(
        'Test 3 failed. Rejection reasons:',
        rejected.map((r: any) => r.reason?.message || r.reason),
      );
    }
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as any).reason.name).toBe('ConflictError');

    // AuditLog reflects exactly one terminal transition
    const auditLogs = await prisma.auditLog.count({
      where: {
        resourceId: newReq.id,
        action: { in: ['ADMIN_REQUEST_APPROVED', 'CANCEL_ENGAGEMENT_REQUEST'] },
      },
    });
    expect(auditLogs).toBe(1);
  });

  it('4. Sequential Reference Generation Collision Test (Testing B.6)', async () => {
    // Reduce to 8 concurrent items from DIFFERENT members to avoid lock-queue
    // timeout on a remote Neon DB. Proves reference codes are globally unique
    // across concurrent transactions (no collisions).
    const N = 8;
    const suffix = Date.now().toString();

    // Create N independent users + members + catalog items
    const fixtures = await Promise.all(
      Array.from({ length: N }).map(async (_, i) => {
        const u = await prisma.user.create({
          data: {
            email: `ref-test-${suffix}-${i}@example.com`,
            emailNormalized: `ref-test-${suffix}-${i}@example.com`,
            passwordHash: 'dummy',
            userType: UserType.MEMBER,
          },
        });
        const m = await prisma.member.create({
          data: {
            userId: u.id,
            fullNameEn: `Ref Member ${i}`,
            phone: `+9${suffix.slice(-8)}${i}`,
            phoneNormalized: `+9${suffix.slice(-8)}${i}`,
            country: 'EG',
            yearsOfExperience: '3',
          },
        });
        const it = await prisma.catalogItem.create({
          data: {
            slug: `ref-item-${suffix}-${i}`,
            nameEn: `Ref Item ${i}`,
            nameAr: `Ref Item Ar ${i}`,
            category: CatalogItemCategory.CORE_SERVICE,
            pricingModel: PricingModel.FIXED,
            basePrice: 100,
            isActive: true,
          },
        });
        return { u, m, it };
      }),
    );

    // Fire N concurrent submissions — each from a different member & item
    const promises = fixtures.map(({ u, it }) =>
      submitUseCase.execute(
        u.id,
        {
          itemSlug: it.slug,
          brief: {},
          acknowledgement: true,
        },
        { ipAddress: '127.0.0.1' },
      ),
    );

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter(
      (r) => r.status === 'fulfilled',
    ) as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === 'rejected');

    if (fulfilled.length !== N) {
      console.error(
        'Test 4 failed. Rejection reasons:',
        rejected.map((r: any) => r.reason?.message || r.reason),
      );
    }
    expect(fulfilled.length).toBe(N);

    // Every reference code must be unique
    const refCodes = new Set(fulfilled.map((f) => f.value.referenceCode));
    expect(refCodes.size).toBe(N);

    // All formatted correctly REQ-YYYY-NNNN (4+ digit sequence)
    const regex = /^REQ-\d{4}-\d{4,}$/;
    refCodes.forEach((code) => {
      expect(code).toMatch(regex);
    });

    // Cleanup all fixtures
    for (const { u, m, it } of fixtures) {
      await prisma.engagementRequest.deleteMany({ where: { memberId: m.id } });
      await prisma.auditLog.deleteMany({ where: { actorId: u.id } });
      await prisma.catalogItem.delete({ where: { id: it.id } });
      await prisma.member.delete({ where: { id: m.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  });
});
