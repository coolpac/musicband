import express, { Express } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { errorHandler } from './presentation/middleware/errorHandler';
import { logger } from './shared/utils/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis, redis } from './config/redis';
import authRoutes from './presentation/routes/auth.routes';
import songsRoutes from './presentation/routes/songs.routes';
import bookingsRoutes from './presentation/routes/bookings.routes';
import votesRoutes from './presentation/routes/votes.routes';
import adminSongsRoutes from './presentation/routes/admin/songs.routes';
import adminVotesRoutes from './presentation/routes/admin/votes.routes';
import adminFormatsRoutes from './presentation/routes/admin/formats.routes';
import adminPartnersRoutes from './presentation/routes/admin/partners.routes';
import adminPostersRoutes from './presentation/routes/admin/posters.routes';
import adminReviewsRoutes from './presentation/routes/admin/reviews.routes';
import adminAgentsRoutes from './presentation/routes/admin/agents.routes';
import adminBookingsRoutes from './presentation/routes/admin/bookings.routes';
import formatsRoutes from './presentation/routes/formats.routes';
import partnersRoutes from './presentation/routes/partners.routes';
import postersRoutes from './presentation/routes/posters.routes';
import reviewsRoutes from './presentation/routes/reviews.routes';
import agentRoutes from './presentation/routes/agent.routes';
import uploadRoutes from './presentation/routes/upload.routes';
import publicVoteRoutes from './presentation/routes/public/vote.routes';
import healthRoutes from './presentation/routes/health.routes';
import { SocketServer } from './presentation/socket/socketServer';
import { VoteService } from './domain/services/VoteService';
import { SongService } from './domain/services/SongService';
import { AuthService } from './domain/services/AuthService';
import { BookingService } from './domain/services/BookingService';
import { ReferralService } from './domain/services/ReferralService';
import {
  PrismaVoteRepository,
  PrismaSongRepository,
  PrismaUserRepository,
  PrismaBookingRepository,
  PrismaBlockedDateRepository,
  PrismaFormatRepository,
  PrismaReferralLinkRepository,
  PrismaReferralEventRepository,
  PrismaAgentRepository,
} from './infrastructure/database/repositories';
import { BotManager, setBotManager, getBotManager } from './infrastructure/telegram/botManager';
import { getAllowedOrigins } from './config/cors';

// Загружаем переменные окружения
dotenv.config();

/** Получить экземпляр Socket.io сервера (для контроллеров). */
export function getSocketServer(): SocketServer | undefined {
  return (global as typeof globalThis & { socketServer?: SocketServer }).socketServer;
}

// Валидация обязательных переменных при старте
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  logger.error('JWT_SECRET must be set and at least 32 characters!');
  process.exit(1);
}

const allowedOrigins = getAllowedOrigins();
if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  logger.error('FRONTEND_URL must be set in production!');
  process.exit(1);
}

const app: Express = express();
const httpServer: HTTPServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware: Helmet с CSP и HSTS
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'https:'],
        mediaSrc: ["'self'", 'https://storage.googleapis.com'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// CORS без wildcard: только разрешённые origins
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// BigInt serialization replacer для JSON.stringify
// Преобразует BigInt в строку для безопасной сериализации
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Статические файлы для загруженных изображений
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(uploadDir));

// Health endpoints (no rate limit — for monitoring/K8s probes)
app.use('/health', healthRoutes);

// API routes
app.get('/api', (_req, res) => {
  res.json({
    message: 'Музыканты API',
    version: '1.0.0',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/songs', songsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/votes', votesRoutes);
app.use('/api/formats', formatsRoutes);
app.use('/api/partners', partnersRoutes);
app.use('/api/posters', postersRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/public/vote', publicVoteRoutes);

// Admin routes
app.use('/api/admin/songs', adminSongsRoutes);
app.use('/api/admin/votes', adminVotesRoutes);
app.use('/api/admin/bookings', adminBookingsRoutes);
app.use('/api/admin/formats', adminFormatsRoutes);
app.use('/api/admin/partners', adminPartnersRoutes);
app.use('/api/admin/posters', adminPostersRoutes);
app.use('/api/admin/reviews', adminReviewsRoutes);
app.use('/api/admin/agents', adminAgentsRoutes);

// Error handler (должен быть последним)
app.use(errorHandler);

// Инициализация сервера
async function startServer() {
  try {
    // Подключаемся к БД
    await connectDatabase();
    logger.info('Database connected');

    // Подключаемся к Redis
    await connectRedis();
    logger.info('Redis connected');

    // Создаем репозитории
    const userRepository = new PrismaUserRepository();
    const songRepository = new PrismaSongRepository();
    const voteRepository = new PrismaVoteRepository();

    // Создаем сервисы
    const authService = new AuthService(
      userRepository,
      process.env.JWT_SECRET || '',
      process.env.JWT_EXPIRES_IN || '7d',
      process.env.TELEGRAM_ADMIN_BOT_TOKEN || '',
      process.env.TELEGRAM_USER_BOT_TOKEN || undefined,
      redis
    );

    const songService = new SongService(songRepository);
    const voteService = new VoteService(voteRepository, songRepository, userRepository);

    // Создаем сервисы для бронирований и рефералов
    const bookingRepository = new PrismaBookingRepository();
    const blockedDateRepository = new PrismaBlockedDateRepository();
    const formatRepository = new PrismaFormatRepository();
    const bookingService = new BookingService(
      bookingRepository,
      blockedDateRepository,
      userRepository,
      formatRepository
    );

    const agentRepository = new PrismaAgentRepository();
    const referralLinkRepository = new PrismaReferralLinkRepository();
    const referralEventRepository = new PrismaReferralEventRepository();
    const referralService = new ReferralService(
      referralLinkRepository,
      referralEventRepository,
      agentRepository,
      userRepository
    );

    // Инициализируем Socket.io сервер
    const socketServer = new SocketServer(httpServer, voteService, songService, authService);
    globalThis.socketServer = socketServer;
    logger.info('Socket.io server initialized');

    // Инициализируем Telegram Bots
    const botManager = new BotManager(referralService, bookingService, userRepository, bookingRepository);
    await botManager.initialize();
    setBotManager(botManager);
    logger.info('Telegram bots initialized');

    // Запускаем сервер
    httpServer.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();

/**
 * Graceful Shutdown Handler
 * Корректно завершает работу сервера при получении сигналов SIGTERM/SIGINT
 */
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn(`${signal} received again, forcing shutdown...`);
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Таймаут на случай если shutdown затягивается
  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout, forcing exit');
    process.exit(1);
  }, 30000); // 30 секунд

  try {
    // 1. Прекращаем принимать новые HTTP запросы
    httpServer.close(() => {
      logger.info('HTTP server closed, no longer accepting connections');
    });

    // 2. Закрываем Socket.IO соединения
    const socketServer = globalThis.socketServer;
    if (socketServer) {
      const io = socketServer.getIO();
      io.disconnectSockets(true);
      logger.info('Socket.IO connections closed');
    }

    // 3. Останавливаем Telegram ботов
    const botManager = getBotManager();
    if (botManager) {
      await botManager.stop();
      logger.info('Telegram bots stopped');
    }

    // 4. Закрываем Redis соединение
    await disconnectRedis();
    logger.info('Redis connection closed');

    // 5. Закрываем Prisma соединение
    await disconnectDatabase();
    logger.info('Database connection closed');

    // Очищаем таймаут
    clearTimeout(shutdownTimeout);

    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// Обработчики сигналов
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Обработчик необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

export default app;
