import { Router } from 'express';
import { AdminPartnerController } from '../../controllers/AdminPartnerController';
import { PartnerService } from '../../../domain/services/PartnerService';
import { PrismaPartnerRepository } from '../../../infrastructure/database/repositories/PartnerRepository';
import { validate } from '../../middleware/validator';
import { CreatePartnerSchema, UpdatePartnerSchema } from '../../../application/dto/partner.dto';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthService } from '../../../domain/services/AuthService';
import { PrismaUserRepository } from '../../../infrastructure/database/repositories/UserRepository';
import { adminRateLimiter } from '../middleware/rateLimit';

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
  process.env.TELEGRAM_USER_BOT_TOKEN || undefined
);

// Все маршруты требуют авторизацию админа
router.use(authenticate(authService));
router.use(requireAdmin);

// Применяем rate limiting для админских endpoints
router.use(adminRateLimiter);

router.get('/', adminPartnerController.getAllPartners.bind(adminPartnerController));
router.post('/', validate(CreatePartnerSchema), adminPartnerController.createPartner.bind(adminPartnerController));
router.put('/:id', validate(UpdatePartnerSchema), adminPartnerController.updatePartner.bind(adminPartnerController));
router.delete('/:id', adminPartnerController.deletePartner.bind(adminPartnerController));

export default router;
