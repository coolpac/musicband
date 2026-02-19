import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ReviewController } from '../controllers/ReviewController';
import { ReviewService } from '../../domain/services/ReviewService';
import {
  PrismaReviewRepository,
  PrismaUserRepository,
} from '../../infrastructure/database/repositories';
import { validate } from '../middleware/validator';
import { CreateReviewSchema } from '../../application/dto/review.dto';
import { authenticate } from '../middleware/auth';
import { AuthService } from '../../domain/services/AuthService';
import { redis } from '../../config/redis';
import { reviewRateLimiter, publicApiRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const reviewRepository = new PrismaReviewRepository();
const userRepository = new PrismaUserRepository();
const reviewService = new ReviewService(reviewRepository, userRepository);
const reviewController = new ReviewController(reviewService);

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
router.get(
  '/',
  asyncHandler(publicApiRateLimiter),
  asyncHandler(reviewController.getReviews.bind(reviewController))
);

// Защищенные маршруты
router.post(
  '/',
  asyncHandler(authenticate(authService)),
  asyncHandler(reviewRateLimiter),
  validate(CreateReviewSchema),
  asyncHandler(reviewController.createReview.bind(reviewController))
);

export default router;
