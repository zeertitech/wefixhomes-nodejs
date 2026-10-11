import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });

    logger.info(`🚀  Server listening on port ${env.PORT}`);
  } catch (err) {
    logger.error('Failed to start server', { err });
    process.exit(1);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────
(['SIGINT', 'SIGTERM'] as NodeJS.Signals[]).forEach((signal) => {
  process.on(signal, () => {
    logger.info(`Received ${signal} — shutting down gracefully`);
    process.exit(0);
  });
});

// ── Unhandled rejection safety net ───────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});

main();
// restarted for public product routes
