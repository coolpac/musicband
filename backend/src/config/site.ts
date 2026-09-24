/**
 * Конфигурация интеграции с SSR-сервером публичного сайта.
 * Обе переменные опциональны: без них бэкенд работает как раньше,
 * просто не дёргает purge-хук (Mini App о сайте ничего не знает).
 *
 *   SITE_SSR_URL     http://site:4000 — origin процесса frontend/server/site-server.mjs
 *   SITE_PURGE_TOKEN общий секрет для POST ${SITE_SSR_URL}/__purge
 *
 * Значения читаются на каждый вызов (а не на импорте модуля), чтобы тесты
 * могли подменять process.env без пересборки модульного графа.
 */

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Origin SSR-сервера сайта без хвостового слэша, либо undefined если не настроен. */
export function getSiteSsrUrl(): string | undefined {
  const raw = readEnv('SITE_SSR_URL');
  return raw ? raw.replace(/\/+$/, '') : undefined;
}

/** Bearer-токен для /__purge, либо undefined (тогда заголовок не отправляется). */
export function getSitePurgeToken(): string | undefined {
  return readEnv('SITE_PURGE_TOKEN');
}
