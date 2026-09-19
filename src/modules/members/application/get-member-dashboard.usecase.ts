import { PrismaClient, MembershipTier, MembershipStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import {
  calculateProfileCompletion,
  mapAuditLogToMemberActivity,
  MemberActivityItem,
} from '../domain';
import {
  calculateEntitlements,
  calculateDirectoryEligibility,
  MemberEntitlements,
} from '../../membership/domain';

export { MemberActivityItem };

export interface MemberDashboardResult {
  member: {
    id: string;
    fullNameEn: string;
    fullNameAr: string | null;
    email: string;
    city: string | null;
    country: string;
    profileCompletionRate: number;
    photoUrl: string | null;
  };
  membership: {
    tier: MembershipTier;
    status: MembershipStatus;
    startDate: Date;
    renewsOn: Date | null;
    daysUntilRenewal: number;
  };
  entitlements: MemberEntitlements;
  profileProgress: {
    completionPercentage: number;
    missingFields: string[];
  };
  recentActivity: MemberActivityItem[];
}

export class GetMemberDashboardUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(userId: string): Promise<MemberDashboardResult> {
    const member = await this.prisma.member.findUnique({
      where: { userId },
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

    if (!member) {
      throw new NotFoundError('Member not found');
    }

    // Determine CV existence from active files
    const hasCv = member.files.some((f) => f.category === 'CV' && f.status === 'ACTIVE');

    // 1. Live profile completion and missing fields calculation
    const profileProgress = calculateProfileCompletion({
      fullNameEn: member.fullNameEn,
      fullNameAr: member.fullNameAr,
      email: member.user.email,
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

    // 2. Active membership determination
    const activeMembership = member.memberships[0] || null;
    const tier = activeMembership?.tier ?? MembershipTier.ESSENTIAL;
    const status = activeMembership?.status ?? MembershipStatus.ACTIVE;
    const startDate = activeMembership?.startDate ?? member.createdAt;
    const renewsOn = activeMembership?.endDate ?? null;

    let daysUntilRenewal = 0;
    if (renewsOn) {
      const diffMs = renewsOn.getTime() - Date.now();
      daysUntilRenewal = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // 3. Directory eligibility and entitlements computation (SEC-33, DIR-02, VAL-58)
    const directoryEligibility = calculateDirectoryEligibility({
      directoryOptIn: member.directoryOptIn,
      profileCompletionRate: profileProgress.completionPercentage,
      userStatus: member.user.status,
      membershipStatus: activeMembership?.status ?? null,
    });

    const entitlements = calculateEntitlements(tier, status, directoryEligibility);

    // 4. Fetch recent activity feed (ACT-58, SEC-33)
    // Filter strictly to requesting member's userId (actorId === member.userId).
    // Audit-only fields (resource, resourceId, reason, actorRole, previousState, newState) are never selected.
    const recentLogs = await this.prisma.auditLog.findMany({
      where: { actorId: member.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        action: true,
        createdAt: true,
      },
    });

    // Map known action codes to bilingual human-readable sentences and tone.
    // Unmapped codes are silently excluded. Capped at the 5 most recent entries.
    const recentActivity: MemberActivityItem[] = [];
    for (const log of recentLogs) {
      const mapped = mapAuditLogToMemberActivity(log.action, log.createdAt);
      if (mapped) {
        recentActivity.push(mapped);
        if (recentActivity.length === 5) {
          break;
        }
      }
    }

    const photoUrl = member.photoFileId ? `/api/v1/files/${member.photoFileId}/download` : null;

    return {
      member: {
        id: member.id,
        fullNameEn: member.fullNameEn,
        fullNameAr: member.fullNameAr,
        email: member.user.email,
        city: member.city,
        country: member.country,
        profileCompletionRate: profileProgress.completionPercentage,
        photoUrl,
      },
      membership: {
        tier,
        status,
        startDate,
        renewsOn,
        daysUntilRenewal,
      },
      entitlements,
      profileProgress: {
        completionPercentage: profileProgress.completionPercentage,
        missingFields: profileProgress.missingItems,
      },
      recentActivity,
    };
  }
}
