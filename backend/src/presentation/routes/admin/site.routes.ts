import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { AdminSiteController } from '../../controllers/AdminSiteController';
import { SiteContentService } from '../../../domain/services/SiteContentService';
import {
  PrismaSiteContentRepository,
  PrismaPosterRepository,
  PrismaFormatRepository,
  PrismaPartnerRepository,
  PrismaUserRepository,
} from '../../../infrastructure/database/repositories';
import { ImageStorage } from '../../../infrastructure/storage/ImageStorage';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthService } from '../../../domain/services/AuthService';
import { redis } from '../../../config/redis';
import { adminRateLimiter } from '../../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const siteContentRepository = new PrismaSiteContentRepository();
const posterRepository = new PrismaPosterRepository();
const formatRepository = new PrismaFormatRepository();
const partnerRepository = new PrismaPartnerRepository();
const imageStorage = new ImageStorage(
  process.env.UPLOAD_DIR || 'uploads',
  process.env.UPLOAD_BASE_URL || '/uploads'
);
const siteContentService = new SiteContentService(
  siteContentRepository,
  posterRepository,
  formatRepository,
  partnerRepository,
  imageStorage
);
const adminSiteController = new AdminSiteController(siteContentService);

// Создаем authService для middleware
const userRepository = new PrismaUserRepository();
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

router.get('/content', asyncHandler(adminSiteController.getContent.bind(adminSiteController)));
// validate() не подходит: тело — произвольный JSON секции, проверяем его вручную
// (белый список id, лимит 256 КБ, глубина, prototype pollution, javascript:)
router.put(
  '/content/:section',
  asyncHandler(adminSiteController.updateSection.bind(adminSiteController))
);

export default router;
