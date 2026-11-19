/**
 * @file server.js
 * @description Application Entrypoint & Process Lifecycle Manager
 * Bootstraps runtime directories, binds HTTP listener, and manages graceful shutdowns.
 */
import fs from 'fs';
import path from 'path';
import app from './app.js';
import { env } from './src/config/env.js';
import { logger } from './src/config/logger.js';

// Ensure critical runtime directories exist before accepting traffic
[
  env.OUTPUT_DIR,
  env.UPLOAD_DIR,
  path.join(env.OUTPUT_DIR, 'thumbnails'),
].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const PORT = env.PORT || 8000;

const server = app.listen(PORT, () => {
  logger.info(`========================================================`);
  logger.info(`🚀 OpenShorts Node.js ESM Backend running on port ${PORT}`);
  logger.info(`📡 Environment: ${env.NODE_ENV}`);
  logger.info(`🎥 Output directory: ${env.OUTPUT_DIR}`);
  logger.info(`📁 Upload directory: ${env.UPLOAD_DIR}`);
  logger.info(`========================================================`);
});

/**
 * Graceful Shutdown Handler
 */
const gracefulShutdown = (signal) => {
  logger.warn(`\n🛑 [${signal}] received. Starting graceful shutdown...`);

  const forceExitTimeout = setTimeout(() => {
    logger.error('⚠️ Forcefully terminating server after timeout.');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  server.close(() => {
    logger.info('✅ HTTP server closed. In-flight requests drained.');
    logger.info('Process exiting cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', { message: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', { reason });
});
