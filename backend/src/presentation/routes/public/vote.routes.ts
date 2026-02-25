import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { PublicVoteController } from '../../controllers/PublicVoteController';
import { VoteService } from '../../../domain/services/VoteService';
import { SongService } from '../../../domain/services/SongService';
import {
  PrismaVoteRepository,
  PrismaSongRepository,
  PrismaUserRepository,
} from '../../../infrastructure/database/repositories';
import { publicApiRateLimiter, publicVotePostRateLimiter } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validator';
import { PublicCastVoteSchema, VoteWithInitDataSchema } from '../../../application/dto/vote.dto';
import { AuthService } from '../../../domain/services/AuthService';
import { redis } from '../../../config/redis';

const router = Router();

// Создаем зависимости
const voteRepository = new PrismaVoteRepository();
const songRepository = new PrismaSongRepository();
const userRepository = new PrismaUserRepository();
const voteService = new VoteService(voteRepository, songRepository, userRepository);
const songService = new SongService(songRepository);
const authService = new AuthService(
  userRepository,
  process.env.JWT_SECRET || '',
  process.env.JWT_EXPIRES_IN || '7d',
  process.env.TELEGRAM_ADMIN_BOT_TOKEN || '',
  process.env.TELEGRAM_USER_BOT_TOKEN || undefined,
  redis
);
const publicVoteController = new PublicVoteController(voteService, songService, authService);

// Публичные маршруты (не требуют авторизации) с rate limiting
router.get(
  '/session/:sessionId',
  asyncHandler(publicApiRateLimiter),
  asyncHandler(publicVoteController.getSessionInfo.bind(publicVoteController))
);
router.get(
  '/active',
  asyncHandler(publicApiRateLimiter),
  asyncHandler(publicVoteController.getActiveSession.bind(publicVoteController))
);
// Получить pending vote session (сохраняется ботом при /start vote_SESSION)
router.get(
  '/pending/:telegramId',
  asyncHandler(publicApiRateLimiter),
  asyncHandler(publicVoteController.getPendingSession.bind(publicVoteController))
);
// Голосование по initData (проверка Admin/User Bot, возвращает JWT для сокета)
router.post(
  '/with-initdata',
  asyncHandler(publicVotePostRateLimiter),
  validate(VoteWithInitDataSchema),
  asyncHandler(publicVoteController.castVoteWithInitData.bind(publicVoteController))
);
// Голосование по telegramId (fallback, когда initData недоступен)
router.post(
  '/',
  asyncHandler(publicVotePostRateLimiter),
  validate(PublicCastVoteSchema),
  asyncHandler(publicVoteController.castVote.bind(publicVoteController))
);

export default router;
