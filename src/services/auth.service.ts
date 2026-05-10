import { userRepository } from '../repositories/user.repository';
import { verifyPassword, hashPassword, generateSalt } from '../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { prisma } from '../config/prisma';
import { AuthError, ConflictError } from '../lib/errors';
import type { LoginInput, RegisterInput } from '../validators/auth.validator';
import { logger } from '../config/logger';
import { User, Role } from '@prisma/client';

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

    if (!stored || stored.expiresAt < new Date()) {
      throw new AuthError('Invalid or expired refresh token');
    }

    if (!stored.user.isActive) {
      throw new AuthError('Account is inactive');
    }

    verifyRefreshToken(token);

    const newAccessToken = signAccessToken({
      userId: stored.user.id,
      role: stored.user.role.name,
      roleId: stored.user.roleId,
      email: stored.user.email,
    });

    return { accessToken: newAccessToken };
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
}

export const authService = new AuthService();
