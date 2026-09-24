import { Server } from 'http';
import app from './app';
import { env } from './config/env.config';
import { prisma } from './shared/providers';

let server: Server;
let isShuttingDown = false;

async function bootstrap() {
  try {
    // 1. Database Health Ping on Startup (C2)
    await prisma.$queryRaw`SELECT 1`;
    console.log('[Database]: Connected to PostgreSQL successfully.');

    // 2. Start HTTP Server
    server = app.listen(env.PORT, () => {
      console.log(
        `[Server]: IBDL Freelancers Hub API running on port ${env.PORT} [${env.NODE_ENV}]`,
      );
    });
  } catch (error) {
    console.error('[Bootstrap Error]: Failed to start application server:', error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

// 3. Graceful Shutdown Handler (B10)
async function gracefulShutdown(signal: string, exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[Process]: Received ${signal}. Initiating graceful shutdown...`);

  // Close idle HTTP keep-alive connections immediately so server.close doesn't hang
  if (server && typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }

  // Safety force-exit timeout (10 seconds)
  const forceExitTimeout = setTimeout(async () => {
    console.error('[Process]: Graceful shutdown timed out after 10s. Forcing exit.');
    try {
      await prisma.$disconnect();
    } catch {
      // Ignore errors on emergency exit
    }
    process.exit(1);
  }, 10000);

  // Ensure timer doesn't keep process alive if everything closes cleanly
  forceExitTimeout.unref();

  // In-flight active connection drain grace period (5 seconds)
  const drainTimeout = setTimeout(() => {
    if (server && typeof server.closeAllConnections === 'function') {
      console.warn('[Process]: In-flight request drain limit reached; closing active sockets.');
      server.closeAllConnections();
    }
  }, 5000);
  drainTimeout.unref();

  if (server) {
    server.close(async (err) => {
      if (err) {
        console.error('[Server Close Error]: Error closing HTTP server:', err);
      } else {
        console.log('[Server]: HTTP server closed cleanly.');
      }

      try {
        await prisma.$disconnect();
        console.log('[Database]: Prisma client disconnected cleanly.');
      } catch (dbErr) {
        console.error('[Database Disconnect Error]:', dbErr);
      }

      console.log('[Process]: Graceful shutdown completed.');
      process.exit(exitCode);
    });
  } else {
    try {
      await prisma.$disconnect();
    } catch (dbErr) {
      console.error('[Database Disconnect Error]:', dbErr);
    }
    process.exit(exitCode);
  }
}

// 4. Signal Listeners for Termination (B10)
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM', 0));
process.on('SIGINT', () => void gracefulShutdown('SIGINT', 0));

// 5. Global Process Error Handlers (B1 / B2)
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[Process Error] Unhandled Rejection at Promise:', reason);
  void gracefulShutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error: Error) => {
  console.error('[Process Error] Uncaught Exception thrown:', error);
  void gracefulShutdown('uncaughtException', 1);
});

// Execute Bootstrap
void bootstrap();
