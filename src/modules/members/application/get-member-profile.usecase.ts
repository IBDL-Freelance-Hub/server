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

    let assessmentCredentials = null;
    if (member.user.status === 'ACTIVE') {
      const cred = await this.prisma.assessmentCredentialPool?.findFirst?.({
        where: { assignedTo: userId },
        orderBy: { assignedAt: 'desc' },
      });

      const username = cred ? cred.username : `flh.${userId.slice(0, 6)}`;
      const password = cred ? cred.password : 'ASSESSMENT-2026-DEMO';
      const pqpUrl = cred?.accessUrl || 'https://pqp.ibdl.net/start';

      assessmentCredentials = {
        name: 'IBDL 3 Diagnostic Assessments (PQP™, CPAT™, Management Drives®)',
        portalUrl: pqpUrl,
        username,
        password,
        status: 'ACTIVE',
        note: 'Unified single login for all 3 diagnostic assessments. 1 completed attempt per tool.',
        portals: [
          {
            key: 'pqp',
            code: 'PQP™',
            nameEn: 'Professional Quality Practitioner (PQP™)',
            nameAr: 'محترف الجودة المهنية (PQP™)',
            tagEn: 'Quality & Operations',
            tagAr: 'معايير الجودة والعمليات',
            url: pqpUrl,
          },
          {
            key: 'cpat',
            code: 'CPAT™',
            nameEn: 'Certified Professional Agile Trainer (CPAT™)',
            nameAr: 'مدرب أجايل المعتمد دولياً (CPAT™)',
            tagEn: 'Agile & Training',
            tagAr: 'التدريب الرشيق وتيسير الورش',
            url: 'https://cpat.ibdl.net/start',
          },
          {
            key: 'md',
            code: 'Management Drives®',
            nameEn: 'Management Drives® Assessment',
            nameAr: 'محركات الإدارة والسلوك (Management Drives®)',
            tagEn: 'Leadership & Culture',
            tagAr: 'أنماط القيادة والدوافع المؤسسية',
            url: 'https://md.ibdl.net/start',
          },
        ],
      };
    } else {
      assessmentCredentials = {
        name: 'IBDL 3 Diagnostic Assessments (PQP™, CPAT™, Management Drives®)',
        portalUrl: 'https://pqp.ibdl.net/start',
        status: 'LOCKED',
        note: 'Account activation required to unlock assessment credentials.',
      };
    }

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
      assessmentCredentials,
      files: member.files,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
}
