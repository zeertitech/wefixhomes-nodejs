import { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { prisma } from '../config/prisma';

export async function systemRoutes(app: FastifyInstance) {
  app.get('/health', {
    schema: { tags: ['System' as never], summary: 'Liveness check' },
    handler: async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  });

  app.get('/ready', {
    schema: { tags: ['System' as never], summary: 'Readiness check' },
    handler: async () => ({
      status: 'ready',
      version: '1.0.0',
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }),
  });

  app.get('/db-status', {
    schema: { tags: ['System' as never], summary: 'Database status check' },
    handler: async (_request, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return {
          status: 'ok',
          message: 'Database is connected',
          timestamp: new Date().toISOString(),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        reply.status(500);
        return {
          status: 'error',
          message: 'Database connection failed',
          error: message,
          timestamp: new Date().toISOString(),
        };
      }
    },
  });
}
