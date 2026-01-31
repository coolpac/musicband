import { Router } from 'express';
import { AgentController } from '../controllers/AgentController';
import { AgentService } from '../../domain/services/AgentService';
import { ReferralService } from '../../domain/services/ReferralService';
import {
  PrismaAgentRepository,
  PrismaReferralLinkRepository,
  PrismaReferralEventRepository,
  PrismaUserRepository,
} from '../../infrastructure/database/repositories';
import { validate } from '../middleware/validator';
import { CreateReferralLinkSchema } from '../../application/dto/agent.dto';
import { authenticate } from '../middleware/auth';
import { AuthService } from '../../domain/services/AuthService';
import { publicApiRateLimiter, referralRateLimiter } from '../middleware/rateLimit';

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

const agentController = new AgentController(agentService, referralService);

// Создаем authService для middleware
const authService = new AuthService(
  userRepository,
  process.env.JWT_SECRET || '',
  process.env.JWT_EXPIRES_IN || '7d',
  process.env.TELEGRAM_ADMIN_BOT_TOKEN || '',
  process.env.TELEGRAM_USER_BOT_TOKEN || undefined,
  redis
);

// Все маршруты требуют авторизацию агента
router.use(authenticate(authService));
// Проверка роли agent будет в контроллере через agentService.getAgentByUserId

router.get('/profile', publicApiRateLimiter, agentController.getProfile.bind(agentController));
router.get('/links', publicApiRateLimiter, agentController.getLinks.bind(agentController));
router.post(
  '/links',
  referralRateLimiter, // Лимит для создания ссылок
  validate(CreateReferralLinkSchema),
  agentController.createLink.bind(agentController)
);
router.get('/stats', publicApiRateLimiter, agentController.getStats.bind(agentController));
router.get('/events', publicApiRateLimiter, agentController.getEvents.bind(agentController));

export default router;
