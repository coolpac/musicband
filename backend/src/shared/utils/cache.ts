import { redis } from '../../config/redis';
import { logger } from './logger';
import { CACHE_TTL } from '../constants';

/**
 * Утилиты для кеширования в Redis
 */
export class CacheService {
  /**
   * Получить значение из кеша
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Установить значение в кеш с TTL
   */
  static async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialized);
      } else {
        await redis.set(key, serialized);
      }
    } catch (error) {
      logger.error('Cache set error', { key, error });
    }
  }

  /**
   * Удалить значение из кеша
   */
  static async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error('Cache del error', { key, error });
    }
  }

  /**
   * Удалить все ключи по паттерну (используя SCAN вместо KEYS)
   * SCAN не блокирует Redis и безопасен для production
   */
  static async delPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      const keysToDelete: string[] = [];

      do {
        // SCAN возвращает [новый cursor, массив ключей]
        const reply = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = reply[0];
        const keys = reply[1];

        if (keys.length > 0) {
          keysToDelete.push(...keys);
        }
      } while (cursor !== '0');

      // Удаляем все найденные ключи одним батчем
      if (keysToDelete.length > 0) {
        const pipeline = redis.pipeline();
        keysToDelete.forEach((key) => pipeline.del(key));
        await pipeline.exec();

        logger.debug('Cache pattern deleted', {
          pattern,
          keysDeleted: keysToDelete.length
        });
      }
    } catch (error) {
      logger.error('Cache delPattern error', { pattern, error });
    }
  }

  /**
   * Инвалидировать кеш (удалить)
   */
  static async invalidate(key: string): Promise<void> {
    await this.del(key);
  }

  /**
   * Получить или установить значение (cache-aside pattern)
   */
  static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}

/**
 * Ключи кеша
 */
export const CACHE_KEYS = {
  ACTIVE_SONGS: 'songs:active',
  VOTE_SESSION_ACTIVE: (sessionId: string) => `votes:session:${sessionId}:active`,
  VOTE_RESULTS: (sessionId: string) => `votes:session:${sessionId}:results`,
  BLOCKED_DATES: (month?: string) => (month ? `bookings:blocked-dates:${month}` : 'bookings:blocked-dates'),
  /** Кеш результата getAvailableDates (dates + blockedDates) по месяцу */
  AVAILABLE_DATES: (month: string) => `bookings:available:${month}`,
  AGENT_STATS: (agentId: string) => `agent:stats:${agentId}`,
} as const;
