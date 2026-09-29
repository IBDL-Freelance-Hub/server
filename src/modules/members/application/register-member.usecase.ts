import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  prisma as defaultPrisma,
  emailProvider as defaultEmailProvider,
  IEmailProvider,
} from '../../../shared/providers';
import { ConflictError, ValidationError } from '../../../shared/errors';
import { normalizeEmail, getFrontendBaseUrl } from '../../../shared/utils';
import { normalizePhoneNumber, calculateProfileCompletion } from '../domain';
import { RegisterMemberInput } from '../presentation/members.schema';
import { executeRegistrationTransaction } from './services/register-member-transaction.service';
import { buildWelcomeEmailHtml } from './templates/welcome-email.template';
import { UploadCvUseCase, UploadFileInput } from '../../files/application/upload-cv.usecase';

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
    status: string;
    message: string;
    username?: string;
    password?: string;
    assessmentLink?: string;
    note?: string;
  };
  welcomeEmail: {
    from: string;
    senderName: string;
    subject: string;
  };
}

export class RegisterMemberUseCase {
  private readonly uploadCvUseCase: UploadCvUseCase;

  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly emailSvc: IEmailProvider = defaultEmailProvider,
    uploadCvUseCase?: UploadCvUseCase,
  ) {
    this.uploadCvUseCase = uploadCvUseCase ?? new UploadCvUseCase(prisma);
  }

  async execute(
    input: RegisterMemberInput,
    context?: RegisterMemberContext,
    fileInput?: UploadFileInput,
  ): Promise<RegisterMemberSuccessOutput> {
    // 0. Strict Magic Bytes & Format Validation for CV file via the SAME UploadCvUseCase pipeline
    if (fileInput && fileInput.buffer && fileInput.buffer.length > 0) {
      this.uploadCvUseCase.validateFile(fileInput);
    }

    // 1. Affirmative consent validation (SEC-13)
    if (!input.termsAccepted) {
      throw new ValidationError('You must agree to the terms to complete registration.');
    }

    const emailNormalized = normalizeEmail(input.email);
    const phoneNormalized = normalizePhoneNumber(input.mobile, input.country);

    // 2. Duplicate Detection & Conflict Handling (REG-45 to REG-55, SCR-18)
    const [existingUser, existingMember] = await Promise.all([
      this.prisma.user.findUnique({ where: { emailNormalized } }),
      this.prisma.member.findUnique({ where: { phoneNormalized } }),
    ]);

    if (existingUser && existingMember) {
      throw new ConflictError('You are already registered', { clashType: 'both' });
    }
    if (existingUser) {
      throw new ConflictError('You are already registered', { clashType: 'email' });
    }
    if (existingMember) {
      throw new ConflictError('You are already registered', { clashType: 'mobile' });
    }

    // 3. Compute initial profile completion rate
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

    // 4. Token & Security Initialization
    const tempPasswordHash = '$2b$10$UNSET_PASSWORD_HASH_' + crypto.randomBytes(16).toString('hex');
    const config = await this.prisma.securityConfig.findFirst({ where: { id: 1 } });
    const lifetimeMinutes = config?.activationLinkLifetimeMinutes ?? 10;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const startDate = new Date();
    const expiresAt = new Date(startDate.getTime() + lifetimeMinutes * 60 * 1000);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    // 5. Atomic Transactional Persistence
    const { user, member, claimedCredential } = await executeRegistrationTransaction(this.prisma, {
      input,
      emailNormalized,
      phoneNormalized,
      completionPercentage: completionResult.completionPercentage,
      tempPasswordHash,
      tokenHash,
      expiresAt,
      startDate,
      endDate,
      context,
    });

    // 5b. Persist CV file through the SAME UploadCvUseCase pipeline
    if (fileInput && fileInput.buffer && fileInput.buffer.length > 0) {
      try {
        await this.uploadCvUseCase.execute(user.id, fileInput, context);
      } catch (cvErr) {
        console.error('[Registration CV Upload Failed]', cvErr);
      }
    }

    const pqpNote = claimedCredential.isPoolExhausted
      ? 'Specimen credentials for demonstration only — no PQP account exists and nothing is connected to a live assessment service.'
      : 'Live pre-generated assessment voucher claimed from pool.';

    const firstName = member.fullNameEn.trim().split(/\s+/)[0] || member.fullNameEn.trim();
    const clientUrl = getFrontendBaseUrl();
    const activationUrl = `${clientUrl}/activate?token=${rawToken}`;

    // 6. Build Branded Welcome Email HTML with Assessment Logos
    const emailHtml = buildWelcomeEmailHtml({
      firstName,
      activationUrl,
      clientUrl,
      claimedCredential,
      cpatLink: 'https://cpat.ibdl.net/start',
      mdLink: 'https://managementdrives.ibdl.net/start',
    });

    // 7. Dispatch Welcome Email (await execution to prevent serverless freeze, with full audit logging)
    try {
      await this.emailSvc.sendEmail({
        to: user.email,
        subject: 'Welcome to Freelancers Hub — Your 3 Free Assessments Are Ready',
        html: emailHtml,
      });
      console.log(`[Welcome Email Dispatched Successfully]: to=${user.email}, userId=${user.id}`);
      try {
        await this.prisma.auditLog.createMany({
          data: [
            {
              actorId: user.id,
              action: 'ACTIVATION_LINK_SENT',
              resource: 'User',
              resourceId: user.id,
              ipAddress: context?.ipAddress || null,
            },
            {
              actorId: user.id,
              action: 'WELCOME_EMAIL_SENT',
              resource: 'User',
              resourceId: user.id,
              ipAddress: context?.ipAddress || null,
            },
          ],
        });
      } catch (auditErr) {
        console.error('[Welcome Email AuditLog Error]', auditErr);
      }
    } catch (err) {
      const errorReason = err instanceof Error ? err.message : String(err);
      console.error(
        `[Welcome Email Dispatch Failed]: to=${user.email}, userId=${user.id}, error="${errorReason}"`,
      );
      try {
        await this.prisma.auditLog.createMany({
          data: [
            {
              actorId: user.id,
              action: 'ACTIVATION_LINK_FAILED',
              resource: 'User',
              resourceId: user.id,
              reason: errorReason.slice(0, 500),
              ipAddress: context?.ipAddress || null,
            },
            {
              actorId: user.id,
              action: 'WELCOME_EMAIL_FAILED',
              resource: 'User',
              resourceId: user.id,
              reason: errorReason.slice(0, 500),
              ipAddress: context?.ipAddress || null,
            },
          ],
        });
      } catch (auditErr) {
        console.error('[Welcome Email Failed AuditLog Error]', auditErr);
      }
    }

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
        status: 'LOCKED_PENDING_ACTIVATION',
        message: 'Account activation required to unlock assessment credentials.',
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
