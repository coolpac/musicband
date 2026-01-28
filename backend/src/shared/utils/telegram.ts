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
  maxAge: number = 3600
): InitData | null {
  try {
    // Парсим initData
    const params = new URLSearchParams(rawInitData);
    const hash = params.get('hash');
    
    if (!hash) {
      logger.warn('InitData validation failed: missing hash');
      return null;
    }

    // Проверяем auth_date
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      logger.warn('InitData validation failed: missing auth_date');
      return null;
    }

    const authDate = parseInt(authDateStr, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const age = currentTime - authDate;

    if (age > maxAge) {
      logger.warn('InitData validation failed: expired', { age, maxAge });
      return null;
    }

    if (age < 0) {
      logger.warn('InitData validation failed: auth_date in future');
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
      logger.warn('InitData validation failed: invalid hash');
      return null;
    }

    // Парсим user если есть
    let user: TelegramUser | undefined;
    const userStr = params.get('user');
    if (userStr) {
      try {
        user = JSON.parse(decodeURIComponent(userStr)) as TelegramUser;
      } catch (error) {
        logger.warn('InitData validation failed: invalid user data', { error });
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
    logger.error('InitData validation error', { error });
    return null;
  }
}
