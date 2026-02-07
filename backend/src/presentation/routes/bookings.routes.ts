import { Router } from 'express';
import { BookingController } from '../controllers/BookingController';
import { BookingService } from '../../domain/services/BookingService';
import {
  PrismaBookingRepository,
  PrismaBlockedDateRepository,
  PrismaUserRepository,
} from '../../infrastructure/database/repositories';
import { validate } from '../middleware/validator';
import { CreateBookingSchema } from '../../application/dto/booking.dto';
import { authenticate } from '../middleware/auth';
import { AuthService } from '../../domain/services/AuthService';
import { redis } from '../../config/redis';
import { bookingRateLimiter, publicApiRateLimiter } from '../middleware/rateLimit';

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
const bookingController = new BookingController(bookingService);

// Создаем authService для middleware
const authService = new AuthService(
  userRepository,
  process.env.JWT_SECRET || '',
  process.env.JWT_EXPIRES_IN || '7d',
  process.env.TELEGRAM_ADMIN_BOT_TOKEN || '',
  process.env.TELEGRAM_USER_BOT_TOKEN || undefined,
  redis
);

// Публичные маршруты
router.get('/available-dates', publicApiRateLimiter, bookingController.getAvailableDates.bind(bookingController));

// Защищенные маршруты (требуют авторизации)
router.post(
  '/',
  authenticate(authService),
  bookingRateLimiter, // Средний лимит: 10 бронирований в час
  validate(CreateBookingSchema),
  bookingController.createBooking.bind(bookingController)
);

router.get('/my', authenticate(authService), bookingController.getMyBookings.bind(bookingController));

export default router;
