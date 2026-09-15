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
import { env } from '../../../config/env.config';

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
    const config = await this.prisma.securityConfig.findFirst({ where: { id: 1 } });
    const lifetimeMinutes = config?.activationLinkLifetimeMinutes ?? 10;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const startDate = new Date();
    const expiresAt = new Date(startDate.getTime() + lifetimeMinutes * 60 * 1000);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    // Atomic Transaction ($transaction) with explicit timeout options
    const { user, member, claimedCredential } = await this.prisma.$transaction(
      async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: input.email,
            emailNormalized,
            passwordHash: tempPasswordHash,
            userType: 'MEMBER',
            status: 'UNACTIVATED',
          },
        });

        await tx.verificationToken.create({
          data: {
            userId: createdUser.id,
            purpose: 'ACTIVATION',
            tokenHash,
            expiresAt,
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
      },
      {
        maxWait: 10000,
        timeout: 15000,
      },
    );

    const pqpNote = claimedCredential.isPoolExhausted
      ? 'Specimen credentials for demonstration only — no PQP account exists and nothing is connected to a live assessment service.'
      : 'Live pre-generated assessment voucher claimed from pool.';

    const firstName = member.fullNameEn.trim().split(/\s+/)[0] || member.fullNameEn.trim();
    const clientUrl = env.CORS_ORIGIN || 'https://freelancers.ibdl.net';
    const isLocal = clientUrl.includes('localhost') || clientUrl.includes('127.0.0.1');
    const logoUrl =
      process.env.PUBLIC_LOGO_URL ||
      (isLocal ? 'https://ibdl.net/site/images/logo.png' : `${clientUrl}/Logos/IBDL.png`);
    const activationUrl = `${clientUrl}/activate?token=${rawToken}`;
    const pqpLink = claimedCredential.accessUrl.startsWith('http')
      ? claimedCredential.accessUrl
      : `https://${claimedCredential.accessUrl}`;
    const cpatLink = 'https://cpat.ibdl.net/start';
    const mdLink = 'https://managementdrives.ibdl.net/start';

    // Dispatch welcome email asynchronously without blocking HTTP response (fire-and-forget)
    this.emailSvc
      .sendEmail({
        to: user.email,
        subject: 'Welcome to Freelancers Hub — Your 3 Free Assessments Are Ready',
        html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Freelancers Hub</title>
</head>
<body style="margin:0; padding:0; background-color:#F0F0F3; font-family:Calibri, Arial, sans-serif;">

<!-- Preheader (hidden preview text) -->
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">
  Your Essential Membership is active, and your 3 free assessments are ready.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0F0F3; padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background-color:#FFFFFF; border-radius:12px; overflow:hidden;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td align="center" style="background-color:#1D1D39; padding:36px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background-color:#FFFFFF; border-radius:50%; width:84px; height:84px;">
                  <img src="${logoUrl}" width="52" height="52" alt="IBDL" style="display:block; margin:16px auto; object-fit:contain;">
                </td>
              </tr>
            </table>
            <div style="color:#FFFFFF; font-size:13px; letter-spacing:1px; margin-top:14px; opacity:0.75;">
              FREELANCERS HUB &nbsp;|&nbsp; POWERED BY IBDL
            </div>
          </td>
        </tr>

        <!-- ===== EYEBROW + HEADLINE ===== -->
        <tr>
          <td style="padding:40px 40px 0 40px;">
            <div style="color:#E11119; font-size:13px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase;">
              Welcome to the Hub
            </div>
            <h1 style="color:#1D1D39; font-size:28px; font-weight:bold; margin:12px 0 0 0; line-height:1.3;">
              You're in, ${firstName}.
            </h1>
          </td>
        </tr>

        <!-- ===== BODY COPY ===== -->
        <tr>
          <td style="padding:16px 40px 0 40px;">
            <p style="color:#4A4A4A; font-size:15px; line-height:1.6; margin:0 0 12px 0;">
              Your free <strong>Essential Membership</strong> is active — no card needed, and it stays free.
              You now have everything you need to start building visibility for your training practice.
            </p>
            <p style="color:#4A4A4A; font-size:15px; line-height:1.6; margin:0;">
              As a welcome gift, we've unlocked <strong>complimentary access to all three</strong> of IBDL's
              professional diagnostic assessments below — normally reserved for paid memberships.
            </p>
          </td>
        </tr>

        <!-- ===== PRIMARY CTA ===== -->
        <tr>
          <td align="center" style="padding:28px 40px 8px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background-color:#E11119; border-radius:28px;">
                  <a href="${activationUrl}" style="display:inline-block; padding:14px 32px; color:#FFFFFF; font-size:15px; font-weight:bold; text-decoration:none;">
                    Activate Account &amp; Set Password →
                  </a>
                </td>
              </tr>
            </table>
            <p style="color:#6B6B76; font-size:12px; margin-top:12px; text-align:center;">
              This activation link is valid for 10 minutes. If expired, request a new one at <a href="${clientUrl}/activate" style="color:#E11119;">${clientUrl}/activate</a>.
            </p>
          </td>
        </tr>


        <!-- ===== SECTION DIVIDER ===== -->
        <tr>
          <td style="padding:36px 40px 20px 40px;">
            <div style="border-top:1px solid #ECECEF;"></div>
          </td>
        </tr>

        <!-- ===== 3 FREE ASSESSMENTS INTRO ===== -->
        <tr>
          <td style="padding:0 40px;">
            <h2 style="color:#1D1D39; font-size:19px; font-weight:bold; margin:0 0 6px 0;">
              Your 3 free assessments
            </h2>
            <p style="color:#6B6B76; font-size:14px; line-height:1.6; margin:0 0 24px 0;">
              Complimentary as part of Phase 1 of Freelancers Hub. Specimen access details for each are below.
            </p>
          </td>
        </tr>

        <!-- ===== ASSESSMENT GRID (3 cards) ===== -->
        <tr>
          <td style="padding:0 24px 8px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>

                <!-- Card 1 — PQP -->
                <td width="33.33%" valign="top" style="padding:0 8px 16px 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F7FA; border-radius:10px;">
                    <tr>
                      <td style="padding:18px 16px;">
                        <div style="width:36px; height:36px; background-color:#1D1D39; border-radius:8px; text-align:center; line-height:36px; color:#FFFFFF; font-size:13px; font-weight:bold;">
                          PQP
                        </div>
                        <div style="color:#1D1D39; font-size:15px; font-weight:bold; margin-top:12px;">
                          PQP™
                        </div>
                        <div style="color:#6B6B76; font-size:12px; line-height:1.5; margin-top:4px; min-height:48px;">
                          Personality &amp; Qualities Profile — 20 behavioural dimensions.
                        </div>
                        <div style="border-top:1px solid #E4E4EA; margin:12px 0;"></div>
                        <div style="color:#6B6B76; font-size:11.5px; line-height:1.7;">
                          Username: <strong style="color:#1D1D39;">${claimedCredential.username}</strong><br>
                          Password: <strong style="color:#1D1D39;">${claimedCredential.password}</strong>
                        </div>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                          <tr>
                            <td align="center" style="background-color:#E11119; border-radius:16px;">
                              <a href="${pqpLink}" style="display:block; padding:8px 0; color:#FFFFFF; font-size:11.5px; font-weight:bold; text-decoration:none;">
                                Start Assessment
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>

                <!-- Card 2 — CPAT -->
                <td width="33.33%" valign="top" style="padding:0 8px 16px 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F7FA; border-radius:10px;">
                    <tr>
                      <td style="padding:18px 16px;">
                        <div style="width:36px; height:36px; background-color:#1D1D39; border-radius:8px; text-align:center; line-height:36px; color:#FFFFFF; font-size:13px; font-weight:bold;">
                          CPAT
                        </div>
                        <div style="color:#1D1D39; font-size:15px; font-weight:bold; margin-top:12px;">
                          CPAT™
                        </div>
                        <div style="color:#6B6B76; font-size:12px; line-height:1.5; margin-top:4px; min-height:48px;">
                          Competency &amp; capability evaluator across technical and managerial skills.
                        </div>
                        <div style="border-top:1px solid #E4E4EA; margin:12px 0;"></div>
                        <div style="color:#6B6B76; font-size:11.5px; line-height:1.7;">
                          Username: <strong style="color:#1D1D39;">${claimedCredential.username}</strong><br>
                          Password: <strong style="color:#1D1D39;">${claimedCredential.password}</strong>
                        </div>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                          <tr>
                            <td align="center" style="background-color:#E11119; border-radius:16px;">
                              <a href="${cpatLink}" style="display:block; padding:8px 0; color:#FFFFFF; font-size:11.5px; font-weight:bold; text-decoration:none;">
                                Start Assessment
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>

                <!-- Card 3 — Management Drives -->
                <td width="33.33%" valign="top" style="padding:0 8px 16px 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F7FA; border-radius:10px;">
                    <tr>
                      <td style="padding:18px 16px;">
                        <div style="width:36px; height:36px; background-color:#1D1D39; border-radius:8px; text-align:center; line-height:36px; color:#FFFFFF; font-size:12px; font-weight:bold;">
                          MD
                        </div>
                        <div style="color:#1D1D39; font-size:15px; font-weight:bold; margin-top:12px;">
                          Management&nbsp;Drives®
                        </div>
                        <div style="color:#6B6B76; font-size:12px; line-height:1.5; margin-top:4px; min-height:48px;">
                          Leadership &amp; drive dynamics across 6 core behavioural drives.
                        </div>
                        <div style="border-top:1px solid #E4E4EA; margin:12px 0;"></div>
                        <div style="color:#6B6B76; font-size:11.5px; line-height:1.7;">
                          Username: <strong style="color:#1D1D39;">${claimedCredential.username}</strong><br>
                          Password: <strong style="color:#1D1D39;">${claimedCredential.password}</strong>
                        </div>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                          <tr>
                            <td align="center" style="background-color:#E11119; border-radius:16px;">
                              <a href="${mdLink}" style="display:block; padding:8px 0; color:#FFFFFF; font-size:11.5px; font-weight:bold; text-decoration:none;">
                                Start Assessment
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>

              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== NOTE STRIP ===== -->
        <tr>
          <td style="padding:8px 40px 32px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EFF6F1; border-radius:8px;">
              <tr>
                <td style="padding:14px 18px; color:#2E6B45; font-size:12.5px; line-height:1.6;">
                  ✓ Specimen credentials for demonstration only, tied to your account. If an assessment is
                  temporarily unavailable, your access stays linked until it returns.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== SIGN-OFF ===== -->
        <tr>
          <td align="center" style="padding:0 40px 36px 40px;">
            <div style="color:#1D1D39; font-size:16px; font-style:italic;">
              Welcome aboard,
            </div>
            <div style="color:#1D1D39; font-size:16px; font-weight:bold; margin-top:4px;">
              The Freelancers Hub Team
            </div>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td style="background-color:#F7F7FA; padding:28px 40px; border-top:1px solid #ECECEF;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:14px;">
                  <a href="https://www.linkedin.com/company/ibdl-learning-group" style="display:inline-block; width:30px; height:30px; background-color:#1D1D39; border-radius:50%; text-align:center; line-height:30px; margin:0 4px; text-decoration:none;">
                    <span style="color:#FFFFFF; font-size:13px;">in</span>
                  </a>
                  <a href="https://ibdl.net" style="display:inline-block; width:30px; height:30px; background-color:#1D1D39; border-radius:50%; text-align:center; line-height:30px; margin:0 4px; text-decoration:none;">
                    <span style="color:#FFFFFF; font-size:13px;">🌐</span>
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center" style="color:#9A9AA5; font-size:11.5px; line-height:1.6;">
                  IBDL Learning Group &nbsp;·&nbsp; freelancers.hub@ibdl.net<br>
                  You're receiving this because you registered with Freelancers Hub.
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`,
      })
      .catch((err) =>
        console.warn('[Background Welcome Email Failed]', err instanceof Error ? err.message : err),
      );

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
