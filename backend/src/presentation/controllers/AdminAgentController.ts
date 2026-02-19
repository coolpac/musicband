import { Request, Response, NextFunction } from 'express';
import { AgentService } from '../../domain/services/AgentService';
import { ReferralService } from '../../domain/services/ReferralService';
import { logger } from '../../shared/utils/logger';

export class AdminAgentController {
  constructor(
    private agentService: AgentService,
    private referralService: ReferralService
  ) {}

  /**
   * GET /api/admin/agents
   * Получить всех агентов
   */
  async getAllAgents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as 'active' | 'inactive' | 'suspended' | undefined;
      const agents = await this.agentService.getAllAgents(status);

      res.json({
        success: true,
        data: agents,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/agents
   * Создать агента из пользователя
   */
  async createAgent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as { userId?: unknown };
      const userId = body.userId;
      if (typeof userId !== 'string' || !userId) {
        res.status(400).json({
          success: false,
          error: { message: 'userId is required', code: 'VALIDATION_ERROR' },
        });
        return;
      }

      const agent = await this.agentService.createAgent(userId);

      logger.info('Agent created by admin', {
        agentId: agent.id,
        userId,
        adminId: req.user?.userId,
      });

      res.status(201).json({
        success: true,
        data: agent,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/agents/:id/status
   * Обновить статус агента
   */
  async updateAgentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = req.params as { id?: string };
      const body = req.body as { status?: string };
      const id = params.id;
      const status = body.status;
      const validStatuses = ['active', 'inactive', 'suspended'] as const;

      if (!id || !status || !validStatuses.includes(status as (typeof validStatuses)[number])) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid status', code: 'VALIDATION_ERROR' },
        });
        return;
      }

      const agent = await this.agentService.updateAgentStatus(
        id,
        status as 'active' | 'inactive' | 'suspended'
      );

      res.json({
        success: true,
        data: agent,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/agents/:id/stats
   * Получить статистику агента
   */
  async getAgentStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const stats = await this.referralService.getAgentStats(id, startDate, endDate);
      const agent = await this.agentService.getAgentById(id);

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
   * GET /api/admin/agents/:id/events
   * Получить события агента
   */
  async getAgentEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const eventType = req.query.eventType as
        | 'click'
        | 'registration'
        | 'booking'
        | 'vote'
        | undefined;
      const status = req.query.status as 'pending' | 'confirmed' | 'rejected' | undefined;

      const result = await this.referralService.getAgentEvents(id, {
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
