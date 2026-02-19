import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { AdminBookingController } from '../../controllers/AdminBookingController';
import { BookingService } from '../../../domain/services/BookingService';
import {
  PrismaBookingRepository,
  PrismaBlockedDateRepository,
  PrismaUserRepository,
} from '../../../infrastructure/database/repositories';
import { validate } from '../../middleware/validator';
import {
  UpdateBookingStatusSchema,
  UpdateBookingIncomeSchema,
  CompleteBookingSchema,
  BlockDateSchema,
} from '../../../application/dto/booking.dto';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthService } from '../../../domain/services/AuthService';
import { adminRateLimiter } from '../../middleware/rateLimit';
import { redis } from '../../../config/redis';

const router = Router();

// Создаем зависимости
const bookingRepository = new PrismaBookingRepository();
const blockedDateRepository = new PrismaBlockedDateRepository();
const userRepository = new PrismaUserRepository();
const bookingService = new BookingService(bookingRepository, blockedDateRepository, userRepository);
const adminBookingController = new AdminBookingController(bookingService);

// Создаем authService для middleware
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

// Бронирования
router.get('/', asyncHandler(adminBookingController.getAllBookings.bind(adminBookingController)));
router.get('/stats', asyncHandler(adminBookingController.getStats.bind(adminBookingController)));
router.put(
  '/:id/status',
  validate(UpdateBookingStatusSchema),
  asyncHandler(adminBookingController.updateBookingStatus.bind(adminBookingController))
);
router.put(
  '/:id/income',
  validate(UpdateBookingIncomeSchema),
  asyncHandler(adminBookingController.updateBookingIncome.bind(adminBookingController))
);
router.post(
  '/:id/complete',
  validate(CompleteBookingSchema),
  asyncHandler(adminBookingController.completeBooking.bind(adminBookingController))
);
router.delete(
  '/:id',
  asyncHandler(adminBookingController.deleteBooking.bind(adminBookingController))
);
router.get(
  '/calendar',
  asyncHandler(adminBookingController.getCalendar.bind(adminBookingController))
);
router.get(
  '/blocked-dates',
  asyncHandler(adminBookingController.getBlockedDates.bind(adminBookingController))
);

// Блокировка дат
router.post(
  '/block-date',
  validate(BlockDateSchema),
  asyncHandler(adminBookingController.blockDate.bind(adminBookingController))
);
router.delete(
  '/block-date/:id',
  asyncHandler(adminBookingController.unblockDate.bind(adminBookingController))
);

export default router;
