import { userRepository } from '../repositories/user.repository';
import { verifyPassword, hashPassword, generateSalt } from '../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { prisma } from '../config/prisma';
import { AuthError, ConflictError, BusinessError } from '../lib/errors';
import type { ChangePasswordInput, CustomerSignupInput, LoginInput, RegisterInput, ResetPasswordInput, UpdateNameInput } from '../validators/auth.validator';
import { logger } from '../config/logger';
import { User, Role } from '@prisma/client';
import { otpService } from './otp.service';
import { env } from '../config/env';

type UserWithRole = User & { role: Role };

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('User with this email already exists');
    }

    const customerRole = await userRepository.findRoleByName('CUSTOMER');
    if (!customerRole) throw new Error('Default role not found');

    const salt = generateSalt();
    const passwordHash = await hashPassword(input.password, salt);
    const user = await userRepository.create({
      email: input.email,
      passwordHash,
      salt,
      roleId: customerRole.id,
      firstName: input.firstName,
      lastName: input.lastName,
      emailVerified: true,
    });

    logger.info('New user registered', { userId: user.id, email: user.email });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      role: customerRole.name,
    };
  }

  async login(input: LoginInput, ip: string) {
    const user = (await prisma.user.findUnique({
      where: { email: input.email },
      include: { role: true },
    })) as UserWithRole | null;

    if (!user || !user.isActive) {
      throw new AuthError('Invalid email or password');
    }

    const isValid = await verifyPassword(input.password, user.passwordHash, user.salt);
    if (!isValid) {
      logger.warn('Failed login attempt', { email: input.email, ip });
      throw new AuthError('Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new AuthError('Verify your email before signing in');
    }

    const payload = {
      userId: user.id,
      role: user.role.name,
      roleId: user.roleId,
      email: user.email,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await userRepository.createRefreshToken(user.id, refreshToken, expiresAt);
    await userRepository.updateLastLogin(user.id);

    logger.info('User logged in', { userId: user.id, role: user.role.name, ip });

    return this.sessionFor(user, accessToken, refreshToken);
  }

  async requestLoginOtp(phone: string) {
    const user = await userRepository.findByPhone(phone);
    if (!user || !user.isActive || user.deletedAt) {
      return { sent: true };
    }

    try {
      await otpService.sendSmsCode(user.id, phone, 'LOGIN');
    } catch (err) {
      if (err instanceof BusinessError || err instanceof AuthError) throw err;
      logger.error('Failed to send login SMS', { userId: user.id });
      throw new BusinessError('Could not send the verification SMS. Try again.');
    }

    return { sent: true };
  }

  async verifyLoginOtp(phone: string, code: string, ip: string) {
    const userId = await otpService.verifySmsCode(phone, code, 'LOGIN');
    const user = (await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    })) as UserWithRole | null;

    if (!user || !user.isActive || user.deletedAt || user.phone !== phone) {
      throw new AuthError('Invalid or expired code');
    }
    if (!user.emailVerified) {
      throw new AuthError('Verify your email before signing in');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true },
    });

    const payload = {
      userId: user.id,
      role: user.role.name,
      roleId: user.roleId,
      email: user.email,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await userRepository.createRefreshToken(user.id, refreshToken, expiresAt);
    await userRepository.updateLastLogin(user.id);

    logger.info('User logged in with SMS OTP', { userId: user.id, ip });
    return this.sessionFor(user, accessToken, refreshToken);
  }

  private sessionFor(user: UserWithRole, accessToken: string, refreshToken: string) {
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role.name,
        roleId: user.roleId,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async refresh(token: string) {
    const stored = (await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { include: { role: true } } },
    })) as { user: UserWithRole; expiresAt: Date } | null;

    if (!stored) {
      // Token not in DB — could be a replay attack. Revoke all sessions for safety.
      let userId: string | undefined;
      try {
        const { verifyRefreshToken } = await import('../utils/jwt');
        const decoded = verifyRefreshToken(token);
        userId = decoded.userId;
      } catch {
        // ignore — token is malformed anyway
      }
      if (userId) {
        await userRepository.deleteAllRefreshTokens(userId);
        logger.warn('Refresh token reuse detected — all sessions revoked', { userId });
      }
      throw new AuthError('Invalid or expired refresh token');
    }

    if (stored.expiresAt < new Date()) {
      await userRepository.deleteRefreshToken(token);
      throw new AuthError('Refresh token has expired. Please log in again.');
    }

    if (!stored.user.isActive) {
      throw new AuthError('Account is inactive');
    }

    // Verify JWT signature (catches tampering even if token exists in DB)
    verifyRefreshToken(token);

    const payload = {
      userId: stored.user.id,
      role: stored.user.role.name,
      roleId: stored.user.roleId,
      email: stored.user.email,
    };

    // ── Token Rotation ──
    // Issue new access + refresh tokens, revoke the old refresh token
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    await userRepository.deleteRefreshToken(token);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await userRepository.createRefreshToken(payload.userId, newRefreshToken, newExpiresAt);

    logger.info('Token rotated via /refresh endpoint', { userId: payload.userId });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string, token?: string): Promise<void> {
    if (token) {
      await userRepository.deleteRefreshToken(token);
    } else {
      await userRepository.deleteAllRefreshTokens(userId);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await userRepository.deleteAllRefreshTokens(userId);
    logger.info('All sessions revoked', { userId });
  }

  async signup(input: CustomerSignupInput) {
    const email = input.email;
    const phoneOwner = await userRepository.findByPhone(input.phone);
    if (phoneOwner && phoneOwner.email !== email) {
      throw new ConflictError('This mobile number is already in use');
    }

    const existing = await userRepository.findByEmail(email);
    if (existing?.emailVerified) {
      throw new ConflictError('An account with this email already exists');
    }
    if (existing && existing.phone && existing.phone !== input.phone && phoneOwner) {
      throw new ConflictError('This mobile number is already in use');
    }

    const customerRole = await userRepository.findRoleByName('CUSTOMER');
    if (!customerRole) throw new Error('Default role not found');

    const salt = generateSalt();
    const passwordHash = await hashPassword(input.password, salt);
    const [firstName, ...rest] = input.fullName.trim().split(/\s+/);
    const lastName = rest.join(' ').slice(0, 50);

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            phone: input.phone,
            passwordHash,
            salt,
            firstName: firstName.slice(0, 50),
            lastName,
            emailVerified: false,
          },
        })
      : await userRepository.create({
          email,
          phone: input.phone,
          passwordHash,
          salt,
          roleId: customerRole.id,
          firstName: firstName.slice(0, 50),
          lastName,
          emailVerified: false,
        });

    try {
      await otpService.sendEmailRegisterCode(user.id, email);
    } catch (err) {
      if (err instanceof BusinessError || err instanceof AuthError) throw err;
      logger.error('Failed to send verification email', { userId: user.id });
      throw new BusinessError('Could not send the verification email. Try again.');
    }

    try {
      await otpService.sendSmsCode(user.id, input.phone, 'REGISTER');
    } catch (err) {
      if (err instanceof BusinessError || err instanceof AuthError) throw err;
      logger.error('Failed to send verification SMS', { userId: user.id });
      throw new BusinessError('Could not send the verification SMS. Try again.');
    }

    return { email };
  }

  async verifySignupPhone(phone: string, code: string) {
    const userId = await otpService.verifySmsCode(phone, code, 'REGISTER');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.deletedAt || user.phone !== phone) {
      throw new AuthError('Invalid or expired code');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true },
    });
    return { phoneVerified: true };
  }

  async verifyEmail(email: string, code: string, ip: string) {
    const userId = await otpService.verifyEmailRegisterCode(email, code);
    const user = (await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    })) as UserWithRole | null;

    if (!user || !user.isActive) {
      throw new AuthError('Invalid or expired code');
    }

    const payload = {
      userId: user.id,
      role: user.role.name,
      roleId: user.roleId,
      email: user.email,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await userRepository.createRefreshToken(user.id, refreshToken, expiresAt);
    await userRepository.updateLastLogin(user.id);

    logger.info('Email verified and user signed in', { userId: user.id, ip });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role.name,
        roleId: user.roleId,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  private async requireActiveUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user || !user.isActive || user.deletedAt) throw new AuthError();
    return user;
  }

  async getProfile(userId: string) {
    const user = await this.requireActiveUser(userId);
    return this.presentProfile(user);
  }

  async updateName(userId: string, input: UpdateNameInput) {
    await this.requireActiveUser(userId);
    const [first, ...rest] = input.fullName.trim().split(/\s+/);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { firstName: first.slice(0, 50), lastName: rest.join(' ').slice(0, 50) },
    });
    return this.presentProfile(user);
  }

  async uploadProfileImage(userId: string, fileName: string) {
    const current = await this.requireActiveUser(userId);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { profileImage: fileName },
    });
    return { previousFileName: current.profileImage, profile: this.presentProfile(user) };
  }

  async startPhoneChange(userId: string, phone: string) {
    const user = await this.requireActiveUser(userId);
    if (phone === user.phone) throw new BusinessError('That is already your phone number');
    const taken = await userRepository.findByPhone(phone);
    if (taken && taken.id !== userId) throw new ConflictError('This mobile number is already in use');
    try {
      await otpService.sendSmsCode(user.id, phone, 'CHANGE_PHONE');
    } catch (err) {
      if (err instanceof BusinessError || err instanceof AuthError) throw err;
      logger.error('Failed to send phone-change SMS', { userId: user.id });
      throw new BusinessError('Could not send the verification SMS. Try again.');
    }
    return { phone };
  }

  async confirmPhoneChange(userId: string, phone: string, code: string) {
    const user = await this.requireActiveUser(userId);
    const verifiedUserId = await otpService.verifySmsCode(phone, code, 'CHANGE_PHONE');
    if (verifiedUserId !== user.id) throw new AuthError('Invalid or expired code');
    const taken = await userRepository.findByPhone(phone);
    if (taken && taken.id !== userId) throw new ConflictError('This mobile number is already in use');
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerified: true },
    });
    return this.presentProfile(updated);
  }

  private presentProfile(user: { firstName: string; lastName: string; email: string; phone: string | null; profileImage: string | null }) {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return {
      fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      profileImage: user.profileImage,
      profileImageUrl: this.profileImageUrl(user.profileImage),
    };
  }

  private profileImageUrl(fileName: string | null) {
    if (!fileName || !env.R2_PUBLIC_URL) return null;
    const baseUrl = env.R2_PUBLIC_URL.replace(/\/+$/, '');
    const folder = env.R2_PUBLIC_FOLDER_PROFILE.replace(/^\/+|\/+$/g, '');
    const name = fileName.includes('/') ? fileName.split('/').pop() : fileName;
    return `${baseUrl}/${folder}/${name}`;
  }

  async requestPasswordReset(identifier: string) {
    const user = await this.findAccountForReset(identifier);
    try {
      await otpService.sendPasswordResetCode(user.id, user.email);
    } catch (err) {
      if (err instanceof BusinessError || err instanceof AuthError) throw err;
      logger.error('Failed to send password reset email', { userId: user.id });
      throw new BusinessError('Could not send the verification email. Try again.');
    }
    return { maskedEmail: maskEmail(user.email) };
  }

  async verifyPasswordReset(identifier: string, code: string) {
    const user = await this.findAccountForReset(identifier);
    const resetToken = await otpService.verifyPasswordResetCode(user.email, code);
    return { resetToken };
  }

  async resetPassword(input: ResetPasswordInput, ip: string) {
    const userId = await otpService.consumePasswordResetToken(input.resetToken);
    const user = (await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    })) as UserWithRole | null;

    if (!user || !user.isActive || user.deletedAt) {
      throw new AuthError('Reset session expired. Request a new code');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(input.password, salt);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, salt, emailVerified: true },
    });
    await userRepository.deleteAllRefreshTokens(user.id);

    const payload = {
      userId: user.id,
      role: user.role.name,
      roleId: user.roleId,
      email: user.email,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await userRepository.createRefreshToken(user.id, refreshToken, expiresAt);
    await userRepository.updateLastLogin(user.id);

    logger.info('Password reset and user signed in', { userId: user.id, ip });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role.name,
        roleId: user.roleId,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  private async findAccountForReset(identifier: string) {
    const target = parseResetIdentifier(identifier);
    const user = target.email
      ? await userRepository.findByEmail(target.email)
      : await userRepository.findByPhone(target.phone!);

    if (!user || !user.isActive || user.deletedAt) {
      throw new BusinessError('No account found for that email or phone number');
    }
    return user;
  }

  async sendPasswordCode(userId: string) {
    const user = await this.requireActiveUser(userId);
    await otpService.sendAccountCode(user.id, user.email, 'CHANGE_PASSWORD');
    return { email: user.email };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.requireActiveUser(userId);
    await otpService.verifyAccountCode(user.id, user.email, input.code, 'CHANGE_PASSWORD');
    const salt = generateSalt();
    const passwordHash = await hashPassword(input.password, salt);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash, salt } });
  }

  async startEmailChange(userId: string, newEmail: string) {
    const user = await this.requireActiveUser(userId);
    if (newEmail === user.email) throw new BusinessError('That is already your email');
    const taken = await userRepository.findByEmail(newEmail);
    if (taken) throw new ConflictError('An account with this email already exists');
    await otpService.sendAccountCode(user.id, user.email, 'CHANGE_EMAIL_CURRENT', newEmail);
    return { currentEmail: user.email };
  }

  async confirmCurrentEmail(userId: string, code: string) {
    const user = await this.requireActiveUser(userId);
    const { subject: newEmail } = await otpService.verifyAccountCode(
      user.id,
      user.email,
      code,
      'CHANGE_EMAIL_CURRENT'
    );
    if (!newEmail) throw new AuthError('Invalid or expired code');
    const taken = await userRepository.findByEmail(newEmail);
    if (taken) throw new ConflictError('An account with this email already exists');
    await otpService.sendAccountCode(user.id, newEmail, 'CHANGE_EMAIL_NEW');
    return { newEmail };
  }

  async confirmNewEmail(userId: string, newEmail: string, code: string) {
    const user = await this.requireActiveUser(userId);
    await otpService.verifyAccountCode(user.id, newEmail, code, 'CHANGE_EMAIL_NEW');
    const taken = await userRepository.findByEmail(newEmail);
    if (taken && taken.id !== user.id) throw new ConflictError('An account with this email already exists');
    return prisma.user.update({
      where: { id: user.id },
      data: { email: newEmail, emailVerified: true },
      select: { id: true, firstName: true, lastName: true, email: true, role: { select: { name: true } } },
    });
  }
}

function parseResetIdentifier(raw: string): { email?: string; phone?: string } {
  const value = raw.trim();
  if (value.includes('@')) {
    const email = value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new BusinessError('Enter a valid email or 10-digit mobile number');
    }
    return { email };
  }

  const digits = value.replace(/\D/g, '');
  const phone =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;

  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw new BusinessError('Enter a valid email or 10-digit mobile number');
  }
  return { phone };
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  const visible = name.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(name.length - 1, 1))}@${domain}`;
}

export const authService = new AuthService();
