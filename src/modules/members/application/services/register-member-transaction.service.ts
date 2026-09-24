import { PrismaClient, User, Member } from '@prisma/client';
import { RegisterMemberInput } from '../../presentation/members.schema';
import {
  claimAssessmentCredential,
  ClaimedCredential,
} from '../../infrastructure/assessment-pool.service';

export interface ExecuteRegistrationParams {
  input: RegisterMemberInput;
  emailNormalized: string;
  phoneNormalized: string;
  completionPercentage: number;
  tempPasswordHash: string;
  tokenHash: string;
  expiresAt: Date;
  startDate: Date;
  endDate: Date;
  context?: {
    requestId?: string;
    ipAddress?: string;
  };
}

export interface RegistrationTransactionResult {
  user: User;
  member: Member;
  claimedCredential: ClaimedCredential;
}

/**
 * Handles the atomic transactional persistence of a newly registered member.
 * Creates User, VerificationToken, Member, Membership, AuditLogs, and claims an Assessment voucher.
 */
export async function executeRegistrationTransaction(
  prisma: PrismaClient,
  params: ExecuteRegistrationParams,
): Promise<RegistrationTransactionResult> {
  const {
    input,
    emailNormalized,
    phoneNormalized,
    completionPercentage,
    tempPasswordHash,
    tokenHash,
    expiresAt,
    startDate,
    endDate,
    context,
  } = params;

  return prisma.$transaction(
    async (tx) => {
      // 1. Create Inactive User
      const createdUser = await tx.user.create({
        data: {
          email: input.email,
          emailNormalized,
          passwordHash: tempPasswordHash,
          userType: 'MEMBER',
          status: 'UNACTIVATED',
        },
      });

      // 2. Create Activation VerificationToken
      await tx.verificationToken.create({
        data: {
          userId: createdUser.id,
          purpose: 'ACTIVATION',
          tokenHash,
          expiresAt,
        },
      });

      // 3. Create Member Profile
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
          profileCompletionRate: completionPercentage,
        },
      });

      // 4. Create Complimentary Essential Membership
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

      // 5. Write Distinct Policy Acceptance Audit Records (SEC-13, SEC-14)
      const policyTypes = ['PRIVACY_POLICY', 'TERMS_OF_USE', 'COOKIE_POLICY'] as const;
      await tx.auditLog.createMany({
        data: policyTypes.map((policyType) => ({
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
        })),
      });

      // 6. Audit Member Registered Event
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

      // 7. Pre-generated Assessment Credential Pool Claim (REG-64, REG-65)
      const rawFirst = input.fullName.trim().split(/\s+/)[0] || 'demo';
      const cleanFirst = rawFirst.toLowerCase().replace(/[^a-z]/g, '') || 'demo';
      const fallbackUsername = `flh.${cleanFirst}`;

      const credential = await claimAssessmentCredential(tx, createdUser.id, fallbackUsername);

      return { user: createdUser, member: createdMember, claimedCredential: credential };
    },
    {
      maxWait: 10000,
      timeout: 15000,
    },
  );
}
