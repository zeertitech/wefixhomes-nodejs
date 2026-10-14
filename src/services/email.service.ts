import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { BusinessError } from '../lib/errors';
import { logger } from '../config/logger';
import { verificationCodeEmail } from './email-templates';

export class EmailService {
  async sendVerificationCode(to: string, code: string): Promise<void> {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
      throw new BusinessError('Email delivery is not configured yet');
    }

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });

    const message = verificationCodeEmail(code);
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    logger.info('Verification email sent', { to });
  }
}

export const emailService = new EmailService();
