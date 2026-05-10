import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { logger } from '../config/logger';

export function requestLogger(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  logger.info(`→ ${request.method} ${request.url}`, {
    ip: request.ip,
    ua: request.headers['user-agent']?.slice(0, 80),
  });
  done();
}
