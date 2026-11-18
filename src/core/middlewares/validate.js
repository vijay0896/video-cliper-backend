import { AppError } from '../utils/appError.js';

/**
 * Zod request validation middleware
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} [target='body']
 */
export const validate = (schema, target = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[target]);
  if (!result.success) {
    const issues = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', issues));
  }
  req[target] = result.data;
  next();
};

