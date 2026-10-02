/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PrismaClient,
  CatalogItemCategory,
  PricingModel,
  EngagementRequestStatus,
  MembershipTier,
  MembershipStatus,
  UserType,
} from '@prisma/client';

import { AdminApproveRequestUseCase } from '../../../../src/modules/requests/application/admin-approve-request.usecase';
import { AdminListRequestsUseCase } from '../../../../src/modules/requests/application/admin-list-requests.usecase';
import { RequestNotificationService } from '../../../../src/modules/requests/application/services/request-notification.service';
import { emailProvider } from '../../../../src/shared/providers/email.provider';

const prisma = new PrismaClient();
jest.setTimeout(30000);

describe('Malicious Input & Boundary Stress Tests', () => {
  let approveUseCase: AdminApproveRequestUseCase;
  let listUseCase: AdminListRequestsUseCase;
  let notificationSvc: RequestNotificationService;

  let testUser: any;
  let testMember: any;
  let testCatalogItem: any;

  beforeAll(async () => {
    notificationSvc = new RequestNotificationService(prisma, emailProvider);
    approveUseCase = new AdminApproveRequestUseCase(prisma, notificationSvc);
    listUseCase = new AdminListRequestsUseCase(prisma);

    const uniqueSuffix = Date.now().toString();

    testUser = await prisma.user.create({
      data: {
        email: `bound-test-${uniqueSuffix}@example.com`,
        emailNormalized: `bound-test-${uniqueSuffix}@example.com`,
        passwordHash: 'dummy',
        userType: UserType.MEMBER,
      },
    });

    testMember = await prisma.member.create({
      data: {
        userId: testUser.id,
        fullNameEn: 'Boundary Test Member',
        fullNameAr: 'Boundary Test Member Ar',
        phone: `+1${uniqueSuffix.slice(-9)}`,
        phoneNormalized: `+1${uniqueSuffix.slice(-9)}`,
        country: 'EG',
        yearsOfExperience: '5',
      },
    });

    testCatalogItem = await prisma.catalogItem.create({
      data: {
        slug: `bound-item-${uniqueSuffix}`,
        nameEn: 'Bound Item',
        nameAr: 'Bound Item Ar',
        category: CatalogItemCategory.CORE_SERVICE,
        pricingModel: PricingModel.FIXED,
        basePrice: 500,
        isActive: true,
      },
    });
  }, 30000);

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({ where: { actorId: testUser.id } });
    await prisma.notification.deleteMany({ where: { userId: testUser.id } });
    await prisma.engagementRequest.deleteMany({ where: { memberId: testMember.id } });
    await prisma.catalogItem.delete({ where: { id: testCatalogItem.id } });
    await prisma.member.delete({ where: { id: testMember.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });

  it('1. 32-bit Integer Overflow Fuzzing (Testing A.4)', async () => {
    // We try to pass large values via usecase validation layers if they have it
    // Wait, the Zod validation is at the controller layer!
    // But we added some validation at the UseCase layer in admin-approve for basePrice, right?

    // We can just simulate the large numbers
    const newReq = await prisma.engagementRequest.create({
      data: {
        referenceCode: `REQ-OVR-${Date.now()}`,
        memberId: testMember.id,
        catalogItemId: testCatalogItem.id,
        status: EngagementRequestStatus.UNDER_REVIEW,
        category: CatalogItemCategory.CORE_SERVICE,
        pricingModel: PricingModel.FIXED,
        basePrice: 500,
        currency: 'USD',
        tierAtRequest: MembershipTier.ESSENTIAL,
        membershipStatusAtRequest: MembershipStatus.ACTIVE,
      },
    });

    await expect(
      approveUseCase.execute(
        newReq.id,
        { baseAmount: 2147483648 },
        { userId: 'admin', staffRole: 'ADMIN' },
      ),
    ).rejects.toThrow(/INT4/i);

    await prisma.engagementRequest.delete({ where: { id: newReq.id } });
  });

  it('2. Payload Size & Memory Bloat (Testing A.7 & D.3)', async () => {
    // Create a request with a very large brief directly in DB to see if list usecase strips it
    const newReq = await prisma.engagementRequest.create({
      data: {
        referenceCode: `REQ-BLT-${Date.now()}`,
        memberId: testMember.id,
        catalogItemId: testCatalogItem.id,
        status: EngagementRequestStatus.SUBMITTED,
        category: CatalogItemCategory.CORE_SERVICE,
        pricingModel: PricingModel.FIXED,
        basePrice: 500,
        currency: 'USD',
        tierAtRequest: MembershipTier.ESSENTIAL,
        membershipStatusAtRequest: MembershipStatus.ACTIVE,
        brief: { massivePayload: 'A'.repeat(50000) }, // 50KB payload
        adminNotes: 'A'.repeat(50000),
      },
    });

    // Run list usecase
    const result = await listUseCase.execute({});

    // Find our request
    const retrieved = result.requests.find((r) => r.id === newReq.id) as any;
    expect(retrieved).toBeDefined();

    // Verify 'brief' and 'adminNotes' are missing
    expect(retrieved.brief).toBeUndefined();
    expect(retrieved.adminNotes).toBeUndefined();

    await prisma.engagementRequest.delete({ where: { id: newReq.id } });
  });

  it('3. Transactional Integrity & Notification Failure Test (Testing B.7)', async () => {
    // Setup request
    const newReq = await prisma.engagementRequest.create({
      data: {
        referenceCode: `REQ-TX-${Date.now()}`,
        memberId: testMember.id,
        catalogItemId: testCatalogItem.id,
        status: EngagementRequestStatus.UNDER_REVIEW,
        category: CatalogItemCategory.CORE_SERVICE,
        pricingModel: PricingModel.FIXED,
        basePrice: 500,
        currency: 'USD',
        tierAtRequest: MembershipTier.ESSENTIAL,
        membershipStatusAtRequest: MembershipStatus.ACTIVE,
      },
    });

    // Mock SMTP Failure
    const originalSendEmail = emailProvider.sendEmail;
    let didThrowSMTP = false;
    emailProvider.sendEmail = jest.fn().mockImplementation(() => {
      didThrowSMTP = true;
      return Promise.reject(new Error('SMTP connection timed out'));
    });

    // Execute approval
    const res = await approveUseCase.execute(
      newReq.id,
      { baseAmount: 500 },
      { userId: 'admin', staffRole: 'ADMIN' },
    );

    // Wait for the async email failure to resolve since it's fire-and-forget
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(res.status).toBe(EngagementRequestStatus.AWAITING_PAYMENT);
    expect(didThrowSMTP).toBe(true);

    // Verify DB Notification exists
    const notifs = await prisma.notification.findMany({
      where: { userId: testMember.userId },
    });
    expect(notifs.length).toBeGreaterThan(0);

    // Restore mock
    emailProvider.sendEmail = originalSendEmail;
    await prisma.engagementRequest.delete({ where: { id: newReq.id } });
  });
});
