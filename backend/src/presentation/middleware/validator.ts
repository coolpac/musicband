import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../../shared/errors';

/**
 * Middleware для валидации данных запроса с помощью Zod схем
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = new ValidationError(
          'Validation failed',
          error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          }))
        );
        res.status(400).json({
          success: false,
          error: {
            message: validationError.message,
            code: validationError.code,
            errors: validationError.errors,
          },
        });
        return;
      }
      next(error);
    }
  };
}
