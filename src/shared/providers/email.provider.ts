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

    const fromAddress = process.env.EMAIL_FROM || 'IBDL Freelancer Hub <onboarding@resend.dev>';

    try {
      await this.resendClient.emails.send({
        from: fromAddress,
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('[EmailProvider Error] Failed to send email via Resend:', error);
      throw error;
    }
  }
}

export const emailProvider = new ResendEmailProvider();
