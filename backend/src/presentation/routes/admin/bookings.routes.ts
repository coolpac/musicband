import { Router } from 'express';
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
const bookingService = new BookingService(
  bookingRepository,
  blockedDateRepository,
  userRepository
);
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
router.use(authenticate(authService));
router.use(requireAdmin);

// Применяем rate limiting для админских endpoints
router.use(adminRateLimiter);

// Бронирования
router.get('/', adminBookingController.getAllBookings.bind(adminBookingController));
router.get('/stats', adminBookingController.getStats.bind(adminBookingController));
router.put(
  '/:id/status',
  validate(UpdateBookingStatusSchema),
  adminBookingController.updateBookingStatus.bind(adminBookingController)
);
router.put(
  '/:id/income',
  validate(UpdateBookingIncomeSchema),
  adminBookingController.updateBookingIncome.bind(adminBookingController)
);
router.post(
  '/:id/complete',
  validate(CompleteBookingSchema),
  adminBookingController.completeBooking.bind(adminBookingController)
);
router.delete('/:id', adminBookingController.deleteBooking.bind(adminBookingController));
router.get('/calendar', adminBookingController.getCalendar.bind(adminBookingController));
router.get('/blocked-dates', adminBookingController.getBlockedDates.bind(adminBookingController));

// Блокировка дат
router.post(
  '/block-date',
  validate(BlockDateSchema),
  adminBookingController.blockDate.bind(adminBookingController)
);
router.delete('/block-date/:id', adminBookingController.unblockDate.bind(adminBookingController));

export default router;
