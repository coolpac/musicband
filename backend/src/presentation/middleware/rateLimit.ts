import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { redis } from '../../config/redis';
import { logger } from '../../shared/utils/logger';
import { RateLimitError } from '../../shared/errors';
import { RATE_LIMIT } from '../../shared/constants';

declare global {
  namespace Express {
    interface Request {
      rateLimit?: { limit: number; remaining: number; reset: Date };
    }
  }
}

/**
 * Redis-based rate limiter для масштабирования
 */
export interface RateLimitOptions {
  windowMs: number; // Окно времени в миллисекундах
  max: number; // Максимальное количество запросов
  keyGenerator?: (req: Request) => string; // Функция для генерации ключа
  message?: string; // Сообщение об ошибке
}

/**
 * Redis-based rate limiter middleware
 * Использует Redis для хранения счетчиков (для масштабирования)
 */
export function createRedisRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyGenerator = (req: Request) => {
      // По умолчанию используем IP адрес
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
    message = 'Too many requests, please try again later.',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = `rate_limit:${keyGenerator(req)}`;
      const now = Date.now();

      // Получаем текущий счетчик из Redis
      const count = await redis.get(key);
      const currentCount = count ? parseInt(count, 10) : 0;

      if (currentCount >= max) {
        // Получаем время до сброса лимита
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : Math.ceil(windowMs / 1000);

        res.setHeader('Retry-After', retryAfter.toString());
        res.setHeader('X-RateLimit-Limit', max.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

        logger.warn('Rate limit exceeded', {
          key,
          ip: req.ip,
          path: req.path,
          method: req.method,
          count: currentCount,
          max,
        });

        return next(new RateLimitError(message));
      }

      // Увеличиваем счетчик
      const newCount = currentCount + 1;
      await redis.setex(key, Math.ceil(windowMs / 1000), newCount.toString());

      // Устанавливаем заголовки
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - newCount).toString());
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

      // Сохраняем информацию о лимите в request для логирования
      (req as any).rateLimit = {
        limit: max,
        remaining: Math.max(0, max - newCount),
        reset: new Date(now + windowMs),
      };

      next();
    } catch (error) {
      // В случае ошибки Redis, БЛОКИРУЕМ запрос (fail-secure)
      // Это защищает от DDoS атак, если Redis недоступен
      logger.error('Rate limiter error - denying request for security', {
        error,
        path: req.path,
        key: req.path,
      });

      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service temporarily unavailable. Please try again later.',
        },
      });
    }
  };
}

/**
 * Rate limiter с учетом роли пользователя
 */
export function createRoleBasedRateLimiter(
  userLimits: { [role: string]: { windowMs: number; max: number } },
  defaultLimit: { windowMs: number; max: number }
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const role = user?.role || 'anonymous';

      const limit = userLimits[role] || defaultLimit;

      const key = `rate_limit:${role}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
      const now = Date.now();

      const count = await redis.get(key);
      const currentCount = count ? parseInt(count, 10) : 0;

      if (currentCount >= limit.max) {
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : Math.ceil(limit.windowMs / 1000);

        res.setHeader('Retry-After', retryAfter.toString());
        res.setHeader('X-RateLimit-Limit', limit.max.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', new Date(now + limit.windowMs).toISOString());

        logger.warn('Rate limit exceeded (role-based)', {
          role,
          key,
          ip: req.ip,
          path: req.path,
          count: currentCount,
          max: limit.max,
        });

        return next(new RateLimitError('Too many requests, please try again later.'));
      }

      const newCount = currentCount + 1;
      await redis.setex(key, Math.ceil(limit.windowMs / 1000), newCount.toString());

      res.setHeader('X-RateLimit-Limit', limit.max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.max - newCount).toString());
      res.setHeader('X-RateLimit-Reset', new Date(now + limit.windowMs).toISOString());

      next();
    } catch (error) {
      // Fail-secure: блокируем запрос при ошибке Redis
      logger.error('Role-based rate limiter error - denying request for security', {
        error,
        path: req.path,
        role: (req as any).user?.role || 'anonymous'
      });

      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service temporarily unavailable. Please try again later.',
        },
      });
    }
  };
}

/**
 * Готовые rate limiters для разных типов endpoints
 */

// Auth endpoints - строгий лимит (защита от брутфорса)
export const authRateLimiter = createRedisRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // 5 попыток входа за 15 минут
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user?.userId || req.ip || 'unknown';
  },
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

// Vote endpoints - очень строгий лимит (1 голос на пользователя)
export const voteRateLimiter = createRedisRateLimiter({
  windowMs: 60 * 1000, // 1 минута
  max: 1, // 1 голос в минуту
  keyGenerator: (req) => {
    const user = (req as any).user;
    if (!user?.userId) {
      return `vote:${req.ip}`;
    }
    return `vote:${user.userId}`;
  },
  message: 'You can only vote once per minute.',
});

// Booking endpoints - средний лимит
export const bookingRateLimiter = createRedisRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 10, // 10 бронирований в час
  keyGenerator: (req) => {
    const user = (req as any).user;
    if (!user?.userId) {
      return `booking:${req.ip}`;
    }
    return `booking:${user.userId}`;
  },
  message: 'Too many booking requests. Please try again later.',
});

// Upload endpoints - строгий лимит (защита от спама)
export const uploadRateLimiter = createRedisRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 20, // 20 загрузок в час
  keyGenerator: (req) => {
    const user = (req as any).user;
    if (!user?.userId) {
      return `upload:${req.ip}`;
    }
    return `upload:${user.userId}`;
  },
  message: 'Too many upload requests. Please try again later.',
});

// Review endpoints - средний лимит
export const reviewRateLimiter = createRedisRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 часа
  max: 5, // 5 отзывов в день
  keyGenerator: (req) => {
    const user = (req as any).user;
    if (!user?.userId) {
      return `review:${req.ip}`;
    }
    return `review:${user.userId}`;
  },
  message: 'You can only submit 5 reviews per day.',
});

// Admin endpoints - более мягкий лимит, но есть
export const adminRateLimiter = createRoleBasedRateLimiter(
  {
    admin: { windowMs: 60 * 1000, max: 100 }, // 100 запросов в минуту для админов
  },
  { windowMs: 60 * 1000, max: 30 } // 30 запросов в минуту по умолчанию
);

// Public API endpoints - стандартный лимит
export const publicApiRateLimiter = createRedisRateLimiter({
  windowMs: 60 * 1000, // 1 минута
  max: RATE_LIMIT.API, // 100 запросов в минуту
  keyGenerator: (req) => {
    return `api:${req.ip || 'unknown'}`;
  },
  message: 'Too many requests. Please slow down.',
});

// Referral endpoints - средний лимит
export const referralRateLimiter = createRedisRateLimiter({
  windowMs: 60 * 1000, // 1 минута
  max: RATE_LIMIT.REFERRAL_EVENT, // 10 событий в минуту
  keyGenerator: (req) => {
    return `referral:${req.ip || 'unknown'}`;
  },
  message: 'Too many referral requests. Please try again later.',
});

/**
 * Express-rate-limit конфигурации (fallback если Redis недоступен)
 */
export const expressRateLimiters = {
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  vote: rateLimit({
    windowMs: 60 * 1000, // 1 минута
    max: 1,
    message: 'You can only vote once per minute.',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  booking: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 час
    max: 10,
    message: 'Too many booking requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  upload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 час
    max: 20,
    message: 'Too many upload requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  review: rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 часа
    max: 5,
    message: 'You can only submit 5 reviews per day.',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  publicApi: rateLimit({
    windowMs: 60 * 1000, // 1 минута
    max: RATE_LIMIT.API,
    message: 'Too many requests. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  admin: rateLimit({
    windowMs: 60 * 1000, // 1 минута
    max: 100,
    message: 'Too many requests. Please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
  }),
};
