/** Структура ошибки Telegram Bot API (node-telegram-bot-api) */
interface TelegramApiError {
  response?: {
    body?: { error_code?: number; description?: string };
    error_code?: number;
    statusCode?: number;
  };
  statusCode?: number;
  message?: string;
}

function isTelegramError(value: unknown): value is TelegramApiError {
  return typeof value === 'object' && value !== null;
}

export function getTelegramErrorCode(error: unknown): number | undefined {
  if (!isTelegramError(error)) return undefined;
  const code = error.response?.body?.error_code ?? error.response?.error_code;
  if (typeof code === 'number') return code;
  if (typeof code === 'string') {
    const parsed = Number(code);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  const statusCode = error.response?.statusCode ?? error.statusCode;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

export function getTelegramErrorDescription(error: unknown): string | undefined {
  if (!isTelegramError(error)) return undefined;
  const desc = error.response?.body?.description;
  if (typeof desc === 'string') return desc;
  if (typeof error.message === 'string') return error.message;
  return undefined;
}
