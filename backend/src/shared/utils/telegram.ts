import crypto from 'crypto';
import { logger } from './logger';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface InitData {
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  start_param?: string; // Из deep link (например, vote_{sessionId})
}

export interface ValidateInitDataOptions {
  /**
   * По умолчанию функция пишет warn-логи для причин невалидности.
   * Можно отключить (например, когда пробуем несколько botToken подряд),
   * чтобы не засорять логи ложными предупреждениями.
   */
  logFailures?: boolean;
  /**
   * Дополнительные поля, которые будут добавлены в логи (если logFailures=true).
   */
  logMeta?: Record<string, unknown>;
}

/**
 * Проверяет валидность initData от Telegram Mini App
 * @param rawInitData - сырая строка initData от Telegram
 * @param botToken - токен бота (Admin Bot для админов)
 * @param maxAge - максимальный возраст данных в секундах (по умолчанию 1 час)
 * @returns объект с данными пользователя или null если невалидно
 */
export function validateInitData(
  rawInitData: string,
  botToken: string,
  maxAge: number = 3600,
  options?: ValidateInitDataOptions
): InitData | null {
  try {
    const logFailures = options?.logFailures !== false;
    const baseMeta = options?.logMeta || {};
    const warn = (message: string, meta?: Record<string, unknown>) => {
      if (!logFailures) return;
      logger.warn(message, { ...baseMeta, ...(meta || {}) });
    };

    // Парсим initData
    const params = new URLSearchParams(rawInitData);
    const hash = params.get('hash');
    
    if (!hash) {
      warn('InitData validation failed: missing hash');
      return null;
    }

    // Проверяем auth_date
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      warn('InitData validation failed: missing auth_date');
      return null;
    }

    const authDate = parseInt(authDateStr, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const age = currentTime - authDate;

    if (age > maxAge) {
      warn('InitData validation failed: expired', { age, maxAge });
      return null;
    }

    if (age < 0) {
      warn('InitData validation failed: auth_date in future');
      return null;
    }

    // Удаляем hash из параметров для проверки подписи
    params.delete('hash');

    // Сортируем параметры по ключу
    const sortedParams = Array.from(params.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    // Формируем data_check_string
    const dataCheckString = sortedParams
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Вычисляем секретный ключ
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Вычисляем HMAC-SHA256
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Сравниваем хеши
    if (calculatedHash !== hash) {
      warn('InitData validation failed: invalid hash');
      return null;
    }

    // Парсим user если есть
    let user: TelegramUser | undefined;
    const userStr = params.get('user');
    if (userStr) {
      try {
        user = JSON.parse(decodeURIComponent(userStr)) as TelegramUser;
      } catch (error) {
        warn('InitData validation failed: invalid user data', { error });
        return null;
      }
    }

    const initData: InitData = {
      user,
      auth_date: authDate,
      hash,
      query_id: params.get('query_id') || undefined,
      start_param: params.get('start_param') || undefined,
    };

    return initData;
  } catch (error) {
    logger.error('InitData validation error', { error, ...(options?.logMeta || {}) });
    return null;
  }
}
