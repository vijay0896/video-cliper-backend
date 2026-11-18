/**
 * Async Handler Wrapper
 * Eliminates repetitive try/catch boilerplate across express controllers.
 * @param {Function} fn - Asynchronous route handler
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

