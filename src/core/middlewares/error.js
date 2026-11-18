import { ApiResponse } from '../utils/apiResponse.js';
import { logger } from '../../config/logger.js';

/**
 * Global Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred';
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const errors = err.errors || [];

  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} - Error: ${err.message}`, {
      stack: err.stack,
      requestId: req.id,
    });
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} - ${statusCode}: ${message}`);
  }

  return ApiResponse.error(res, message, statusCode, code, errors);
};

