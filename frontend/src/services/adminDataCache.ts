/**
 * In-memory кеш для данных админ-экранов (stats, bookings, calendar, reviews).
 * При возврате на вкладку данные берутся из кеша — без повторного fetch и спиннера.
 */

const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 минуты

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

function get<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Возвращает данные из кеша или выполняет fetcher, кеширует результат и возвращает его.
 */
export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const cached = get<T>(key);
  if (cached !== null) return cached;
  const value = await fetcher();
  set(key, value, ttlMs);
  return value;
}

/**
 * Синхронное чтение из кеша (для начального рендера без спиннера).
 */
export function getCached<T>(key: string): T | null {
  return get<T>(key);
}

/**
 * Инвалидация по ключу (после мутаций при необходимости).
 */
export function invalidate(key: string): void {
  store.delete(key);
}

/** Ключи кеша */
export const CACHE_KEYS = {
  ADMIN_STATS: 'admin:stats',
  ADMIN_BOOKINGS_LIST: 'admin:bookings:list',
  ADMIN_CALENDAR: (month: string) => `admin:calendar:${month}`,
  ADMIN_BLOCKED_DATES: (month: string) => `admin:blocked:${month}`,
  ADMIN_REVIEWS: (page: number, limit: number) => `admin:reviews:${page}:${limit}`,
} as const;
