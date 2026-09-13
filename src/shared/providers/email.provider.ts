import { Resend } from 'resend';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface IEmailProvider {
  sendEmail(params: SendEmailParams): Promise<void>;
}

export class ResendEmailProvider implements IEmailProvider {
  private resendClient: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resendClient = new Resend(apiKey);
    }
  }

  async sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && !this.resendClient) {
      this.resendClient = new Resend(apiKey);
    }

    if (!this.resendClient) {
      // Graceful fallback for local development or testing environments where RESEND_API_KEY is unset
      console.log(`[EmailProvider Fallback Log] To: ${to} | Subject: ${subject}`);
      return;
    }

    let targetEmail = to;
    if (process.env.NODE_ENV === 'development' && process.env.RESEND_TEST_RECIPIENT) {
      targetEmail = process.env.RESEND_TEST_RECIPIENT;
    }

    const fromAddress = process.env.EMAIL_FROM || 'IBDL Freelancer Hub <onboarding@resend.dev>';

    try {
      const response = await this.resendClient.emails.send({
        from: fromAddress,
        to: targetEmail,
        subject,
        html,
      });

      if (response.error) {
        console.error('[Resend API Error]:', response.error);

        const isResendRestriction =
          response.error.name === 'validation_error' ||
          (response.error as { statusCode?: number }).statusCode === 403 ||
          response.error.message?.includes('only send testing emails');

        if (isResendRestriction && process.env.NODE_ENV === 'development') {
          console.warn(
            `[EmailProvider Resend Sandbox Restriction] Email to '${to}' failed because Resend test mode only permits sending to your registered account (ashrafmarwa987@gmail.com).`,
          );
          return;
        }

        throw new Error(response.error.message || 'Failed to send email via Resend');
      }

      console.log(`[Resend Email Sent Successfully]: to=${targetEmail}, id=${response.data?.id}`);
    } catch (error: unknown) {
      console.error('[EmailProvider Error] Failed to send email via Resend:', error);
      throw error;
    }
  }
}

export const emailProvider = new ResendEmailProvider();
