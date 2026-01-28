import { Request, Response, NextFunction } from 'express';
import { AgentService } from '../../domain/services/AgentService';
import { ReferralService } from '../../domain/services/ReferralService';
import { CreateReferralLinkDto } from '../../application/dto/agent.dto';
import { logger } from '../../shared/utils/logger';

export class AgentController {
  constructor(
    private agentService: AgentService,
    private referralService: ReferralService
  ) {}

  /**
   * GET /api/agent/profile
   * Получить профиль агента
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const agent = await this.agentService.getAgentByUserId(req.user.userId);

      res.json({
        success: true,
        data: agent,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/agent/links
   * Получить все реферальные ссылки агента
   */
  async getLinks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const agent = await this.agentService.getAgentByUserId(req.user.userId);
      const links = await this.referralService.getAgentLinks(agent.id);

      // Формируем полные URL для ссылок
      const baseUrl = process.env.FRONTEND_URL || 'https://t.me/your_bot';
      const linksWithUrls = links.map((link) => ({
        ...link,
        fullUrl: `${baseUrl}?start=${link.linkCode}`,
      }));

      res.json({
        success: true,
        data: linksWithUrls,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/agent/links
   * Создать новую реферальную ссылку
   */
  async createLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const data = req.body as CreateReferralLinkDto;
      const agent = await this.agentService.getAgentByUserId(req.user.userId);

      const link = await this.referralService.createReferralLink(agent.id, {
        name: data.name,
        expiresAt: data.expiresAt,
      });

      const baseUrl = process.env.FRONTEND_URL || 'https://t.me/your_bot';
      const fullUrl = `${baseUrl}?start=${link.linkCode}`;

      logger.info('Referral link created by agent', {
        linkId: link.id,
        agentId: agent.id,
      });

      res.status(201).json({
        success: true,
        data: {
          ...link,
          fullUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/agent/stats
   * Получить статистику агента
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const agent = await this.agentService.getAgentByUserId(req.user.userId);

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const stats = await this.referralService.getAgentStats(agent.id, startDate, endDate);

      res.json({
        success: true,
        data: {
          agent: {
            id: agent.id,
            agentCode: agent.agentCode,
            totalReferrals: agent.totalReferrals,
            totalActiveReferrals: agent.totalActiveReferrals,
          },
          stats,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/agent/events
   * Получить события рефералов
   */
  async getEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const agent = await this.agentService.getAgentByUserId(req.user.userId);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const eventType = req.query.eventType as 'click' | 'registration' | 'booking' | 'vote' | undefined;
      const status = req.query.status as 'pending' | 'confirmed' | 'rejected' | undefined;

      const result = await this.referralService.getAgentEvents(agent.id, {
        page,
        limit,
        eventType,
        status,
      });

      res.json({
        success: true,
        data: {
          events: result.events,
          total: result.total,
          page,
          limit,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
