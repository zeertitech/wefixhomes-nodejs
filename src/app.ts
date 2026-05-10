import Fastify, { FastifyInstance } from 'fastify';
import { env } from './config/env';
import { setupPlugins, setupRoutes } from './setup';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,          // We use Winston instead
    trustProxy: true,       // Required when behind Railway / Nginx
    bodyLimit: parseInt(env.MAX_FILE_SIZE, 10),
  });

  // ── Setup Plugins & Middleware ────────────────────────────
  await setupPlugins(app);

  // ── Setup Routes ──────────────────────────────────────────
  await setupRoutes(app);

  return app;
}
