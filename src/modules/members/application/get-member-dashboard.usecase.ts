import { PrismaClient, MembershipTier, MembershipStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import { calculateProfileCompletion } from '../domain';
import {
  calculateEntitlements,
  calculateDirectoryEligibility,
  MemberEntitlements,
} from '../../membership/domain';

export interface ActivityItem {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  reason: string | null;
  createdAt: Date;
}

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
  recentActivity: ActivityItem[];
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

    // 4. Fetch recent activity feed (SEC-33)
    // CRITICAL: Strictly project fields and omit `sequenceNumber` (BigInt) to prevent JSON serialization crash
    const recentLogs = await this.prisma.auditLog.findMany({
      where: { actorId: member.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        reason: true,
        createdAt: true,
      },
    });

    const recentActivity: ActivityItem[] = recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      reason: log.reason,
      createdAt: log.createdAt,
    }));

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
