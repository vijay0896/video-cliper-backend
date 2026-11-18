import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID tracking middleware
 * Attaches a unique request ID to req.id and X-Request-Id header.
 */
export const requestIdMiddleware = (req, res, next) => {
  const reqId = req.headers['x-request-id'] || uuidv4();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
};

