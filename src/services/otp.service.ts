import { OtpPurpose } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AuthError, BusinessError } from '../lib/errors';
import { emailService } from './email.service';
import { indianMobile, smsService } from './sms.service';

const OTP_TTL_MS = 10 * 60 * 1000;
const SMS_OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(`${env.PEPPER_SECRET}:${code}`).digest('hex');
}

const EMAIL_COPY: Record<string, { title: string; detail: string; subject: string }> = {
  REGISTER: {
    title: 'Confirm your email',
    detail: 'Use this code to finish creating your account. It expires in 10 minutes.',
    subject: 'Your Shanandra verification code',
  },
  CHANGE_PASSWORD: {
    title: 'Change your password',
    detail: 'Use this code to confirm the password change. It expires in 10 minutes.',
    subject: 'Your Shanandra password code',
  },
  CHANGE_EMAIL_CURRENT: {
    title: 'Confirm your current email',
    detail: 'Use this code to approve an email change on your Shanandra account. It expires in 10 minutes.',
    subject: 'Confirm your Shanandra email change',
  },
  CHANGE_EMAIL_NEW: {
    title: 'Confirm your new email',
    detail: 'Use this code to finish changing the email on your Shanandra account. It expires in 10 minutes.',
    subject: 'Confirm your new Shanandra email',
  },
  CHANGE_PHONE: {
    title: 'Confirm your new mobile number',
    detail: 'Use this code to approve a mobile number change on your Shanandra account. It expires in 10 minutes.',
    subject: 'Confirm your Shanandra mobile number',
  },
  RESET_PASSWORD: {
    title: 'Reset your password',
    detail: 'Use this code to reset your Shanandra password. It expires in 10 minutes.',
    subject: 'Your Shanandra password reset code',
  },
};

export class OtpService {
  async sendEmailRegisterCode(userId: string, email: string): Promise<void> {
    const now = new Date();
    const recent = await prisma.otpCode.findFirst({
      where: {
        destination: email,
        channel: 'EMAIL',
        purpose: 'REGISTER',
        consumedAt: null,
        createdAt: { gt: new Date(now.getTime() - RESEND_COOLDOWN_MS) },
      },
    });
    if (recent) {
      throw new BusinessError('Please wait a minute before requesting another code');
    }

    const sentThisHour = await prisma.otpCode.count({
      where: {
        destination: email,
        channel: 'EMAIL',
        purpose: 'REGISTER',
        createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) },
      },
    });
    if (sentThisHour >= MAX_CODES_PER_HOUR) {
      throw new BusinessError('Too many codes requested. Try again later');
    }

    await prisma.otpCode.updateMany({
      where: { destination: email, channel: 'EMAIL', purpose: 'REGISTER', consumedAt: null },
      data: { consumedAt: now },
    });

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const created = await prisma.otpCode.create({
      data: {
        userId,
        channel: 'EMAIL',
        purpose: 'REGISTER',
        destination: email,
        codeHash: hashCode(code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      },
    });

    try {
      await emailService.sendVerificationCode(email, code);
    } catch (err) {
      await prisma.otpCode.delete({ where: { id: created.id } }).catch(() => undefined);
      throw err;
    }
  }

  async verifyEmailRegisterCode(email: string, code: string): Promise<string> {
    const otp = await prisma.otpCode.findFirst({
      where: {
        destination: email,
        channel: 'EMAIL',
        purpose: 'REGISTER',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp?.userId) {
      throw new AuthError('Invalid or expired code');
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      await prisma.otpCode.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      throw new AuthError('Too many attempts. Request a new code');
    }

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });

    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(hashCode(code), 'hex');
    const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

    if (!matches) {
      throw new AuthError('Invalid or expired code');
    }

    await prisma.$transaction([
      prisma.otpCode.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: otp.userId },
        data: { emailVerified: true },
      }),
    ]);

    return otp.userId;
  }

  async sendPasswordResetCode(userId: string, email: string): Promise<void> {
    await this.issue(userId, email, 'RESET_PASSWORD');
  }

  async verifyPasswordResetCode(email: string, code: string): Promise<string> {
    const otp = await prisma.otpCode.findFirst({
      where: {
        destination: email,
        channel: 'EMAIL',
        purpose: 'RESET_PASSWORD',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp?.userId) throw new AuthError('Invalid or expired code');

    if (otp.attempts >= MAX_ATTEMPTS) {
      await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      throw new AuthError('Too many attempts. Request a new code');
    }

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });

    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(hashCode(code), 'hex');
    const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    if (!matches) throw new AuthError('Invalid or expired code');

    const resetToken = crypto.randomBytes(32).toString('hex');
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { subject: hashCode(resetToken) },
    });
    return resetToken;
  }

  async consumePasswordResetToken(resetToken: string): Promise<string> {
    const otp = await prisma.otpCode.findFirst({
      where: {
        channel: 'EMAIL',
        purpose: 'RESET_PASSWORD',
        subject: hashCode(resetToken),
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!otp?.userId) throw new AuthError('Reset session expired. Request a new code');

    const consumed = await prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new AuthError('Reset session expired. Request a new code');
    return otp.userId;
  }

  async sendAccountCode(userId: string, email: string, purpose: OtpPurpose, subject?: string) {
    await this.issue(userId, email, purpose, subject);
  }

  async verifyAccountCode(userId: string, email: string, code: string, purpose: OtpPurpose) {
    const otp = await prisma.otpCode.findFirst({
      where: {
        userId,
        destination: email,
        channel: 'EMAIL',
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) throw new AuthError('Invalid or expired code');

    if (otp.attempts >= MAX_ATTEMPTS) {
      await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      throw new AuthError('Too many attempts. Request a new code');
    }

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });

    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(hashCode(code), 'hex');
    const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    if (!matches) throw new AuthError('Invalid or expired code');

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    return { subject: otp.subject };
  }

  async sendSmsCode(userId: string, phone: string, purpose: OtpPurpose): Promise<void> {
    const destination = indianMobile(phone);
    const now = new Date();
    const recent = await prisma.otpCode.findFirst({
      where: {
        destination,
        channel: 'SMS',
        purpose,
        consumedAt: null,
        createdAt: { gt: new Date(now.getTime() - RESEND_COOLDOWN_MS) },
      },
    });
    if (recent) throw new BusinessError('Please wait a minute before requesting another code');

    const sentThisHour = await prisma.otpCode.count({
      where: {
        destination,
        channel: 'SMS',
        purpose,
        createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) },
      },
    });
    if (sentThisHour >= MAX_CODES_PER_HOUR) {
      throw new BusinessError('Too many codes requested. Try again later');
    }

    await prisma.otpCode.updateMany({
      where: { destination, channel: 'SMS', purpose, consumedAt: null },
      data: { consumedAt: now },
    });

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const created = await prisma.otpCode.create({
      data: {
        userId,
        channel: 'SMS',
        purpose,
        destination,
        codeHash: hashCode(code),
        expiresAt: new Date(now.getTime() + SMS_OTP_TTL_MS),
      },
    });

    try {
      await smsService.sendOtp(destination, code);
    } catch (err) {
      await prisma.otpCode.delete({ where: { id: created.id } }).catch(() => undefined);
      throw err;
    }
  }

  async verifySmsCode(phone: string, code: string, purpose: OtpPurpose): Promise<string> {
    const destination = indianMobile(phone);
    const otp = await prisma.otpCode.findFirst({
      where: {
        destination,
        channel: 'SMS',
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp?.userId) throw new AuthError('Invalid or expired code');

    if (otp.attempts >= MAX_ATTEMPTS) {
      await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      throw new AuthError('Too many attempts. Request a new code');
    }

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });

    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(hashCode(code), 'hex');
    const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    if (!matches) throw new AuthError('Invalid or expired code');

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    return otp.userId;
  }

  private async issue(userId: string, email: string, purpose: OtpPurpose, subject?: string) {
    const now = new Date();
    const recent = await prisma.otpCode.findFirst({
      where: {
        destination: email,
        channel: 'EMAIL',
        purpose,
        consumedAt: null,
        createdAt: { gt: new Date(now.getTime() - RESEND_COOLDOWN_MS) },
      },
    });
    if (recent) throw new BusinessError('Please wait a minute before requesting another code');

    const sentThisHour = await prisma.otpCode.count({
      where: {
        destination: email,
        channel: 'EMAIL',
        purpose,
        createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) },
      },
    });
    if (sentThisHour >= MAX_CODES_PER_HOUR) {
      throw new BusinessError('Too many codes requested. Try again later');
    }

    await prisma.otpCode.updateMany({
      where: { destination: email, channel: 'EMAIL', purpose, consumedAt: null },
      data: { consumedAt: now },
    });

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const created = await prisma.otpCode.create({
      data: {
        userId,
        channel: 'EMAIL',
        purpose,
        destination: email,
        subject: subject ?? null,
        codeHash: hashCode(code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      },
    });

    try {
      await emailService.sendVerificationCode(email, code, EMAIL_COPY[purpose]);
    } catch (err) {
      await prisma.otpCode.delete({ where: { id: created.id } }).catch(() => undefined);
      throw err;
    }
  }
}

export const otpService = new OtpService();
