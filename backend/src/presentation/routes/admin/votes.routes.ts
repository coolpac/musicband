import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { AdminVoteController } from '../../controllers/AdminVoteController';
import { VoteService } from '../../../domain/services/VoteService';
import {
  PrismaVoteRepository,
  PrismaSongRepository,
  PrismaUserRepository,
} from '../../../infrastructure/database/repositories';
import { validate } from '../../middleware/validator';
import { StartSessionSchema } from '../../../application/dto/vote.dto';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthService } from '../../../domain/services/AuthService';
import { redis } from '../../../config/redis';
import { adminRateLimiter } from '../../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const voteRepository = new PrismaVoteRepository();
const songRepository = new PrismaSongRepository();
const userRepository = new PrismaUserRepository();
const voteService = new VoteService(voteRepository, songRepository, userRepository);
const adminVoteController = new AdminVoteController(voteService);

// Создаем authService для middleware
const authService = new AuthService(
  userRepository,
  process.env.JWT_SECRET || '',
  process.env.JWT_EXPIRES_IN || '7d',
  process.env.TELEGRAM_ADMIN_BOT_TOKEN || '',
  process.env.TELEGRAM_USER_BOT_TOKEN || undefined,
  redis
);

// Все маршруты требуют авторизацию админа
router.use(asyncHandler(authenticate(authService)));
router.use(requireAdmin);

// Применяем rate limiting для админских endpoints
router.use(asyncHandler(adminRateLimiter));

router.get('/sessions', asyncHandler(adminVoteController.getSessions.bind(adminVoteController)));
router.get(
  '/sessions/:id',
  asyncHandler(adminVoteController.getSessionById.bind(adminVoteController))
);
router.post(
  '/sessions/start',
  validate(StartSessionSchema),
  asyncHandler(adminVoteController.startSession.bind(adminVoteController))
);
router.post(
  '/sessions/:id/end',
  asyncHandler(adminVoteController.endSession.bind(adminVoteController))
);
router.get(
  '/sessions/:id/qr',
  asyncHandler(adminVoteController.getSessionQR.bind(adminVoteController))
);
router.post(
  '/sessions/:id/qr/send-to-admins',
  asyncHandler(adminVoteController.sendSessionQRToAdmins.bind(adminVoteController))
);
router.get('/stats', asyncHandler(adminVoteController.getStats.bind(adminVoteController)));
router.get('/history', asyncHandler(adminVoteController.getHistory.bind(adminVoteController)));

export default router;
