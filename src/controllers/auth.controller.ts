import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service';
import { loginSchema, refreshTokenSchema, registerSchema } from '../validators/auth.validator';
import { sendSuccess, sendCreated } from '../lib/response';

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = registerSchema.parse(request.body);
    const result = await authService.register(input);
    sendCreated(reply, result, 'User registered successfully');
  }

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = loginSchema.parse(request.body);
    const result = await authService.login(input, request.ip);
    sendSuccess(reply, result, 'Login successful');
  }

  async refresh(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { refreshToken } = refreshTokenSchema.parse(request.body);
    const result = await authService.refresh(refreshToken);
    sendSuccess(reply, result, 'Token refreshed');
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { refreshToken } = (request.body as { refreshToken?: string }) || {};
    await authService.logout(request.user!.userId, refreshToken);
    sendSuccess(reply, null, 'Logged out successfully');
  }

  async logoutAll(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await authService.logoutAll(request.user!.userId);
    sendSuccess(reply, null, 'All sessions revoked');
  }

  async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    sendSuccess(reply, request.user, 'Authenticated user info');
  }
}

export const authController = new AuthController();
