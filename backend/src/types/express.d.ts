/**
 * Расширение Express Request — единый источник типов для user, token, rateLimit, pagination.
 * Подхватывается tsconfig (include: src).
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        telegramId: string;
        role: string;
      };
      /** JWT строка — заполняется authenticate, используется в logout для отзыва */
      token?: string;
      /** Заполняется Redis rate limiter middleware */
      rateLimit?: {
        limit: number;
        remaining: number;
        reset: Date;
      };
      /** Заполняется validatePagination middleware */
      pagination?: {
        page: number;
        limit: number;
        offset: number;
      };
    }
  }
}

export {};
