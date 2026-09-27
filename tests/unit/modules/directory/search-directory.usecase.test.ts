import { PrismaClient, MembershipTier, MembershipStatus, UserStatus } from '@prisma/client';
import { SearchDirectoryUseCase } from '../../../../src/modules/directory/application/search-directory.usecase';

describe('SearchDirectoryUseCase Unit Tests', () => {
  let mockPrisma: {
    member: {
      findMany: jest.Mock;
    };
  };
  let useCase: SearchDirectoryUseCase;

  function createMockMember(overrides: Record<string, unknown> = {}) {
    const defaultMember = {
      id: 'member-uuid-1',
      userId: 'user-uuid-1',
      fullNameEn: 'John Doe',
      fullNameAr: 'جون دو',
      phone: '+201012345678',
      phoneNormalized: '+201012345678',
      country: 'Egypt',
      city: 'Cairo',
      yearsOfExperience: '6-10',
      areasOfExpertise: ['Leadership', 'Management'],
      industriesServed: ['Banking', 'Tech'],
      languages: ['Arabic', 'English'],
      bioEn: 'Senior executive corporate trainer with 10+ years experience.',
      bioAr: 'مدرب تنفيذي معتمد بخبرة تزيد عن 10 سنوات.',
      photoFileId: 'photo-file-uuid',
      linkedinUrl: 'https://linkedin.com/in/johndoe',
      directoryOptIn: true,
      profileCompletionRate: 100,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      user: {
        id: 'user-uuid-1',
        email: 'john@example.com',
        userType: 'MEMBER',
        status: UserStatus.ACTIVE,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      memberships: [
        {
          id: 'mem-1',
          memberId: 'member-uuid-1',
          tier: MembershipTier.ESSENTIAL,
          status: MembershipStatus.ACTIVE,
          price: 0,
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: new Date('2027-01-01T00:00:00Z'),
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ],
      files: [
        {
          id: 'cv-1',
          ownerId: 'member-uuid-1',
          category: 'CV',
          status: 'ACTIVE',
          originalName: 'cv.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ],
    };

    return {
      ...defaultMember,
      ...overrides,
      user: overrides.user
        ? { ...defaultMember.user, ...(overrides.user as Record<string, unknown>) }
        : defaultMember.user,
      memberships:
        overrides.memberships !== undefined ? overrides.memberships : defaultMember.memberships,
      files: overrides.files !== undefined ? overrides.files : defaultMember.files,
    };
  }

  beforeEach(() => {
    mockPrisma = {
      member: {
        findMany: jest.fn(),
      },
    };
    useCase = new SearchDirectoryUseCase(mockPrisma as unknown as PrismaClient);
  });

  describe('Strict Eligibility Gating (PRO-34)', () => {
    it('should exclude members who have directoryOptIn: false', async () => {
      const optedOut = createMockMember({ id: 'm-opt-out', directoryOptIn: false });
      const optedIn = createMockMember({ id: 'm-opt-in', directoryOptIn: true });

      mockPrisma.member.findMany.mockResolvedValue([optedOut, optedIn]);

      const result = await useCase.execute({});

      expect(result.trainers).toHaveLength(1);
      expect(result.trainers[0]!.id).toBe('m-opt-in');
      expect(result.total).toBe(1);
    });

    it('should exclude members whose profile completion is < 100%', async () => {
      // Missing bioEn and bioAr drops canonical completion below 100%
      const incomplete = createMockMember({
        id: 'm-incomplete',
        bioEn: null,
        bioAr: null,
        profileCompletionRate: 80,
      });
      const complete = createMockMember({ id: 'm-complete' });

      mockPrisma.member.findMany.mockResolvedValue([incomplete, complete]);

      const result = await useCase.execute({});

      expect(result.trainers).toHaveLength(1);
      expect(result.trainers[0]!.id).toBe('m-complete');
      expect(result.total).toBe(1);
    });

    it('should exclude members with SUSPENDED, CANCELLED, or PENDING_PAYMENT memberships', async () => {
      const suspended = createMockMember({
        id: 'm-suspended',
        memberships: [{ tier: MembershipTier.MASTER, status: MembershipStatus.SUSPENDED }],
      });
      const cancelled = createMockMember({
        id: 'm-cancelled',
        memberships: [{ tier: MembershipTier.PROFESSIONAL, status: MembershipStatus.CANCELLED }],
      });
      const pendingPayment = createMockMember({
        id: 'm-pending',
        memberships: [{ tier: MembershipTier.MASTER, status: MembershipStatus.PENDING_PAYMENT }],
      });
      const active = createMockMember({
        id: 'm-active',
        memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
      });

      mockPrisma.member.findMany.mockResolvedValue([suspended, cancelled, pendingPayment, active]);

      const result = await useCase.execute({});

      expect(result.trainers).toHaveLength(1);
      expect(result.trainers[0]!.id).toBe('m-active');
    });

    it('should exclude members whose user status is not ACTIVE (e.g. UNACTIVATED, SUSPENDED, CLOSED)', async () => {
      const suspendedUser = createMockMember({
        id: 'm-suspended-user',
        user: { status: UserStatus.SUSPENDED },
      });
      const activeUser = createMockMember({
        id: 'm-active-user',
        user: { status: UserStatus.ACTIVE },
      });

      mockPrisma.member.findMany.mockResolvedValue([suspendedUser, activeUser]);

      const result = await useCase.execute({});

      expect(result.trainers).toHaveLength(1);
      expect(result.trainers[0]!.id).toBe('m-active-user');
    });

    it('should include ACTIVE, GRACE_PERIOD, and EXPIRED memberships with retained opt-in (MEM-33b, MEM-81)', async () => {
      const active = createMockMember({
        id: 'm-active',
        memberships: [{ tier: MembershipTier.MASTER, status: MembershipStatus.ACTIVE }],
      });
      const grace = createMockMember({
        id: 'm-grace',
        memberships: [{ tier: MembershipTier.PROFESSIONAL, status: MembershipStatus.GRACE_PERIOD }],
      });
      const expired = createMockMember({
        id: 'm-expired',
        memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.EXPIRED }],
      });

      mockPrisma.member.findMany.mockResolvedValue([active, grace, expired]);

      const result = await useCase.execute({});

      expect(result.trainers).toHaveLength(3);
      expect(result.total).toBe(3);
    });
  });

  describe('Tier Placement Precedence & Deterministic Ranking (PRO-45)', () => {
    it('should rank Master members first (PRIORITY), Professional second (FEATURED), and Essential third (STANDARD)', async () => {
      const essential = createMockMember({
        id: 'm-essential',
        fullNameEn: 'Essential Member',
        createdAt: new Date('2026-01-01'),
        memberships: [{ tier: MembershipTier.ESSENTIAL, status: MembershipStatus.ACTIVE }],
      });
      const professional = createMockMember({
        id: 'm-professional',
        fullNameEn: 'Professional Member',
        createdAt: new Date('2026-01-02'),
        memberships: [{ tier: MembershipTier.PROFESSIONAL, status: MembershipStatus.ACTIVE }],
      });
      const master = createMockMember({
        id: 'm-master',
        fullNameEn: 'Master Member',
        createdAt: new Date('2026-01-03'),
        memberships: [{ tier: MembershipTier.MASTER, status: MembershipStatus.ACTIVE }],
      });

      // Pass in reverse order from database
      mockPrisma.member.findMany.mockResolvedValue([essential, professional, master]);

      const result = await useCase.execute({});

      expect(result.trainers).toHaveLength(3);
      expect(result.trainers[0]!.id).toBe('m-master');
      expect(result.trainers[0]!.tier).toBe(MembershipTier.MASTER);
      expect(result.trainers[0]!.badgeType).toBe('PRIORITY');

      expect(result.trainers[1]!.id).toBe('m-professional');
      expect(result.trainers[1]!.tier).toBe(MembershipTier.PROFESSIONAL);
      expect(result.trainers[1]!.badgeType).toBe('FEATURED');

      expect(result.trainers[2]!.id).toBe('m-essential');
      expect(result.trainers[2]!.tier).toBe(MembershipTier.ESSENTIAL);
      expect(result.trainers[2]!.badgeType).toBe('STANDARD');
    });

    it('should break ties deterministically by member.createdAt DESC', async () => {
      const masterOlder = createMockMember({
        id: 'm-older',
        fullNameEn: 'Older Master',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        memberships: [{ tier: MembershipTier.MASTER, status: MembershipStatus.ACTIVE }],
      });
      const masterNewer = createMockMember({
        id: 'm-newer',
        fullNameEn: 'Newer Master',
        createdAt: new Date('2026-02-01T00:00:00Z'),
        memberships: [{ tier: MembershipTier.MASTER, status: MembershipStatus.ACTIVE }],
      });

      mockPrisma.member.findMany.mockResolvedValue([masterOlder, masterNewer]);

      const result = await useCase.execute({});

      expect(result.trainers[0]!.id).toBe('m-newer');
      expect(result.trainers[1]!.id).toBe('m-older');
    });

    it('should assign standard placement (STANDARD, weight 1) to GRACE_PERIOD and EXPIRED members', async () => {
      const activeMaster = createMockMember({
        id: 'm-active-master',
        memberships: [{ tier: MembershipTier.MASTER, status: MembershipStatus.ACTIVE }],
      });
      const graceMaster = createMockMember({
        id: 'm-grace-master',
        memberships: [{ tier: MembershipTier.MASTER, status: MembershipStatus.GRACE_PERIOD }],
      });

      mockPrisma.member.findMany.mockResolvedValue([graceMaster, activeMaster]);

      const result = await useCase.execute({});

      expect(result.trainers[0]!.id).toBe('m-active-master');
      expect(result.trainers[0]!.badgeType).toBe('PRIORITY');

      expect(result.trainers[1]!.id).toBe('m-grace-master');
      expect(result.trainers[1]!.badgeType).toBe('STANDARD');
    });
  });

  describe('Data Privacy & Leak Prevention (PRO-38, DIR-18)', () => {
    it('should strictly omit email, phone, cvUrl, userId, and internal files from public DTO', async () => {
      const mock = createMockMember({
        id: 'm-privacy',
        fullNameEn: 'Dr. Jane Smith',
        phone: '+201122334455',
        photoFileId: 'photo-uuid-999',
      });

      mockPrisma.member.findMany.mockResolvedValue([mock]);

      const result = await useCase.execute({});
      const trainer = result.trainers[0] as unknown as Record<string, unknown>;

      // Confidential fields must be undefined
      expect(trainer.email).toBeUndefined();
      expect(trainer.phone).toBeUndefined();
      expect(trainer.phoneNormalized).toBeUndefined();
      expect(trainer.cvUrl).toBeUndefined();
      expect(trainer.userId).toBeUndefined();
      expect(trainer.files).toBeUndefined();
      expect(trainer.user).toBeUndefined();

      // Exposed public fields must be populated
      expect(trainer.id).toBe('m-privacy');
      expect(trainer.slug).toBe('dr-jane-smith');
      expect(trainer.firstName).toBe('Dr.');
      expect(trainer.lastName).toBe('Jane Smith');
      expect(trainer.photoUrl).toBe('/api/v1/files/photo-uuid-999/download');
      expect(trainer.country).toBe('Egypt');
      expect(trainer.city).toBe('Cairo');
      expect(trainer.tier).toBe(MembershipTier.ESSENTIAL);
      expect(trainer.badgeType).toBe('STANDARD');
    });
  });

  describe('Filtering and Pagination', () => {
    it('should filter by search term matching first name, last name, or bio', async () => {
      const matchName = createMockMember({ id: 'm-1', fullNameEn: 'Sarah Connor' });
      const matchBio = createMockMember({
        id: 'm-2',
        fullNameEn: 'Alex Stone',
        bioEn: 'Specializes in Cybernetics and AI safety.',
      });
      const noMatch = createMockMember({
        id: 'm-3',
        fullNameEn: 'Bob Smith',
        bioEn: 'General retail training.',
      });

      mockPrisma.member.findMany.mockResolvedValue([matchName, matchBio, noMatch]);

      const result = await useCase.execute({ search: 'Cybernetics' });

      expect(result.trainers).toHaveLength(1);
      expect(result.trainers[0]!.id).toBe('m-2');
    });

    it('should correctly paginate results with page and limit', async () => {
      const members = [
        createMockMember({ id: 'm-1', createdAt: new Date('2026-01-05') }),
        createMockMember({ id: 'm-2', createdAt: new Date('2026-01-04') }),
        createMockMember({ id: 'm-3', createdAt: new Date('2026-01-03') }),
        createMockMember({ id: 'm-4', createdAt: new Date('2026-01-02') }),
        createMockMember({ id: 'm-5', createdAt: new Date('2026-01-01') }),
      ];

      mockPrisma.member.findMany.mockResolvedValue(members);

      const page1 = await useCase.execute({ page: 1, limit: 2 });
      expect(page1.trainers).toHaveLength(2);
      expect(page1.trainers[0]!.id).toBe('m-1');
      expect(page1.trainers[1]!.id).toBe('m-2');
      expect(page1.total).toBe(5);
      expect(page1.page).toBe(1);
      expect(page1.totalPages).toBe(3);

      const page2 = await useCase.execute({ page: 2, limit: 2 });
      expect(page2.trainers).toHaveLength(2);
      expect(page2.trainers[0]!.id).toBe('m-3');
      expect(page2.trainers[1]!.id).toBe('m-4');

      const page3 = await useCase.execute({ page: 3, limit: 2 });
      expect(page3.trainers).toHaveLength(1);
      expect(page3.trainers[0]!.id).toBe('m-5');
    });
  });
});
