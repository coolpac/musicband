import crypto from 'crypto';
import { logger } from './logger';

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

export interface ValidatedWebAppInitData {
  /** Параметры initData с уже удалённым hash. */
  params: URLSearchParams;
  authDate: number;
  hash: string;
}

/**
 * Проверяет подпись и свежесть initData от Mini App.
 *
 * Алгоритм идентичен и для Telegram, и для Max (max.ru):
 * 1. Разбираем строку в key=value пары, сохраняем и удаляем hash.
 * 2. Сортируем пары по ключу, склеиваем как `key=value` через \n → data_check_string.
 * 3. secret_key = HMAC_SHA256(key="WebAppData", msg=botToken).
 * 4. computed = hex(HMAC_SHA256(key=secret_key, msg=data_check_string)).
 * 5. Валидно, если computed === hash. Дополнительно проверяем свежесть auth_date.
 *
 * Возвращает разобранные params (без hash), auth_date и hash либо null.
 * Парсинг платформенных полей (user и т.п.) — ответственность вызывающего.
 */
export function validateWebAppInitData(
  rawInitData: string,
  botToken: string,
  maxAge: number = 3600,
  options?: ValidateInitDataOptions
): ValidatedWebAppInitData | null {
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
    const sortedParams = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));

    // Формируем data_check_string
    const dataCheckString = sortedParams.map(([key, value]) => `${key}=${value}`).join('\n');

    // Вычисляем секретный ключ
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

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

    return { params, authDate, hash };
  } catch (error) {
    logger.error('InitData validation error', { error, ...(options?.logMeta || {}) });
    return null;
  }
}
