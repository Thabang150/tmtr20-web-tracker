import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startMonthlyReportScheduler } from './jobs/monthly-report.job.js';

async function start(): Promise<void> {
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'TMTR20 Website Intelligence API started');
  });
  const scheduler = startMonthlyReportScheduler();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown requested');
    scheduler?.stop();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
