import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../shared/providers';
import { ConflictError } from '../../../shared/errors';
import { normalizeEmail } from '../../../shared/utils';
import { normalizePhoneNumber, calculateProfileCompletion } from '../domain';
import { RegisterMemberInput } from '../presentation/members.schema';

export interface RegisterMemberContext {
  requestId?: string;
  ipAddress?: string;
}

export interface RegisterMemberSuccessOutput {
  member: {
    id: string;
    fullName: string;
    email: string;
  };
  membership: {
    tier: string;
    fee: string;
    payment: string;
    status: string;
    startDate: string;
    renewsOn: string;
  };
  pqpAccess: {
    username: string;
    password: string;
    assessmentLink: string;
    note: string;
  };
  welcomeEmail: {
    from: string;
    senderName: string;
    subject: string;
  };
}

export class RegisterMemberUseCase {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async execute(
    input: RegisterMemberInput,
    context?: RegisterMemberContext,
  ): Promise<RegisterMemberSuccessOutput> {
    const emailNormalized = normalizeEmail(input.email);
    const phoneNormalized = normalizePhoneNumber(input.mobile, input.country);

    // Duplicate Detection & Conflict Handling (REG-45 to REG-55, SCR-18)
    const [existingUser, existingMember] = await Promise.all([
      this.prisma.user.findUnique({ where: { emailNormalized } }),
      this.prisma.member.findUnique({ where: { phoneNormalized } }),
    ]);

    if (existingUser && existingMember) {
      throw new ConflictError('You are already registered', {
        clashType: 'both',
      });
    }
    if (existingUser) {
      throw new ConflictError('You are already registered', {
        clashType: 'email',
      });
    }
    if (existingMember) {
      throw new ConflictError('You are already registered', {
        clashType: 'mobile',
      });
    }

    // Compute initial profile completion rate
    const completionResult = calculateProfileCompletion({
      fullNameEn: input.fullName,
      email: input.email,
      phone: phoneNormalized,
      country: input.country,
      yearsOfExperience: input.yearsOfExperience,
      areasOfExpertise: input.areasOfExpertise,
      industriesServed: input.industriesServed,
      bioEn: input.bio,
      linkedinUrl: input.linkedinUrl,
      cvFileId: input.cvFileId,
    });

    const tempPasswordHash = '$2b$10$UNSET_PASSWORD_HASH_' + crypto.randomBytes(16).toString('hex');
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    // Atomic Transaction ($transaction)
    const { user, member } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: input.email,
          emailNormalized,
          passwordHash: tempPasswordHash,
          userType: 'MEMBER',
          status: 'ACTIVE',
        },
      });

      const createdMember = await tx.member.create({
        data: {
          userId: createdUser.id,
          fullNameEn: input.fullName.trim(),
          phone: input.mobile.trim(),
          phoneNormalized,
          country: input.country.trim(),
          yearsOfExperience: input.yearsOfExperience,
          areasOfExpertise: input.areasOfExpertise || [],
          industriesServed: input.industriesServed || [],
          bioEn: input.bio?.trim() || null,
          linkedinUrl: input.linkedinUrl?.trim() || null,
          directoryOptIn: input.directoryOptIn ?? false,
          profileCompletionRate: completionResult.completionPercentage,
        },
      });

      await tx.membership.create({
        data: {
          memberId: createdMember.id,
          tier: 'ESSENTIAL',
          status: 'ACTIVE',
          price: 0.0,
          startDate,
          endDate,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: createdUser.id,
          actorRole: 'MEMBER',
          action: 'MEMBER_REGISTERED',
          resource: 'Member',
          resourceId: createdMember.id,
          newState: {
            userId: createdUser.id,
            memberId: createdMember.id,
            email: createdUser.email,
            phoneNormalized,
          },
          requestId: context?.requestId,
          ipAddress: context?.ipAddress,
        },
      });

      return { user: createdUser, member: createdMember };
    });

    // PQP Specimen Generation (REG-64 to REG-66, SCR-19)
    const rawFirst = input.fullName.trim().split(/\s+/)[0] || 'demo';
    const cleanFirst = rawFirst.toLowerCase().replace(/[^a-z]/g, '') || 'demo';
    const pqpUsername = `flh.${cleanFirst}`;

    return {
      member: {
        id: member.id,
        fullName: member.fullNameEn,
        email: user.email,
      },
      membership: {
        tier: 'Essential Membership',
        fee: 'Free',
        payment: 'Not required',
        status: 'Active',
        startDate: startDate.toISOString(),
        renewsOn: endDate.toISOString(),
      },
      pqpAccess: {
        username: pqpUsername,
        password: 'PQP-2026-DEMO',
        assessmentLink: 'pqp.ibdl.net/start',
        note: 'Specimen credentials for demonstration only — no PQP account exists and nothing is connected to a live assessment service.',
      },
      welcomeEmail: {
        from: 'freelancers.hub@ibdl.net',
        senderName: 'IBDL L&D Freelancer Hub',
        subject: 'Your complimentary PQP™ access is ready',
      },
    };
  }
}
