import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { PublicSiteController } from '../../controllers/PublicSiteController';
import { SiteContentService } from '../../../domain/services/SiteContentService';
import { SiteBookingService } from '../../../domain/services/SiteBookingService';
import { BookingService } from '../../../domain/services/BookingService';
import {
  PrismaSiteContentRepository,
  PrismaPosterRepository,
  PrismaFormatRepository,
  PrismaPartnerRepository,
  PrismaBookingRepository,
  PrismaBlockedDateRepository,
  PrismaUserRepository,
} from '../../../infrastructure/database/repositories';
import { ImageStorage } from '../../../infrastructure/storage/ImageStorage';
import {
  sitePublicRateLimiter,
  siteBookingHourRateLimiter,
  siteBookingDayRateLimiter,
} from '../../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const siteContentRepository = new PrismaSiteContentRepository();
const posterRepository = new PrismaPosterRepository();
const formatRepository = new PrismaFormatRepository();
const partnerRepository = new PrismaPartnerRepository();
const bookingRepository = new PrismaBookingRepository();
const blockedDateRepository = new PrismaBlockedDateRepository();
const userRepository = new PrismaUserRepository();

// Только чтение: каталоги создаёт upload.routes, здесь initialize() не нужен
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
const bookingService = new BookingService(bookingRepository, blockedDateRepository, userRepository);
const siteBookingService = new SiteBookingService(bookingService, formatRepository);
const publicSiteController = new PublicSiteController(siteContentService, siteBookingService);

// Агрегированный контент лендинга: свой бакет лимита, кеш + ETag внутри контроллера
router.get(
  '/',
  asyncHandler(sitePublicRateLimiter),
  asyncHandler(publicSiteController.getSite.bind(publicSiteController))
);

// Заявка с сайта: два бакета (час и сутки) + honeypot/таймер внутри контроллера.
// validate() здесь не используется — форме нужен ответ 422 с картой полей.
router.post(
  '/bookings',
  asyncHandler(siteBookingHourRateLimiter),
  asyncHandler(siteBookingDayRateLimiter),
  asyncHandler(publicSiteController.createBooking.bind(publicSiteController))
);

export default router;
