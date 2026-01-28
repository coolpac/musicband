import { Router } from 'express';
import { PublicVoteController } from '../../controllers/PublicVoteController';
import { VoteService } from '../../../domain/services/VoteService';
import { SongService } from '../../../domain/services/SongService';
import {
  PrismaVoteRepository,
  PrismaSongRepository,
  PrismaUserRepository,
} from '../../../infrastructure/database/repositories';
import { publicApiRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const voteRepository = new PrismaVoteRepository();
const songRepository = new PrismaSongRepository();
const userRepository = new PrismaUserRepository();
const voteService = new VoteService(voteRepository, songRepository, userRepository);
const songService = new SongService(songRepository);
const publicVoteController = new PublicVoteController(voteService, songService);

// Публичные маршруты (не требуют авторизации) с rate limiting
router.get('/session/:sessionId', publicApiRateLimiter, publicVoteController.getSessionInfo.bind(publicVoteController));
router.get('/active', publicApiRateLimiter, publicVoteController.getActiveSession.bind(publicVoteController));

export default router;
