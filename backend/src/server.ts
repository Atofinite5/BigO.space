import app from './app';
import { env } from './config/env';
import { prisma, disconnectPrisma } from './config/database';
import { redisClient, disconnectRedis } from './config/redis';
import { logger } from './shared/logger';
import { sessionService } from './modules/ai-session/session.service';

const PORT = env.PORT;

async function bootstrap(): Promise<void> {
  // Verify DB connectivity on startup
  await prisma.$connect();
  logger.info('✅  PostgreSQL connected');

  // ioredis is configured with lazyConnect, but importing app/middleware
  // (e.g. the rate limiter's RedisStore) can issue a command that triggers
  // the connection before we reach here. Only call connect() if still in the
  // initial 'wait' state — otherwise it throws "already connecting/connected".
  if (redisClient.status === 'wait') {
    await redisClient.connect();
  }
  // Verify connectivity regardless of who initiated the connection.
  await redisClient.ping();
  logger.info('✅  Redis connected');

  const server = app.listen(PORT, () => {
    logger.info(`🚀  Server running on http://localhost:${PORT} [${env.NODE_ENV}]`);
  });

  // ─── Background Job: Expire stale sessions every 2 minutes ───────────────
  const STALE_CHECK_INTERVAL = 2 * 60 * 1000;
  const staleJob = setInterval(async () => {
    try {
      await sessionService.expireStale();
    } catch (err) {
      logger.error({ err }, 'Error in stale session cleanup job');
    }
  }, STALE_CHECK_INTERVAL);

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`);
    clearInterval(staleJob);

    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectPrisma();
      await disconnectRedis();
      logger.info('All connections closed. Exiting.');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception — shutting down');
    void shutdown('uncaughtException');
  });
}

bootstrap().catch((err) => {
  console.error('❌  Failed to start server:', err);
  process.exit(1);
});
