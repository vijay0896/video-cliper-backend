import { z } from 'zod';

/**
 * Universal Request Validation Middleware powered by Zod.
 * Validates request body, query params, or route params against a Zod schema.
 * Replaces request data with parsed, validated, and type-coerced values.
 *
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {'body'|'query'|'params'} [target='body'] - Default target if schema doesn't specify shape
 * @returns {import('express').RequestHandler}
 */
export const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    try {
      // If schema explicitly defines body/query/params shapes
      const hasDefinedShapes =
        schema instanceof z.ZodObject &&
        (schema.shape?.body || schema.shape?.query || schema.shape?.params);

      if (hasDefinedShapes) {
        const dataToValidate = {};
        if (schema.shape.body) dataToValidate.body = req.body;
        if (schema.shape.query) dataToValidate.query = req.query;
        if (schema.shape.params) dataToValidate.params = req.params;

        const parsed = schema.parse(dataToValidate);

        if (parsed.body) req.body = parsed.body;
        if (parsed.query) req.query = parsed.query;
        if (parsed.params) req.params = parsed.params;
      } else {
        // Direct target validation (e.g. req.body)
        const parsed = schema.parse(req[target] || {});
        req[target] = parsed;
      }

      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        const primaryMessage = details.length > 0
          ? `Validation error: ${details[0].message} (${details[0].field})`
          : 'Invalid request payload';

        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: primaryMessage,
          error: {
            code: 'VALIDATION_ERROR',
            details,
          },
          timestamp: new Date().toISOString(),
        });
      }

      next(err);
    }
  };
};

