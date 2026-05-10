import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, AuthError } from '../lib/errors';

export function authorize(...roles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AuthError('Not authenticated');
    }
    if (!roles.includes(request.user.role)) {
      throw new ForbiddenError(
        `Required role: ${roles.join(' or ')}. Your role: ${request.user.role}`
      );
    }
  };
}
