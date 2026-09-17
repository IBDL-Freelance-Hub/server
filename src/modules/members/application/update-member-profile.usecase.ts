import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors';
import { calculateProfileCompletion, normalizePhoneNumber } from '../domain';
import { UpdateMemberProfileInput } from '../presentation/members.schema';

export interface UpdateMemberProfileContext {
  requestId?: string;
  ipAddress?: string;
}

export class UpdateMemberProfileUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(
    userId: string,
    input: UpdateMemberProfileInput,
    context?: UpdateMemberProfileContext,
  ) {
    // 1. Strict guard: Reject email modification (PRO-04, VAL-50)
    if ('email' in input && (input as Record<string, unknown>).email !== undefined) {
      throw new ValidationError(
        'Email address is read-only and cannot be modified (PRO-04, VAL-50)',
      );
    }

    // 2. Strict guard: Enforce VAL-57 (Do not allow clearing mandatory fields with null or whitespace)
    if (input.fullNameEn !== undefined && (!input.fullNameEn || !input.fullNameEn.trim())) {
      throw new ValidationError('Full name in English cannot be empty or null (VAL-57)');
    }
    if (input.city !== undefined && (!input.city || !input.city.trim())) {
      throw new ValidationError('City cannot be empty or null (VAL-57)');
    }
    if (input.phone !== undefined && (!input.phone || !input.phone.trim())) {
      throw new ValidationError('Phone cannot be empty or null (VAL-57)');
    }
    if (
      input.yearsOfExperience !== undefined &&
      (!input.yearsOfExperience || !input.yearsOfExperience.trim())
    ) {
      throw new ValidationError('Years of experience cannot be empty or null (VAL-57)');
    }

    // 3. Find existing member
    const existingMember = await this.prisma.member.findUnique({
      where: { userId },
      include: {
        user: true,
        files: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!existingMember) {
      throw new NotFoundError('Member profile not found');
    }

    // 4. Handle phone normalization & clash detection
    let mergedPhone = existingMember.phone;
    let mergedPhoneNormalized = existingMember.phoneNormalized;

    if (input.phone !== undefined) {
      const targetCountry = input.country ?? existingMember.country;
      mergedPhoneNormalized = normalizePhoneNumber(input.phone, targetCountry);
      mergedPhone = input.phone.trim();

      const clash = await this.prisma.member.findFirst({
        where: {
          phoneNormalized: mergedPhoneNormalized,
          id: { not: existingMember.id },
        },
      });

      if (clash) {
        throw new ConflictError('This mobile number is already in use by another member', {
          clashType: 'mobile',
        });
      }
    }

    // 5. Merge fields to prepare pre-commit state
    const mergedFullNameEn =
      input.fullNameEn !== undefined ? input.fullNameEn.trim() : existingMember.fullNameEn;

    const mergedFullNameAr =
      input.fullNameAr !== undefined
        ? input.fullNameAr
          ? input.fullNameAr.trim()
          : null
        : existingMember.fullNameAr;

    const mergedCountry =
      input.country !== undefined ? input.country.trim() : existingMember.country;

    const mergedCity = input.city !== undefined ? input.city.trim() : existingMember.city;

    const mergedYears =
      input.yearsOfExperience !== undefined
        ? input.yearsOfExperience
        : existingMember.yearsOfExperience;

    const mergedAreas =
      input.areasOfExpertise !== undefined
        ? input.areasOfExpertise
        : existingMember.areasOfExpertise;

    const mergedIndustries =
      input.industriesServed !== undefined
        ? input.industriesServed
        : existingMember.industriesServed;

    const mergedLanguages =
      input.languages !== undefined ? input.languages : existingMember.languages;

    const mergedBioEn =
      input.bioEn !== undefined ? (input.bioEn ? input.bioEn.trim() : null) : existingMember.bioEn;

    const mergedBioAr =
      input.bioAr !== undefined ? (input.bioAr ? input.bioAr.trim() : null) : existingMember.bioAr;

    const mergedLinkedin =
      input.linkedinUrl !== undefined
        ? input.linkedinUrl
          ? input.linkedinUrl.trim()
          : null
        : existingMember.linkedinUrl;

    const mergedDirectoryOptIn =
      input.directoryOptIn !== undefined ? input.directoryOptIn : existingMember.directoryOptIn;

    // 6. Calculate profile completion on merged post-update state (VAL-58)
    const hasCv = existingMember.files.some((f) => f.category === 'CV');

    const completion = calculateProfileCompletion({
      fullNameEn: mergedFullNameEn,
      fullNameAr: mergedFullNameAr,
      email: existingMember.user.email,
      phone: mergedPhone,
      country: mergedCountry,
      city: mergedCity,
      yearsOfExperience: mergedYears,
      areasOfExpertise: mergedAreas,
      industriesServed: mergedIndustries,
      languages: mergedLanguages,
      bioEn: mergedBioEn,
      bioAr: mergedBioAr,
      hasCv,
      photoFileId: existingMember.photoFileId,
      linkedinUrl: mergedLinkedin,
    });

    // 7. Atomic Transaction: Persist updates & AuditLog
    const updatedMember = await this.prisma.$transaction(async (tx) => {
      const record = await tx.member.update({
        where: { id: existingMember.id },
        data: {
          fullNameEn: mergedFullNameEn,
          fullNameAr: mergedFullNameAr,
          phone: mergedPhone,
          phoneNormalized: mergedPhoneNormalized,
          country: mergedCountry,
          city: mergedCity,
          yearsOfExperience: mergedYears,
          areasOfExpertise: mergedAreas,
          industriesServed: mergedIndustries,
          languages: mergedLanguages,
          bioEn: mergedBioEn,
          bioAr: mergedBioAr,
          linkedinUrl: mergedLinkedin,
          directoryOptIn: mergedDirectoryOptIn,
          profileCompletionRate: completion.completionPercentage,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              userType: true,
              status: true,
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

      await tx.auditLog.create({
        data: {
          actorId: existingMember.userId,
          actorRole: 'MEMBER',
          action: 'PROFILE_UPDATED',
          resource: 'Member',
          resourceId: existingMember.id,
          previousState: {
            fullNameEn: existingMember.fullNameEn,
            fullNameAr: existingMember.fullNameAr,
            phone: existingMember.phone,
            country: existingMember.country,
            city: existingMember.city,
            yearsOfExperience: existingMember.yearsOfExperience,
            areasOfExpertise: existingMember.areasOfExpertise,
            industriesServed: existingMember.industriesServed,
            languages: existingMember.languages,
            bioEn: existingMember.bioEn,
            bioAr: existingMember.bioAr,
            linkedinUrl: existingMember.linkedinUrl,
            directoryOptIn: existingMember.directoryOptIn,
            profileCompletionRate: existingMember.profileCompletionRate,
          },
          newState: {
            fullNameEn: record.fullNameEn,
            fullNameAr: record.fullNameAr,
            phone: record.phone,
            country: record.country,
            city: record.city,
            yearsOfExperience: record.yearsOfExperience,
            areasOfExpertise: record.areasOfExpertise,
            industriesServed: record.industriesServed,
            languages: record.languages,
            bioEn: record.bioEn,
            bioAr: record.bioAr,
            linkedinUrl: record.linkedinUrl,
            directoryOptIn: record.directoryOptIn,
            profileCompletionRate: record.profileCompletionRate,
          },
          ipAddress: context?.ipAddress,
          requestId: context?.requestId,
        },
      });

      return record;
    });

    const activeMembership = updatedMember.memberships[0] || null;

    return {
      profile: {
        id: updatedMember.id,
        userId: updatedMember.userId,
        email: updatedMember.user.email,
        fullNameEn: updatedMember.fullNameEn,
        fullNameAr: updatedMember.fullNameAr,
        phone: updatedMember.phone,
        country: updatedMember.country,
        city: updatedMember.city,
        yearsOfExperience: updatedMember.yearsOfExperience,
        areasOfExpertise: updatedMember.areasOfExpertise,
        industriesServed: updatedMember.industriesServed,
        languages: updatedMember.languages,
        bioEn: updatedMember.bioEn,
        bioAr: updatedMember.bioAr,
        linkedinUrl: updatedMember.linkedinUrl,
        photoFileId: updatedMember.photoFileId,
        directoryOptIn: updatedMember.directoryOptIn,
        profileCompletionRate: updatedMember.profileCompletionRate,
        membership: activeMembership
          ? {
              id: activeMembership.id,
              tier: activeMembership.tier,
              status: activeMembership.status,
              startDate: activeMembership.startDate,
              endDate: activeMembership.endDate,
            }
          : null,
        files: updatedMember.files,
        createdAt: updatedMember.createdAt,
        updatedAt: updatedMember.updatedAt,
      },
      completionPercentage: completion.completionPercentage,
      missingFields: completion.missingItems,
      missingItems: completion.missingItems,
    };
  }
}
