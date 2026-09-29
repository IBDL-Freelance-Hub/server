import { PrismaClient, Prisma, MembershipTier, MembershipStatus, UserStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { calculateProfileCompletion } from '../../members/domain';
import {
  DirectoryFilterCriteria,
  DirectorySearchResult,
  PublicTrainerListItem,
  getTierBadgeAndWeight,
  generateTrainerSlug,
  parseTrainerName,
} from '../domain';

export class SearchDirectoryUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(filter: DirectoryFilterCriteria = {}): Promise<DirectorySearchResult> {
    // 1. Construct dynamic Prisma where clause
    const where: Prisma.MemberWhereInput = {
      directoryOptIn: true,
      user: {
        status: UserStatus.ACTIVE,
      },
      memberships: {
        some: {
          status: {
            in: [MembershipStatus.ACTIVE, MembershipStatus.GRACE_PERIOD, MembershipStatus.EXPIRED],
          },
        },
      },
    };

    if (filter.tier) {
      where.memberships = {
        some: {
          status: {
            in: [MembershipStatus.ACTIVE, MembershipStatus.GRACE_PERIOD, MembershipStatus.EXPIRED],
          },
          tier: filter.tier,
        },
      };
    }

    if (filter.country && filter.country.trim()) {
      where.country = {
        equals: filter.country.trim(),
        mode: 'insensitive',
      };
    }

    if (filter.city && filter.city.trim()) {
      where.city = {
        equals: filter.city.trim(),
        mode: 'insensitive',
      };
    }

    if (filter.expertise) {
      const expertiseList = Array.isArray(filter.expertise)
        ? filter.expertise.map((e) => e.trim()).filter(Boolean)
        : [filter.expertise.trim()].filter(Boolean);

      if (expertiseList.length > 0) {
        where.areasOfExpertise = {
          hasSome: expertiseList,
        };
      }
    }

    if (filter.industry) {
      const industryList = Array.isArray(filter.industry)
        ? filter.industry.map((i) => i.trim()).filter(Boolean)
        : [filter.industry.trim()].filter(Boolean);

      if (industryList.length > 0) {
        where.industriesServed = {
          hasSome: industryList,
        };
      }
    }

    if (filter.language) {
      const languageList = Array.isArray(filter.language)
        ? filter.language.map((l) => l.trim()).filter(Boolean)
        : [filter.language.trim()].filter(Boolean);

      if (languageList.length > 0) {
        where.languages = {
          hasSome: languageList,
        };
      }
    }

    if (filter.search && filter.search.trim()) {
      const term = filter.search.trim();
      where.OR = [
        { fullNameEn: { contains: term, mode: 'insensitive' } },
        { fullNameAr: { contains: term, mode: 'insensitive' } },
        { bioEn: { contains: term, mode: 'insensitive' } },
        { bioAr: { contains: term, mode: 'insensitive' } },
      ];
    }

    // 2. Query candidate records with optimized select projection
    const candidateMembers = await this.prisma.member.findMany({
      where,
      select: {
        id: true,
        fullNameEn: true,
        fullNameAr: true,
        country: true,
        city: true,
        areasOfExpertise: true,
        industriesServed: true,
        languages: true,
        bioEn: true,
        bioAr: true,
        photoFileId: true,
        directoryOptIn: true,
        profileCompletionRate: true,
        phone: true,
        yearsOfExperience: true,
        linkedinUrl: true,
        createdAt: true,
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
          where: {
            status: {
              in: [
                MembershipStatus.ACTIVE,
                MembershipStatus.GRACE_PERIOD,
                MembershipStatus.EXPIRED,
              ],
            },
          },
          select: {
            tier: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        files: {
          where: { status: 'ACTIVE', category: 'CV' },
          select: {
            id: true,
            category: true,
            status: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Strict in-memory gating and tier ranking
    interface ScoredTrainer {
      item: PublicTrainerListItem;
      weight: number;
      createdAt: Date;
    }

    const eligibleTrainers: ScoredTrainer[] = [];

    for (const member of candidateMembers) {
      // PRO-34 Rule 1: directoryOptIn must be strictly true
      if (member.directoryOptIn !== true) {
        continue;
      }

      // PRO-34 Rule 2: User status must be ACTIVE
      if (member.user && member.user.status !== UserStatus.ACTIVE) {
        continue;
      }

      // PRO-34 Rule 3: Membership status must be ACTIVE, GRACE_PERIOD, or EXPIRED (exclude SUSPENDED, CANCELLED, PENDING_PAYMENT)
      const latestMembership = member.memberships?.[0] || null;
      const membershipStatus = latestMembership?.status ?? MembershipStatus.ACTIVE;
      if (
        membershipStatus === MembershipStatus.SUSPENDED ||
        membershipStatus === MembershipStatus.CANCELLED ||
        membershipStatus === MembershipStatus.PENDING_PAYMENT
      ) {
        continue;
      }

      // PRO-34 Rule 4: Profile completion must be exactly 100% computed via calculateProfileCompletion
      const hasCv =
        member.files?.some((f) => f.category === 'CV' && f.status === 'ACTIVE') ?? false;

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
        continue;
      }

      // In-memory filters for tier, search, expertise, industry, language, country, and city
      if (filter.tier && latestMembership?.tier !== filter.tier) {
        continue;
      }

      if (filter.country && filter.country.trim()) {
        if ((member.country || '').toLowerCase() !== filter.country.trim().toLowerCase()) {
          continue;
        }
      }

      if (filter.city && filter.city.trim()) {
        if ((member.city || '').toLowerCase() !== filter.city.trim().toLowerCase()) {
          continue;
        }
      }

      if (filter.expertise) {
        const expertiseList = Array.isArray(filter.expertise)
          ? filter.expertise.map((e) => e.trim().toLowerCase())
          : [filter.expertise.trim().toLowerCase()];
        const memberExpertise = (member.areasOfExpertise || []).map((e) => e.toLowerCase());
        const hasMatch = expertiseList.some((e) => memberExpertise.includes(e));
        if (!hasMatch) {
          continue;
        }
      }

      if (filter.industry) {
        const industryList = Array.isArray(filter.industry)
          ? filter.industry.map((i) => i.trim().toLowerCase())
          : [filter.industry.trim().toLowerCase()];
        const memberIndustries = (member.industriesServed || []).map((i) => i.toLowerCase());
        const hasMatch = industryList.some((i) => memberIndustries.includes(i));
        if (!hasMatch) {
          continue;
        }
      }

      if (filter.language) {
        const languageList = Array.isArray(filter.language)
          ? filter.language.map((l) => l.trim().toLowerCase())
          : [filter.language.trim().toLowerCase()];
        const memberLanguages = (member.languages || []).map((l) => l.toLowerCase());
        const hasMatch = languageList.some((l) => memberLanguages.includes(l));
        if (!hasMatch) {
          continue;
        }
      }

      const { firstName, lastName } = parseTrainerName(member);

      if (filter.search && filter.search.trim()) {
        const term = filter.search.trim().toLowerCase();
        const searchMatches =
          firstName.toLowerCase().includes(term) ||
          lastName.toLowerCase().includes(term) ||
          (member.fullNameEn || '').toLowerCase().includes(term) ||
          (member.fullNameAr || '').toLowerCase().includes(term) ||
          (member.bioEn || '').toLowerCase().includes(term) ||
          (member.bioAr || '').toLowerCase().includes(term);

        if (!searchMatches) {
          continue;
        }
      }

      const tier = latestMembership?.tier ?? MembershipTier.ESSENTIAL;
      const { badgeType, weight } = getTierBadgeAndWeight(tier, membershipStatus);

      // Construct sanitized PublicTrainerListItem (strictly omitting private data: email, phone, cv, etc.)
      const item: PublicTrainerListItem = {
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
        areasOfExpertise: member.areasOfExpertise ?? [],
        industriesServed: member.industriesServed ?? [],
        languages: member.languages ?? [],
        tier,
        badgeType,
      };

      eligibleTrainers.push({
        item,
        weight,
        createdAt: member.createdAt,
      });
    }

    // 4. Sort deterministically by tier weight (MASTER=3, PROFESSIONAL=2, ESSENTIAL=1), tie-broken by createdAt DESC
    eligibleTrainers.sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // 5. Clean pagination
    const total = eligibleTrainers.length;
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(filter.limit) || 12));
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const trainers = eligibleTrainers.slice(offset, offset + limit).map((e) => e.item);

    return {
      trainers,
      total,
      page,
      totalPages,
    };
  }
}
