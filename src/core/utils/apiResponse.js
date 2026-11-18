/**
 * Standardized API Response Structure
 * Guarantees uniform response contracts across all controllers.
 */
export class ApiResponse {
  /**
   * Send a successful HTTP response.
   * @param {import('express').Response} res - Express response object
   * @param {string} message - Success message
   * @param {any} [data=null] - Payload returned to caller
   * @param {number} [statusCode=200] - HTTP status code
   */
  static success(res, message = 'Success', data = null, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data,
    });
  }

  /**
   * Send a created resource response (HTTP 201).
   */
  static created(res, message = 'Resource created successfully', data = null) {
    return this.success(res, message, data, 201);
  }

  /**
   * Send an error response (Used by error middleware).
   */
  static error(res, message = 'Internal Server Error', statusCode = 500, code = 'SERVER_ERROR', errors = []) {
    return res.status(statusCode).json({
      success: false,
      statusCode,
      message,
      code,
      errors,
    });
  }
}

