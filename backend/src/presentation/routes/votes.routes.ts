import { Router } from 'express';
import { VoteController } from '../controllers/VoteController';
import { VoteService } from '../../domain/services/VoteService';
import { PrismaVoteRepository } from '../../infrastructure/database/repositories/VoteRepository';
import { PrismaSongRepository } from '../../infrastructure/database/repositories/SongRepository';
import { PrismaUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { validate } from '../middleware/validator';
import { CastVoteSchema } from '../../application/dto/vote.dto';
import { authenticate } from '../middleware/auth';
import { AuthService } from '../../domain/services/AuthService';
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
  process.env.TELEGRAM_USER_BOT_TOKEN || undefined
);

// Публичные маршруты
router.get('/results', publicApiRateLimiter, voteController.getResults.bind(voteController));

// Защищенные маршруты (требуют авторизации)
router.post(
  '/',
  authenticate(authService),
  voteRateLimiter, // Очень строгий лимит: 1 голос в минуту
  validate(CastVoteSchema),
  voteController.castVote.bind(voteController)
);

router.get('/my', authenticate(authService), voteController.getMyVote.bind(voteController));

export default router;
