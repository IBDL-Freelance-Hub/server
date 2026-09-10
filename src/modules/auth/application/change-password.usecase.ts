import { PrismaClient } from '@prisma/client';
import {
  prisma as defaultPrisma,
  hashProvider as defaultHashProvider,
  IHashProvider,
  emailProvider as defaultEmailProvider,
  IEmailProvider,
} from '../../../shared/providers';
import { AuthenticationError, ValidationError } from '../../../shared/errors';
import {
  SessionService,
  sessionService as defaultSessionService,
} from '../infrastructure/session.service';
import { ChangePasswordInput } from '../presentation/auth.schema';

export interface ChangePasswordContext {
  userId: string;
  currentSessionId?: string;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface ChangePasswordResult {
  success: boolean;
  message: string;
}

export class ChangePasswordUseCase {
  constructor(
    private prisma: PrismaClient = defaultPrisma,
    private hashProv: IHashProvider = defaultHashProvider,
    private sessionSvc: SessionService = defaultSessionService,
    private emailSvc: IEmailProvider = defaultEmailProvider,
  ) {}

  async execute(
    input: ChangePasswordInput,
    context: ChangePasswordContext,
    meta?: RequestMeta,
  ): Promise<ChangePasswordResult> {
    // 1. Fetch User
    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
    });

    if (!user || !user.passwordHash) {
      throw new AuthenticationError('User not found.');
    }

    // 2. Verify currentPassword
    const isCurrentValid = await this.hashProv.verify(user.passwordHash, input.currentPassword);
    if (!isCurrentValid) {
      throw new AuthenticationError('Current password is incorrect.');
    }

    // 3. Reject if newPassword === currentPassword
    if (input.newPassword === input.currentPassword) {
      throw new ValidationError('New password cannot be identical to the current password.');
    }

    // 4. Reject if newPassword matches email or local part (SEC-21)
    const lowerNew = input.newPassword.toLowerCase();
    const emailLower = user.email.toLowerCase();
    const localPart = emailLower.split('@')[0];

    if (lowerNew === emailLower || (localPart && lowerNew === localPart)) {
      throw new ValidationError('Password cannot be the same as your email address or username.');
    }

    // 5. Hash new password
    const newPasswordHash = await this.hashProv.hash(input.newPassword);
    const ipAddress = meta?.ipAddress || '';

    // 6. Execute atomic update, session revocation, and audit logging
    await this.prisma.$transaction(async (tx) => {
      // Update User passwordHash
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      // Invalidate all other active sessions while keeping current acting session (SEC-28, SEC-25)
      await this.sessionSvc.revokeOtherUserSessions(
        user.id,
        context.currentSessionId || '',
        'Password Changed',
        tx,
      );

      // Record security audit log
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'PASSWORD_CHANGED',
          resource: 'User',
          resourceId: user.id,
          ipAddress,
        },
      });
    });

    // 7. Notify account holder via email (NTF-132)
    await this.emailSvc.sendEmail({
      to: user.email,
      subject: 'Security Notice: Your Password Has Been Changed',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #0056b3;">Security Notification</h2>
          <p>Hello,</p>
          <p>Your password for your <strong>IBDL Freelancer Hub</strong> account was changed successfully.</p>
          <p>If you made this change, no further action is required.</p>
          <p style="color: #d9534f; font-weight: bold;">If you did not perform this password change, please contact support immediately to secure your account.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">IBDL Freelancer Hub Security Team</p>
        </div>
      `,
    });

    return {
      success: true,
      message: 'Password changed successfully.',
    };
  }
}
