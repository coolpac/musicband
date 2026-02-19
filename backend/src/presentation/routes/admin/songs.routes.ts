import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { AdminSongController } from '../../controllers/AdminSongController';
import { SongService } from '../../../domain/services/SongService';
import { PrismaSongRepository } from '../../../infrastructure/database/repositories/SongRepository';
import { validate } from '../../middleware/validator';
import { CreateSongSchema, UpdateSongSchema } from '../../../application/dto/song.dto';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthService } from '../../../domain/services/AuthService';
import { redis } from '../../../config/redis';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/UserRepository';
import { adminRateLimiter } from '../../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const songRepository = new PrismaSongRepository();
const songService = new SongService(songRepository);
const adminSongController = new AdminSongController(songService);

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
router.use(asyncHandler(authenticate(authService)));
router.use(requireAdmin);

// Применяем rate limiting для админских endpoints
router.use(asyncHandler(adminRateLimiter));

router.get('/', asyncHandler(adminSongController.getAllSongs.bind(adminSongController)));
router.post(
  '/',
  validate(CreateSongSchema),
  asyncHandler(adminSongController.createSong.bind(adminSongController))
);
router.put(
  '/:id',
  validate(UpdateSongSchema),
  asyncHandler(adminSongController.updateSong.bind(adminSongController))
);
router.delete('/:id', asyncHandler(adminSongController.deleteSong.bind(adminSongController)));
router.post('/:id/toggle', asyncHandler(adminSongController.toggleSong.bind(adminSongController)));

export default router;
