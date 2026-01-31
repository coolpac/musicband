/**
 * Middleware для валидации и санитизации входных данных
 */

import { Request, Response, NextFunction } from 'express';
import xss from 'xss';
import { ValidationError } from '../../shared/errors';

/**
 * Валидация и клампинг параметров пагинации
 * Защищает от DoS атак через ?limit=9999999
 */
export function validatePagination(options: {
  maxLimit?: number;
  defaultLimit?: number;
} = {}) {
  const maxLimit = options.maxLimit || 100;
  const defaultLimit = options.defaultLimit || 50;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Валидация page
    const pageParam = req.query.page as string | undefined;
    let page = 1;

    if (pageParam !== undefined) {
      const parsed = parseInt(pageParam, 10);

      if (isNaN(parsed)) {
        throw new ValidationError('Page must be a valid number');
      }

      if (parsed < 1) {
        throw new ValidationError('Page must be greater than 0');
      }

      if (parsed > Number.MAX_SAFE_INTEGER) {
        throw new ValidationError('Page number is too large');
      }

      page = parsed;
    }

    // Валидация limit
    const limitParam = req.query.limit as string | undefined;
    let limit = defaultLimit;

    if (limitParam !== undefined) {
      const parsed = parseInt(limitParam, 10);

      if (isNaN(parsed)) {
        throw new ValidationError('Limit must be a valid number');
      }

      if (parsed < 1) {
        throw new ValidationError('Limit must be greater than 0');
      }

      // Клампинг к максимальному значению (защита от DoS)
      limit = Math.min(parsed, maxLimit);

      // Предупреждение в логах, если клиент запросил больше максимума
      if (parsed > maxLimit) {
        req.log?.warn?.('Client requested limit exceeding maximum', {
          requested: parsed,
          clamped: limit,
          maxLimit,
        });
      }
    }

    // Сохраняем валидированные значения в req для контроллера
    (req as any).pagination = {
      page,
      limit,
      offset: (page - 1) * limit,
    };

    next();
  };
}

/**
 * Валидация даты в формате YYYY-MM-DD
 */
export function validateDateParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const dateStr = (req.query[paramName] || req.body[paramName]) as string | undefined;

    if (!dateStr) {
      return next(); // Опциональный параметр
    }

    // Проверка формата YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      throw new ValidationError(`${paramName} must be in format YYYY-MM-DD`);
    }

    // Проверка валидности даты
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new ValidationError(`${paramName} is not a valid date`);
    }

    // Проверка разумных границ (не раньше 2000 года, не позже 2100)
    const year = date.getFullYear();
    if (year < 2000 || year > 2100) {
      throw new ValidationError(`${paramName} year must be between 2000 and 2100`);
    }

    next();
  };
}

/**
 * Валидация месяца в формате YYYY-MM
 */
export function validateMonthParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const monthStr = (req.query[paramName] || req.body[paramName]) as string | undefined;

    if (!monthStr) {
      return next(); // Опциональный параметр
    }

    // Проверка формата YYYY-MM
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(monthStr)) {
      throw new ValidationError(`${paramName} must be in format YYYY-MM`);
    }

    // Проверка валидности
    const [yearStr, monthPart] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthPart, 10);

    if (month < 1 || month > 12) {
      throw new ValidationError(`${paramName} month must be between 01 and 12`);
    }

    if (year < 2000 || year > 2100) {
      throw new ValidationError(`${paramName} year must be between 2000 and 2100`);
    }

    next();
  };
}

/**
 * Санитизация текстовых полей
 * Защита от XSS через библиотеку xss (whiteList: {}, stripIgnoreTag: true)
 */
export function sanitizeText(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fields.forEach((field) => {
      const value = req.body[field];

      if (typeof value === 'string') {
        req.body[field] = xss(value, {
          whiteList: {},
          stripIgnoreTag: true,
        }).trim();
      }
    });

    next();
  };
}

/**
 * Валидация максимальной длины текста
 */
export function validateTextLength(field: string, maxLength: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.body[field];

    if (typeof value === 'string' && value.length > maxLength) {
      throw new ValidationError(
        `${field} cannot exceed ${maxLength} characters (got ${value.length})`
      );
    }

    next();
  };
}
