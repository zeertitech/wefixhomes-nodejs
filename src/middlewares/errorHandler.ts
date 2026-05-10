import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../config/logger';

export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Always log the error
  const isOperational = error instanceof AppError && error.statusCode < 500;
  const showStack = process.env['NODE_ENV'] === 'development' && !isOperational;

  logger.error('Request error', {
    url: request.url,
    method: request.method,
    errorName: error.name,
    message: error.message,
    stack: showStack ? error.stack : undefined,
  });

  // Zod validation errors
  if (error instanceof ZodError) {
    void reply.status(400).send({
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details: error.flatten().fieldErrors,
      },
    });
    return;
  }

  // Our custom app errors
  if (error instanceof AppError) {
    void reply.status(error.statusCode).send({
      success: false,
      message: error.message,
      error: {
        code: error.code,
        ...('details' in error && error.details !== undefined
          ? { details: error.details }
          : {}),
      },
    });
    return;
  }

  // Fastify built-in validation errors (JSON schema)
  if ('validation' in error && Array.isArray(error.validation)) {
    void reply.status(400).send({
      success: false,
      message: 'Request validation failed',
      error: { code: 'VALIDATION_ERROR', details: error.validation },
    });
    return;
  }

  // Fastify 404
  if ('statusCode' in error && error.statusCode === 404) {
    void reply.status(404).send({
      success: false,
      message: 'Route not found',
      error: { code: 'NOT_FOUND' },
    });
    return;
  }

  // Fallback — hide internal details in production
  void reply.status(500).send({
    success: false,
    message:
      process.env['NODE_ENV'] === 'development'
        ? error.message
        : 'Internal server error',
    error: { code: 'INTERNAL_ERROR' },
  });
}
