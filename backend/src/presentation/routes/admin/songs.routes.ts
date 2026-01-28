import { Router } from 'express';
import { AdminSongController } from '../../controllers/AdminSongController';
import { SongService } from '../../../domain/services/SongService';
import { PrismaSongRepository } from '../../../infrastructure/database/repositories/SongRepository';
import { validate } from '../../middleware/validator';
import { CreateSongSchema, UpdateSongSchema } from '../../../application/dto/song.dto';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthService } from '../../../domain/services/AuthService';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/UserRepository';
import { adminRateLimiter } from '../middleware/rateLimit';

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
  process.env.TELEGRAM_USER_BOT_TOKEN || undefined
);

// Все маршруты требуют авторизацию админа
router.use(authenticate(authService));
router.use(requireAdmin);

// Применяем rate limiting для админских endpoints
router.use(adminRateLimiter);

router.get('/', adminSongController.getAllSongs.bind(adminSongController));
router.post('/', validate(CreateSongSchema), adminSongController.createSong.bind(adminSongController));
router.put('/:id', validate(UpdateSongSchema), adminSongController.updateSong.bind(adminSongController));
router.delete('/:id', adminSongController.deleteSong.bind(adminSongController));
router.post('/:id/toggle', adminSongController.toggleSong.bind(adminSongController));

export default router;
