import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';

const REDACT_KEYS = ['password', 'token', 'secret', 'authorization', 'cookie'];
const BODY_LOG_MAX_BYTES = 1024; // 1KB

/**
 * Санитизирует req.body для логирования:
 * - Заменяет чувствительные поля на [REDACTED]
 * - Не логирует multipart (файлы)
 * - Обрезает тело до 1KB
 */
function sanitizeBodyForLog(req: Request): unknown {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) {
    return '[multipart - omitted]';
  }

  const body = req.body as unknown;
  if (body === undefined || body === null) return body;
  if (typeof body !== 'object') return body;

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (REDACT_KEYS.some((k) => lower.includes(k) || lower === k)) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }

  const str = JSON.stringify(redacted);
  const bytes = Buffer.byteLength(str, 'utf8');
  if (bytes <= BODY_LOG_MAX_BYTES) return redacted;
  return {
    _truncated: true,
    _bytes: BODY_LOG_MAX_BYTES,
    _preview: str.slice(0, BODY_LOG_MAX_BYTES),
  };
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.warn('Application error', {
      error: err.message,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
      },
    });
    return;
  }

  // Неожиданные ошибки — тело запроса санитизировано
  logger.error('Unexpected error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: sanitizeBodyForLog(req),
  });

  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
};
