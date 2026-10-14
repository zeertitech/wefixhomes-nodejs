import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service';
import { loginSchema, registerSchema, customerSignupSchema, verifyEmailOtpSchema, updateNameSchema, changePasswordSchema, startEmailChangeSchema, confirmCurrentEmailSchema, confirmNewEmailSchema, startPhoneChangeSchema, confirmPhoneSchema, forgotPasswordSchema, verifyForgotPasswordSchema, resetPasswordSchema } from '../validators/auth.validator';
import { sendSuccess, sendCreated } from '../lib/response';
import { setAuthCookies, clearAuthCookies } from '../utils/cookie';
import { BusinessError } from '../lib/errors';
import { storageService } from '../services/storage.service';
import { env } from '../config/env';

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = registerSchema.parse(request.body);
    const result = await authService.register(input);
    sendCreated(reply, result, 'User registered successfully');
  }

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = loginSchema.parse(request.body);
    const result = await authService.login(input, request.ip);

    // Save hardened HTTP-only cookies in browser
    setAuthCookies(reply, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    sendSuccess(reply, result, 'Login successful');
  }

  async refresh(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const bodyToken = (request.body as { refreshToken?: string })?.refreshToken;
    const cookieToken = request.cookies?.refreshToken;
    const token = bodyToken || cookieToken;

    if (!token) {
      throw new BusinessError('Refresh token is required');
    }

    const result = await authService.refresh(token);

    // Rotate both access + refresh token cookies
    setAuthCookies(reply, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    sendSuccess(reply, { accessToken: result.accessToken }, 'Token refreshed');
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const bodyToken = (request.body as { refreshToken?: string })?.refreshToken;
    const cookieToken = request.cookies?.refreshToken;
    const token = bodyToken || cookieToken;

    await authService.logout(request.user!.userId, token);

    // Clear session cookies from browser
    clearAuthCookies(reply);

    sendSuccess(reply, null, 'Logged out successfully');
  }

  async logoutAll(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await authService.logoutAll(request.user!.userId);

    // Clear session cookies from browser
    clearAuthCookies(reply);

    sendSuccess(reply, null, 'All sessions revoked');
  }

  async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    sendSuccess(reply, request.user, 'Authenticated user info');
  }

  async signup(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = customerSignupSchema.parse(request.body);
    const result = await authService.signup(input);
    sendSuccess(reply, result, 'Verification code sent');
  }

  async verifyEmail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = verifyEmailOtpSchema.parse(request.body);
    const result = await authService.verifyEmail(input.email, input.code, request.ip);
    setAuthCookies(reply, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    sendSuccess(reply, result, 'Email verified');
  }

  async profile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const profile = await authService.getProfile(request.user!.userId);
    sendSuccess(reply, profile, 'Profile');
  }

  async updateName(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = updateNameSchema.parse(request.body);
    const profile = await authService.updateName(request.user!.userId, input);
    sendSuccess(reply, profile, 'Name updated');
  }

  async uploadProfileImage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const file = await request.file();
    if (!file) throw new BusinessError('Image file is required');
    const buffer = await file.toBuffer();
    const fileName = await storageService.upload(
      buffer,
      file.filename,
      file.mimetype,
      env.R2_PUBLIC_FOLDER_PROFILE
    );
    const { previousFileName, profile } = await authService.uploadProfileImage(request.user!.userId, fileName);
    if (previousFileName && previousFileName !== fileName) {
      await storageService.delete(previousFileName, env.R2_PUBLIC_FOLDER_PROFILE).catch(() => undefined);
    }
    sendSuccess(reply, profile, 'Profile picture updated');
  }

  async startPhoneChange(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = startPhoneChangeSchema.parse(request.body);
    const result = await authService.startPhoneChange(request.user!.userId, input.phone);
    sendSuccess(reply, result, 'Verification code sent');
  }

  async confirmPhoneChange(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = confirmPhoneSchema.parse(request.body);
    const profile = await authService.confirmPhoneChange(request.user!.userId, input.phone, input.code);
    sendSuccess(reply, profile, 'Phone number updated');
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = forgotPasswordSchema.parse(request.body);
    const result = await authService.requestPasswordReset(input.identifier);
    sendSuccess(reply, result, 'Verification code sent');
  }

  async verifyForgotPassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = verifyForgotPasswordSchema.parse(request.body);
    const result = await authService.verifyPasswordReset(input.identifier, input.code);
    sendSuccess(reply, result, 'Code verified');
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = resetPasswordSchema.parse(request.body);
    const result = await authService.resetPassword(input, request.ip);
    setAuthCookies(reply, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    sendSuccess(reply, result, 'Password updated');
  }

  async sendPasswordCode(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = await authService.sendPasswordCode(request.user!.userId);
    sendSuccess(reply, result, 'Verification code sent');
  }

  async changePassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = changePasswordSchema.parse(request.body);
    await authService.changePassword(request.user!.userId, input);
    sendSuccess(reply, null, 'Password updated');
  }

  async startEmailChange(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = startEmailChangeSchema.parse(request.body);
    const result = await authService.startEmailChange(request.user!.userId, input.newEmail);
    sendSuccess(reply, result, 'Verification code sent');
  }

  async confirmCurrentEmail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = confirmCurrentEmailSchema.parse(request.body);
    const result = await authService.confirmCurrentEmail(request.user!.userId, input.code);
    sendSuccess(reply, result, 'Code sent to the new email');
  }

  async confirmNewEmail(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = confirmNewEmailSchema.parse(request.body);
    const user = await authService.confirmNewEmail(request.user!.userId, input.newEmail, input.code);
    sendSuccess(reply, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
    }, 'Email updated');
  }
}

export const authController = new AuthController();
