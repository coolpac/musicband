import Redis from 'ioredis';
import { logger } from '../shared/utils/logger';

let intentionalDisconnect = false;

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  intentionalDisconnect = false;
  logger.info('Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error('Redis connection error', { error });
});

redis.on('close', () => {
  if (intentionalDisconnect) {
    logger.info('Redis connection closed');
  } else {
    logger.warn('Redis connection closed');
  }
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.ping();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Redis connection failed', { error });
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  intentionalDisconnect = true;
  redis.disconnect();
  logger.info('Redis disconnected');
}
