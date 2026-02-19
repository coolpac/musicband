import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { FormatController } from '../controllers/FormatController';
import { FormatService } from '../../domain/services/FormatService';
import { PrismaFormatRepository } from '../../infrastructure/database/repositories/FormatRepository';
import { publicApiRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const formatRepository = new PrismaFormatRepository();
const formatService = new FormatService(formatRepository);
const formatController = new FormatController(formatService);

// Публичные маршруты с rate limiting
router.get(
  '/',
  asyncHandler(publicApiRateLimiter),
  asyncHandler(formatController.getAllFormats.bind(formatController))
);
router.get(
  '/for-booking',
  asyncHandler(publicApiRateLimiter),
  asyncHandler(formatController.getFormatsForBooking.bind(formatController))
);

export default router;
