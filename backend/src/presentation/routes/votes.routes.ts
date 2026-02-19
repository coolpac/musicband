import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { VoteController } from '../controllers/VoteController';
import { VoteService } from '../../domain/services/VoteService';
import { PrismaVoteRepository } from '../../infrastructure/database/repositories/VoteRepository';
import { PrismaSongRepository } from '../../infrastructure/database/repositories/SongRepository';
import { PrismaUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { validate } from '../middleware/validator';
import { CastVoteSchema } from '../../application/dto/vote.dto';
import { authenticate } from '../middleware/auth';
import { AuthService } from '../../domain/services/AuthService';
import { redis } from '../../config/redis';
import { voteRateLimiter, publicApiRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const voteRepository = new PrismaVoteRepository();
const songRepository = new PrismaSongRepository();
const userRepository = new PrismaUserRepository();
const voteService = new VoteService(voteRepository, songRepository, userRepository);
const voteController = new VoteController(voteService);

// Создаем authService для middleware
const authService = new AuthService(
  userRepository,
  process.env.JWT_SECRET || '',
  process.env.JWT_EXPIRES_IN || '7d',
  process.env.TELEGRAM_ADMIN_BOT_TOKEN || '',
  process.env.TELEGRAM_USER_BOT_TOKEN || undefined,
  redis
);

// Публичные маршруты
router.get(
  '/results',
  asyncHandler(publicApiRateLimiter),
  asyncHandler(voteController.getResults.bind(voteController))
);

// Защищенные маршруты (требуют авторизации)
router.post(
  '/',
  asyncHandler(authenticate(authService)),
  asyncHandler(voteRateLimiter),
  validate(CastVoteSchema),
  asyncHandler(voteController.castVote.bind(voteController))
);

router.get(
  '/my',
  asyncHandler(authenticate(authService)),
  asyncHandler(voteController.getMyVote.bind(voteController))
);

export default router;
