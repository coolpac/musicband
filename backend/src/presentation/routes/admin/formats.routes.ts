import { Router } from 'express';
import { AdminFormatController } from '../../controllers/AdminFormatController';
import { FormatService } from '../../../domain/services/FormatService';
import { PrismaFormatRepository } from '../../../infrastructure/database/repositories/FormatRepository';
import { validate } from '../../middleware/validator';
import { CreateFormatSchema, UpdateFormatSchema } from '../../../application/dto/format.dto';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthService } from '../../../domain/services/AuthService';
import { redis } from '../../../config/redis';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/UserRepository';
import { adminRateLimiter } from '../../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const formatRepository = new PrismaFormatRepository();
const formatService = new FormatService(formatRepository);
const adminFormatController = new AdminFormatController(formatService);

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

router.get('/', adminFormatController.getAllFormats.bind(adminFormatController));
router.post('/', validate(CreateFormatSchema), adminFormatController.createFormat.bind(adminFormatController));
router.put('/:id', validate(UpdateFormatSchema), adminFormatController.updateFormat.bind(adminFormatController));
router.delete('/:id', adminFormatController.deleteFormat.bind(adminFormatController));

export default router;
