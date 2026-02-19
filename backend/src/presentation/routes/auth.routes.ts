import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { AuthController } from '../controllers/AuthController';
import { validate } from '../middleware/validator';
import { TelegramAuthSchema, AdminAuthSchema } from '../../application/dto/auth.dto';
import { authenticate } from '../middleware/auth';
import { AuthService } from '../../domain/services/AuthService';
import { PrismaUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { redis } from '../../config/redis';
import { authRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Создаем зависимости (redis для token blacklist при logout)
const userRepository = new PrismaUserRepository();
const authService = new AuthService(
  userRepository,
  process.env.JWT_SECRET || '',
  process.env.JWT_EXPIRES_IN || '7d',
  process.env.TELEGRAM_ADMIN_BOT_TOKEN || '',
  process.env.TELEGRAM_USER_BOT_TOKEN || undefined,
  redis
);
const authController = new AuthController(authService);

// Публичные маршруты с rate limiting
router.post(
  '/telegram',
  asyncHandler(authRateLimiter),
  validate(TelegramAuthSchema),
  asyncHandler(authController.authenticateTelegram.bind(authController))
);

router.post(
  '/admin/login',
  asyncHandler(authRateLimiter),
  validate(AdminAuthSchema),
  asyncHandler(authController.authenticateAdmin.bind(authController))
);

// Защищенные маршруты
router.post(
  '/logout',
  asyncHandler(authenticate(authService)),
  asyncHandler(authController.logout.bind(authController))
);

router.get(
  '/me',
  asyncHandler(authenticate(authService)),
  asyncHandler(authController.getCurrentUser.bind(authController))
);
router.get(
  '/me/avatar',
  asyncHandler(authenticate(authService)),
  asyncHandler(authController.getAvatar.bind(authController))
);

export default router;
