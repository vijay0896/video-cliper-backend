/**
 * @file src/core/middlewares/notFound.js
 * @description Standardized 404 Not Found Middleware
 * Intercepts unmatched HTTP requests and returns a unified JSON error contract.
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
    code: 'ROUTE_NOT_FOUND',
  });
};

