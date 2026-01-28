import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/utils/logger';

export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pooling настраивается через DATABASE_URL
  // Пример: postgresql://user:password@host:5432/db?connection_limit=10&pool_timeout=20
});

prisma.$on('error' as never, (e: unknown) => {
  logger.error('Prisma error', { error: e });
});

prisma.$on('warn' as never, (e: unknown) => {
  logger.warn('Prisma warning', { warning: e });
});

if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: unknown) => {
    logger.debug('Prisma query', { query: e });
  });
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed', { error });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
