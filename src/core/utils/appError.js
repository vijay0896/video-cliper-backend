/**
 * AppError - Operational and Domain Exception Handler
 * Consistent with enterprise error handling guidelines in coderules.md.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {number} statusCode - HTTP Status code (e.g., 400, 404, 500)
   * @param {string} [code='APP_ERROR'] - Machine-readable error code
   * @param {Array<any>} [errors=[]] - Optional detailed validation or sub-errors
   */
  constructor(message, statusCode = 500, code = 'APP_ERROR', errors = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

