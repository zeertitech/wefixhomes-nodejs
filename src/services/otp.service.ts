import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AuthError, BusinessError } from '../lib/errors';
import { emailService } from './email.service';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(`${env.PEPPER_SECRET}:${code}`).digest('hex');
}

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
}

export const otpService = new OtpService();
