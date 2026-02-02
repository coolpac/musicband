import { Router } from 'express';
import { AdminAgentController } from '../../controllers/AdminAgentController';
import { AgentService } from '../../../domain/services/AgentService';
import { ReferralService } from '../../../domain/services/ReferralService';
import {
  PrismaAgentRepository,
  PrismaReferralLinkRepository,
  PrismaReferralEventRepository,
  PrismaUserRepository,
} from '../../../infrastructure/database/repositories';
import { authenticate, requireAdmin } from '../../middleware/auth';
import { AuthService } from '../../../domain/services/AuthService';
import { adminRateLimiter } from '../../middleware/rateLimit';
import { redis } from '../../../config/redis';

const router = Router();

// Создаем зависимости
const agentRepository = new PrismaAgentRepository();
const referralLinkRepository = new PrismaReferralLinkRepository();
const referralEventRepository = new PrismaReferralEventRepository();
const userRepository = new PrismaUserRepository();

const agentService = new AgentService(
  agentRepository,
  userRepository,
  referralLinkRepository,
  referralEventRepository
);
const referralService = new ReferralService(
  referralLinkRepository,
  referralEventRepository,
  agentRepository,
  userRepository
);

const adminAgentController = new AdminAgentController(agentService, referralService);

// Создаем authService для middleware
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

router.get('/', adminAgentController.getAllAgents.bind(adminAgentController));
router.post('/', adminAgentController.createAgent.bind(adminAgentController));
router.put('/:id/status', adminAgentController.updateAgentStatus.bind(adminAgentController));
router.get('/:id/stats', adminAgentController.getAgentStats.bind(adminAgentController));
router.get('/:id/events', adminAgentController.getAgentEvents.bind(adminAgentController));

export default router;
