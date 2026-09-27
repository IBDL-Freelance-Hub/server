import { PrismaClient, MembershipTier, MembershipStatus, UserStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import { calculateProfileCompletion } from '../../members/domain';
import {
  PublicTrainerProfile,
  generateTrainerSlug,
  parseTrainerName,
  getTierBadgeAndWeight,
} from '../domain';

export class GetPublicTrainerProfileUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(slugOrId: string): Promise<PublicTrainerProfile> {
    const trimmed = (slugOrId || '').trim();
    if (!trimmed) {
      throw new NotFoundError('Trainer profile not found');
    }

    // 1. Direct ID lookup first (supports UUID and direct IDs)
    let member = await this.prisma.member
      .findUnique({
        where: { id: trimmed },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              userType: true,
              status: true,
              createdAt: true,
            },
          },
          memberships: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          files: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              category: true,
              status: true,
            },
          },
        },
      })
      .catch(() => null);

    // 2. If not found by direct ID, check if slug contains an ID suffix or matches name
    if (!member) {
      const idSuffixMatch = trimmed.match(
        /-([0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?)$/i,
      );
      if (idSuffixMatch && idSuffixMatch[1]) {
        const candidateId = idSuffixMatch[1];
        member = await this.prisma.member.findFirst({
          where: {
            id: { startsWith: candidateId },
            directoryOptIn: true,
            user: { status: UserStatus.ACTIVE },
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                userType: true,
                status: true,
                createdAt: true,
              },
            },
            memberships: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            files: {
              where: { status: 'ACTIVE' },
              select: {
                id: true,
                category: true,
                status: true,
              },
            },
          },
        });
      }
    }

    if (!member) {
      const nameCandidate = trimmed.replace(/-/g, ' ').trim();
      member = await this.prisma.member.findFirst({
        where: {
          directoryOptIn: true,
          user: { status: UserStatus.ACTIVE },
          OR: [
            { id: trimmed },
            { fullNameEn: { equals: nameCandidate, mode: 'insensitive' } },
            { fullNameAr: { equals: nameCandidate, mode: 'insensitive' } },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              userType: true,
              status: true,
              createdAt: true,
            },
          },
          memberships: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          files: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              category: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 3. Fallback: check candidates whose generated slug matches
    if (!member) {
      const candidates = await this.prisma.member.findMany({
        where: {
          directoryOptIn: true,
          user: { status: UserStatus.ACTIVE },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              userType: true,
              status: true,
              createdAt: true,
            },
          },
          memberships: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          files: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              category: true,
              status: true,
            },
          },
        },
        take: 100,
      });

      member =
        candidates.find((c) => {
          const fullSlug = generateTrainerSlug(c.fullNameEn, c.id);
          const rawBaseSlug = (c.fullNameEn || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          return fullSlug === trimmed || rawBaseSlug === trimmed || c.id === trimmed;
        }) || null;
    }

    if (!member) {
      throw new NotFoundError('Trainer profile not found');
    }

    // 4. Strict PRO-34 Eligibility Gate
    // Rule 1: directoryOptIn must be strictly true
    if (member.directoryOptIn !== true) {
      throw new NotFoundError('Trainer profile not found');
    }

    // Rule 2: User account must be active
    if (member.user && member.user.status !== UserStatus.ACTIVE) {
      throw new NotFoundError('Trainer profile not found');
    }

    // Rule 3: Membership status must be eligible (ACTIVE, GRACE_PERIOD, EXPIRED; NOT SUSPENDED or CANCELLED)
    const latestMembership = member.memberships?.[0] || null;
    const membershipStatus = latestMembership?.status ?? MembershipStatus.ACTIVE;
    if (
      membershipStatus === MembershipStatus.SUSPENDED ||
      membershipStatus === MembershipStatus.CANCELLED ||
      membershipStatus === MembershipStatus.PENDING_PAYMENT
    ) {
      throw new NotFoundError('Trainer profile not found');
    }

    // Rule 4: Profile completion must be exactly 100% computed via calculateProfileCompletion
    const hasCv = member.files?.some((f) => f.category === 'CV' && f.status === 'ACTIVE') ?? false;

    const completion = calculateProfileCompletion({
      fullNameEn: member.fullNameEn,
      fullNameAr: member.fullNameAr,
      email: member.user?.email,
      phone: member.phone,
      country: member.country,
      city: member.city,
      yearsOfExperience: member.yearsOfExperience,
      areasOfExpertise: member.areasOfExpertise,
      industriesServed: member.industriesServed,
      languages: member.languages,
      bioEn: member.bioEn,
      bioAr: member.bioAr,
      hasCv,
      photoFileId: member.photoFileId,
      linkedinUrl: member.linkedinUrl,
    });

    if (completion.completionPercentage !== 100) {
      throw new NotFoundError('Trainer profile not found');
    }

    // 5. Return strictly sanitized PublicTrainerProfile (omits email, phone, cvUrl, userId, internal files)
    const { firstName, lastName } = parseTrainerName(member);
    const tier = latestMembership?.tier ?? MembershipTier.ESSENTIAL;
    const { badgeType } = getTierBadgeAndWeight(tier, membershipStatus);

    return {
      id: member.id,
      slug: generateTrainerSlug(member.fullNameEn, member.id),
      firstName,
      lastName,
      titleEn: null,
      titleAr: null,
      bioEn: member.bioEn ?? null,
      bioAr: member.bioAr ?? null,
      photoUrl: member.photoFileId ? `/api/v1/files/${member.photoFileId}/download` : null,
      country: member.country,
      city: member.city ?? null,
      yearsOfExperience: member.yearsOfExperience ?? null,
      areasOfExpertise: member.areasOfExpertise ?? [],
      industriesServed: member.industriesServed ?? [],
      languages: member.languages ?? [],
      linkedinUrl: member.linkedinUrl ?? null,
      tier,
      badgeType,
    };
  }
}
