import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service';
import { loginSchema, registerSchema } from '../validators/auth.validator';
import { sendSuccess, sendCreated } from '../lib/response';
import { setAuthCookies, clearAuthCookies } from '../utils/cookie';
import { BusinessError } from '../lib/errors';

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
}

export const authController = new AuthController();
