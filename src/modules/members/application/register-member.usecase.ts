import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  prisma as defaultPrisma,
  emailProvider as defaultEmailProvider,
  IEmailProvider,
} from '../../../shared/providers';
import { ConflictError, ValidationError } from '../../../shared/errors';
import { normalizeEmail } from '../../../shared/utils';
import { normalizePhoneNumber, calculateProfileCompletion } from '../domain';
import { RegisterMemberInput } from '../presentation/members.schema';
import { claimAssessmentCredential } from '../infrastructure/assessment-pool.service';

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
  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly emailSvc: IEmailProvider = defaultEmailProvider,
  ) {}

  async execute(
    input: RegisterMemberInput,
    context?: RegisterMemberContext,
  ): Promise<RegisterMemberSuccessOutput> {
    // Affirmative consent validation (SEC-13)
    if (!input.termsAccepted) {
      throw new ValidationError('You must agree to the terms to complete registration.');
    }

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
    const { user, member, claimedCredential } = await this.prisma.$transaction(async (tx) => {
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

      // Write Three Distinct Policy Acceptance Audit Records (SEC-13, SEC-14)
      const policyTypes = ['PRIVACY_POLICY', 'TERMS_OF_USE', 'COOKIE_POLICY'] as const;
      for (const policyType of policyTypes) {
        await tx.auditLog.create({
          data: {
            actorId: createdUser.id,
            actorRole: 'MEMBER',
            action: 'POLICY_ACCEPTED',
            resource: 'PolicyAcceptance',
            resourceId: createdUser.id,
            newState: {
              policyType,
              version: 'v1.0',
              language: 'en',
              acceptedAt: startDate.toISOString(),
            },
            requestId: context?.requestId,
            ipAddress: context?.ipAddress,
          },
        });
      }

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

      // Pre-generated Assessment Credential Pool Claim (REG-64, REG-65)
      const rawFirst = input.fullName.trim().split(/\s+/)[0] || 'demo';
      const cleanFirst = rawFirst.toLowerCase().replace(/[^a-z]/g, '') || 'demo';
      const fallbackUsername = `flh.${cleanFirst}`;

      const credential = await claimAssessmentCredential(tx, createdUser.id, fallbackUsername);

      return { user: createdUser, member: createdMember, claimedCredential: credential };
    });

    const pqpNote = claimedCredential.isPoolExhausted
      ? 'Specimen credentials for demonstration only — no PQP account exists and nothing is connected to a live assessment service.'
      : 'Live pre-generated assessment voucher claimed from pool.';

    // Dispatch welcome email with claimed PQP credentials (NTF-31)
    await this.emailSvc.sendEmail({
      to: user.email,
      subject: 'Your complimentary PQP™ access is ready',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #0056b3;">Welcome to IBDL Freelancers Hub</h2>
          <p>Hello ${member.fullNameEn},</p>
          <p>Your complimentary PQP™ assessment access details:</p>
          <ul>
            <li><strong>Username:</strong> ${claimedCredential.username}</li>
            <li><strong>Password:</strong> ${claimedCredential.password}</li>
            <li><strong>Assessment Link:</strong> <a href="https://${claimedCredential.accessUrl}">${claimedCredential.accessUrl}</a></li>
          </ul>
          <p style="font-size: 12px; color: #777;">Note: ${pqpNote}</p>
        </div>
      `,
    });

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
        username: claimedCredential.username,
        password: claimedCredential.password,
        assessmentLink: claimedCredential.accessUrl,
        note: pqpNote,
      },
      welcomeEmail: {
        from: 'freelancers.hub@ibdl.net',
        senderName: 'IBDL L&D Freelancer Hub',
        subject: 'Your complimentary PQP™ access is ready',
      },
    };
  }
}
