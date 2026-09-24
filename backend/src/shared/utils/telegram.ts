import { logger } from './logger';
import {
  validateWebAppInitData,
  type ValidateInitDataOptions,
} from './webapp';

export type { ValidateInitDataOptions };

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
  const validated = validateWebAppInitData(rawInitData, botToken, maxAge, options);
  if (!validated) {
    return null;
  }

  const { params, authDate, hash } = validated;

  // Парсим user если есть
  let user: TelegramUser | undefined;
  const userStr = params.get('user');
  if (userStr) {
    try {
      user = JSON.parse(decodeURIComponent(userStr)) as TelegramUser;
    } catch (error) {
      if (options?.logFailures !== false) {
        logger.warn('InitData validation failed: invalid user data', {
          ...(options?.logMeta || {}),
          error,
        });
      }
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
}
