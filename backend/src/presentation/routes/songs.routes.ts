import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { SongController } from '../controllers/SongController';
import { SongService } from '../../domain/services/SongService';
import { PrismaSongRepository } from '../../infrastructure/database/repositories/SongRepository';
import { publicApiRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const songRepository = new PrismaSongRepository();
const songService = new SongService(songRepository);
const songController = new SongController(songService);

// Публичные маршруты с rate limiting
router.get(
  '/',
  asyncHandler(publicApiRateLimiter),
  asyncHandler(songController.getAllSongs.bind(songController))
);
router.get(
  '/:id',
  asyncHandler(publicApiRateLimiter),
  asyncHandler(songController.getSongById.bind(songController))
);
router.get(
  '/:id/lyrics',
  asyncHandler(publicApiRateLimiter),
  asyncHandler(songController.getSongLyrics.bind(songController))
);

export default router;
