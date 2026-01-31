import { Router } from 'express';
import { AdminPosterController } from '../../controllers/AdminPosterController';
import { PosterService } from '../../../domain/services/PosterService';
import { PrismaPosterRepository } from '../../../infrastructure/database/repositories/PosterRepository';
import { validate } from '../../middleware/validator';
import { CreatePosterSchema, UpdatePosterSchema } from '../../../application/dto/poster.dto';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthService } from '../../../domain/services/AuthService';
import { redis } from '../../../config/redis';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/UserRepository';
import { adminRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const posterRepository = new PrismaPosterRepository();
const posterService = new PosterService(posterRepository);
const adminPosterController = new AdminPosterController(posterService);

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
router.use(authenticate(authService));
router.use(requireAdmin);

// Применяем rate limiting для админских endpoints
router.use(adminRateLimiter);

router.get('/', adminPosterController.getAllPosters.bind(adminPosterController));
router.post('/', validate(CreatePosterSchema), adminPosterController.createPoster.bind(adminPosterController));
router.put('/:id', validate(UpdatePosterSchema), adminPosterController.updatePoster.bind(adminPosterController));
router.delete('/:id', adminPosterController.deletePoster.bind(adminPosterController));

export default router;
