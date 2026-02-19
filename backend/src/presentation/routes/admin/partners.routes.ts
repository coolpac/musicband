import { Router } from 'express';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { AdminPartnerController } from '../../controllers/AdminPartnerController';
import { PartnerService } from '../../../domain/services/PartnerService';
import { PrismaPartnerRepository } from '../../../infrastructure/database/repositories/PartnerRepository';
import { validate } from '../../middleware/validator';
import {
  CreatePartnerSchema,
  UpdatePartnerSchema,
  ReorderPartnersSchema,
} from '../../../application/dto/partner.dto';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthService } from '../../../domain/services/AuthService';
import { redis } from '../../../config/redis';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/UserRepository';
import { adminRateLimiter } from '../../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const partnerRepository = new PrismaPartnerRepository();
const partnerService = new PartnerService(partnerRepository);
const adminPartnerController = new AdminPartnerController(partnerService);

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

router.get('/', asyncHandler(adminPartnerController.getAllPartners.bind(adminPartnerController)));
router.post(
  '/',
  validate(CreatePartnerSchema),
  asyncHandler(adminPartnerController.createPartner.bind(adminPartnerController))
);
router.patch(
  '/reorder',
  validate(ReorderPartnersSchema),
  asyncHandler(adminPartnerController.reorderPartners.bind(adminPartnerController))
);
router.put(
  '/:id',
  validate(UpdatePartnerSchema),
  asyncHandler(adminPartnerController.updatePartner.bind(adminPartnerController))
);
router.delete(
  '/:id',
  asyncHandler(adminPartnerController.deletePartner.bind(adminPartnerController))
);

export default router;
