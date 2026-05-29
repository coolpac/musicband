import { logger } from './logger';
import {
  validateWebAppInitData,
  type ValidateInitDataOptions,
} from './webapp';

export type { ValidateInitDataOptions };

export interface MaxUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface MaxInitData {
  user?: MaxUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  start_param?: string; // Из deep link (например, vote_{sessionId})
}

/**
 * Проверяет валидность initData от Max Mini App.
 *
 * Согласно официальной документации Max (https://dev.max.ru/docs/webapps/validation)
 * алгоритм проверки подписи байт-в-байт совпадает с Telegram, поэтому проверка HMAC
 * и свежести делегируется общему ядру `validateWebAppInitData`.
 *
 * @param rawInitData - сырая строка initData от Max
 * @param botToken - токен бота Max (User Bot или Admin Bot)
 * @param maxAge - максимальный возраст данных в секундах (по умолчанию 1 час)
 * @returns объект с данными пользователя или null если невалидно
 */
export function validateMaxInitData(
  rawInitData: string,
  botToken: string,
  maxAge: number = 3600,
  options?: ValidateInitDataOptions
): MaxInitData | null {
  const validated = validateWebAppInitData(rawInitData, botToken, maxAge, options);
  if (!validated) {
    return null;
  }

  const { params, authDate, hash } = validated;

  // Парсим user если есть (URL-encoded JSON, как у Telegram)
  let user: MaxUser | undefined;
  const userStr = params.get('user');
  if (userStr) {
    try {
      user = JSON.parse(decodeURIComponent(userStr)) as MaxUser;
    } catch (error) {
      if (options?.logFailures !== false) {
        logger.warn('Max initData validation failed: invalid user data', {
          ...(options?.logMeta || {}),
          error,
        });
      }
      return null;
    }
  }

  const initData: MaxInitData = {
    user,
    auth_date: authDate,
    hash,
    query_id: params.get('query_id') || undefined,
    start_param: params.get('start_param') || undefined,
  };

  return initData;
}
