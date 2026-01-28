import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { validate } from '../middleware/validator';
import { TelegramAuthSchema, AdminAuthSchema } from '../../application/dto/auth.dto';
import { authenticate } from '../middleware/auth';
import { AuthService } from '../../domain/services/AuthService';
import { PrismaUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { authRateLimiter, expressRateLimiters } from '../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const userRepository = new PrismaUserRepository();
const authService = new AuthService(
  userRepository,
  process.env.JWT_SECRET || '',
  process.env.JWT_EXPIRES_IN || '7d',
  process.env.TELEGRAM_ADMIN_BOT_TOKEN || '',
  process.env.TELEGRAM_USER_BOT_TOKEN || undefined
);
const authController = new AuthController(authService);

// Публичные маршруты с rate limiting
router.post(
  '/telegram',
  authRateLimiter, // Строгий лимит для защиты от брутфорса
  validate(TelegramAuthSchema),
  authController.authenticateTelegram.bind(authController)
);

router.post(
  '/admin/login',
  authRateLimiter, // Строгий лимит для защиты от брутфорса
  validate(AdminAuthSchema),
  authController.authenticateAdmin.bind(authController)
);

// Защищенные маршруты
router.post('/logout', authenticate(authService), authController.logout.bind(authController));

router.get('/me', authenticate(authService), authController.getCurrentUser.bind(authController));

export default router;
