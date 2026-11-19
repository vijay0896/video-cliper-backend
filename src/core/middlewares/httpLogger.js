/**
 * @file src/core/middlewares/httpLogger.js
 * @description HTTP Request Access Logger Middleware
 * Integrates Morgan with Winston structured logging and correlates Request IDs.
 */
import morgan from 'morgan';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

// Setup Morgan token to extract truncated Request ID for concise tracking
morgan.token('id', (req) => (req.id ? req.id.split('-')[0] : 'core'));

export const httpLogger = env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : morgan('[:id] :method :url :status :response-time ms - :res[content-length]', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    });

