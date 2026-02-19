import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { PartnerController } from '../controllers/PartnerController';
import { PartnerService } from '../../domain/services/PartnerService';
import { PrismaPartnerRepository } from '../../infrastructure/database/repositories/PartnerRepository';
import { publicApiRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Создаем зависимости
const partnerRepository = new PrismaPartnerRepository();
const partnerService = new PartnerService(partnerRepository);
const partnerController = new PartnerController(partnerService);

// Публичные маршруты с rate limiting
router.get(
  '/',
  asyncHandler(publicApiRateLimiter),
  asyncHandler(partnerController.getAllPartners.bind(partnerController))
);

export default router;
