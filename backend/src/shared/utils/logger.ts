import winston from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'музыканты-backend' },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
    // В консоль всегда — чтобы docker logs показывал логи (важно для отладки бота и отзывов)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        process.env.NODE_ENV === 'production'
          ? winston.format.simple()
          : winston.format.combine(winston.format.colorize(), winston.format.simple()),
      ),
    }),
  ],
});
