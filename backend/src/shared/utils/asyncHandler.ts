import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Обёртка для async-хендлеров Express. Обеспечивает передачу ошибок в next()
 * и устраняет no-misused-promises (void return для Express).
 */
export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Обёртка для async-колбэков (Telegram bot, setInterval и т.д.),
 * где ожидается синхронная функция — не возвращаем Promise.
 */
export function runAsync<T extends unknown[]>(
  fn: (...args: T) => Promise<void>
): (...args: T) => void {
  return (...args: T) => {
    void fn(...args);
  };
}
