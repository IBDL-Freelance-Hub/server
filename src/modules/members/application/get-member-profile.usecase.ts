import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { NotFoundError } from '../../../shared/errors';
import { calculateProfileCompletion } from '../domain';

export class GetMemberProfileUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(userId: string) {
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
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        files: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            category: true,
            originalName: true,
            sizeBytes: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundError('Member profile not found');
    }

    const hasCv = member.files.some((f) => f.category === 'CV');

    const completion = calculateProfileCompletion({
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

    const activeMembership = member.memberships[0] || null;

    return {
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      fullNameEn: member.fullNameEn,
      fullNameAr: member.fullNameAr,
      phone: member.phone,
      country: member.country,
      city: member.city,
      yearsOfExperience: member.yearsOfExperience,
      areasOfExpertise: member.areasOfExpertise,
      industriesServed: member.industriesServed,
      languages: member.languages,
      bioEn: member.bioEn,
      bioAr: member.bioAr,
      linkedinUrl: member.linkedinUrl,
      photoFileId: member.photoFileId,
      directoryOptIn: member.directoryOptIn,
      profileCompletionRate: completion.completionPercentage,
      completionPercentage: completion.completionPercentage,
      missingFields: completion.missingItems,
      missingItems: completion.missingItems,
      membership: activeMembership
        ? {
            id: activeMembership.id,
            tier: activeMembership.tier,
            status: activeMembership.status,
            startDate: activeMembership.startDate,
            endDate: activeMembership.endDate,
          }
        : null,
      files: member.files,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
}
