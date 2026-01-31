import { Router } from 'express';
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
router.get('/', publicApiRateLimiter, formatController.getAllFormats.bind(formatController));
router.get('/for-booking', publicApiRateLimiter, formatController.getFormatsForBooking.bind(formatController));

export default router;
