import { MaxError } from '@maxhub/max-bot-api';

/**
 * Типизированный результат классификации ошибки Max API.
 *
 * Зеркалит дух обработки ошибок в Telegram-адаптере: при пакетных рассылках 403
 * («пользователь заблокировал бота») молча пропускается, а временные ошибки
 * (rate-limit / 5xx) можно повторить.
 */
export interface MaxErrorInfo {
  /** Пользователь недоступен (заблокировал бота, 403) — сообщение глотаем. */
  isUserUnreachable: boolean;
  /** Временная ошибка (rate-limit / 5xx) — отправку имеет смысл повторить. */
  shouldRetry: boolean;
  /** HTTP-статус из MaxError, если это ошибка Max API. */
  status?: number;
  /** Код ошибки Max API (например, "forbidden", "too.many.requests"). */
  code?: string;
  /** Человекочитаемое описание/сообщение ошибки. */
  message?: string;
}

/**
 * Является ли значение ошибкой Max API (MaxError со status/code/description).
 */
export function isMaxError(error: unknown): error is MaxError {
  return error instanceof MaxError;
}

/**
 * Классифицирует ошибку Max API в типизированный результат.
 *
 * - 403 (forbidden) → пользователь недоступен: бот заблокирован. Глотаем при
 *   отправке (как 403 в Telegram-адаптере). 404 НЕ считаем недоступностью —
 *   на эндпоинтах отправки 404 чаще означает ошибку запроса (неизвестный метод/
 *   ресурс), её лучше не маскировать.
 * - 429 (too many requests) / 5xx → временная ошибка, отправку можно повторить.
 */
export function classifyMaxError(error: unknown): MaxErrorInfo {
  if (isMaxError(error)) {
    const status = error.status;
    const isUserUnreachable = status === 403;
    const shouldRetry = !isUserUnreachable && (status === 429 || status >= 500);
    return {
      isUserUnreachable,
      shouldRetry,
      status,
      code: error.code,
      message: error.description,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    isUserUnreachable: false,
    shouldRetry: false,
    message,
  };
}

/**
 * Краткий помощник для мест отправки: пользователь недоступен (заблокировал бота
 * или чат не найден) — такую ошибку при отправке безопасно проглотить и залогировать warn.
 */
export function isUserUnreachable(error: unknown): boolean {
  return classifyMaxError(error).isUserUnreachable;
}
