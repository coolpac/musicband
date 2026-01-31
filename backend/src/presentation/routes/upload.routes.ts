import { Router } from 'express';
import { ImageController } from '../controllers/ImageController';
import { ImageStorage } from '../../infrastructure/storage/ImageStorage';
import { upload, handleUploadError } from '../middleware/upload';
import { authenticate, requireAdmin } from '../middleware/auth';
import { AuthService } from '../../domain/services/AuthService';
import { redis } from '../../config/redis';
import { PrismaUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { uploadRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const imageStorage = new ImageStorage(
  process.env.UPLOAD_DIR || 'uploads',
  process.env.UPLOAD_BASE_URL || '/uploads'
);

// Инициализируем хранилище при старте
imageStorage.initialize().catch((error) => {
  console.error('Failed to initialize image storage:', error);
});

const imageController = new ImageController(imageStorage);

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

router.post(
  '/image',
  uploadRateLimiter, // Строгий лимит: 20 загрузок в час
  upload.single('image'),
  handleUploadError,
  imageController.uploadImage.bind(imageController)
);
router.delete('/image', imageController.deleteImage.bind(imageController));

export default router;
