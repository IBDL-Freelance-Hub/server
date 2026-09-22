import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  cid?: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export interface IEmailProvider {
  sendEmail(params: SendEmailParams): Promise<void>;
}

export class SmtpEmailProvider implements IEmailProvider {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): Transporter | null {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });
    }

    return this.transporter;
  }

  async sendEmail({ to, subject, html, attachments = [] }: SendEmailParams): Promise<void> {
    if (!this.transporter) {
      this.initTransporter();
    }

    if (!this.transporter) {
      // Graceful fallback for local development or testing environments where SMTP is unset
      console.log(`[EmailProvider Fallback Log] To: ${to} | Subject: ${subject}`);
      return;
    }

    const fromAddress =
      process.env.EMAIL_FROM ||
      (process.env.SMTP_USER
        ? `Freelancers Hub <${process.env.SMTP_USER}>`
        : 'Freelancers Hub <freelancer-hub@ibdl.net>');

    const emailAttachments = [...attachments];
    if (
      html.includes('cid:ibdl-logo') &&
      !emailAttachments.some((att) => att.cid === 'ibdl-logo')
    ) {
      const logoPath = path.resolve(__dirname, '../assets/ibdl-official-logo.png');
      if (fs.existsSync(logoPath)) {
        emailAttachments.push({
          filename: 'ibdl-official-logo.png',
          path: logoPath,
          cid: 'ibdl-logo',
        });
      }
    }

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
      });

      console.log(`[SMTP Email Sent Successfully]: to=${to}, messageId=${info.messageId}`);
    } catch (error: unknown) {
      console.error('[EmailProvider Error] Failed to send email via SMTP:', error);
      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
    }
    if (!this.transporter) {
      return false;
    }
    try {
      await this.transporter.verify();
      return true;
    } catch (err) {
      console.error('[EmailProvider] Transporter verify failed:', err);
      return false;
    }
  }
}

// Backward-compatibility alias
export const ResendEmailProvider = SmtpEmailProvider;

export const emailProvider = new SmtpEmailProvider();
