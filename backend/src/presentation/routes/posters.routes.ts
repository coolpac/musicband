import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { PosterController } from '../controllers/PosterController';
import { PosterService } from '../../domain/services/PosterService';
import { PrismaPosterRepository } from '../../infrastructure/database/repositories/PosterRepository';
import { publicApiRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const posterRepository = new PrismaPosterRepository();
const posterService = new PosterService(posterRepository);
const posterController = new PosterController(posterService);

// Публичные маршруты с rate limiting
router.get(
  '/',
  asyncHandler(publicApiRateLimiter),
  asyncHandler(posterController.getAllPosters.bind(posterController))
);

export default router;
