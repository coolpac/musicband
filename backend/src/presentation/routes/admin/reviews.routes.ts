import { Router } from 'express';
import { AdminReviewController } from '../../controllers/AdminReviewController';
import { ReviewService } from '../../../domain/services/ReviewService';
import { PrismaReviewRepository, PrismaUserRepository } from '../../../infrastructure/database/repositories';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthService } from '../../../domain/services/AuthService';
import { redis } from '../../../config/redis';
import { adminRateLimiter } from '../../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const reviewRepository = new PrismaReviewRepository();
const userRepository = new PrismaUserRepository();
const reviewService = new ReviewService(reviewRepository, userRepository);
const adminReviewController = new AdminReviewController(reviewService);

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

router.get('/', adminReviewController.getAllReviews.bind(adminReviewController));
router.delete('/:id', adminReviewController.deleteReview.bind(adminReviewController));

export default router;
