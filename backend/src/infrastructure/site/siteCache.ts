import { logger } from '../../shared/utils/logger';
import { CacheService, CACHE_KEYS } from '../../shared/utils/cache';
import { getSiteSsrUrl, getSitePurgeToken } from '../../config/site';

/** Сколько ждём SSR-сервер, прежде чем считать purge неудавшимся. */
const PURGE_TIMEOUT_MS = 2000;

/**
 * Сообщает SSR-серверу публичного сайта, что его SWR-копия данных протухла.
 *
 * Строго best-effort: сайт и без purge подтянет свежие данные в пределах своего SWR-окна,
 * поэтому ни ошибка сети, ни 500 от сайта, ни отсутствие конфигурации не должны
 * ронять админский запрос. Функция НИКОГДА не бросает.
 */
export async function purgeSiteSsr(): Promise<void> {
  const baseUrl = getSiteSsrUrl();
  if (!baseUrl) {
    // SITE_SSR_URL не настроен — значит, сайт не развёрнут рядом. Это не ошибка.
    return;
  }

  const token = getSitePurgeToken();
  const url = `${baseUrl}/__purge`;

  // Свой AbortController вместо AbortSignal.timeout(): таймер снимается в finally и не
  // держит event loop открытым до двух секунд — это заметно при graceful shutdown.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PURGE_TIMEOUT_MS);
  timer.unref();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn('Site SSR purge returned a non-OK status', { status: response.status, url });
      return;
    }

    logger.debug('Site SSR purge sent', { url });
  } catch (error) {
    logger.warn('Site SSR purge failed', { error, url });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Инвалидация публичного ответа сайта после любой админской правки
 * (контент секции, афиша, форматы, партнёры).
 *
 * Redis-ключ удаляем с ожиданием (это миллисекунды и без этого админ увидит старые данные),
 * а HTTP-purge отправляем «в фон»: админ не должен ждать чужой сервис.
 * CacheService.del сам глотает ошибки Redis, так что функция не бросает.
 */
export async function invalidatePublicSiteCache(): Promise<void> {
  await CacheService.invalidate(CACHE_KEYS.SITE_PUBLIC);
  void purgeSiteSsr();
}
