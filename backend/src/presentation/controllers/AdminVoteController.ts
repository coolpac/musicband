import { Request, Response, NextFunction } from 'express';
import { VoteService } from '../../domain/services/VoteService';
import { StartSessionDto } from '../../application/dto/vote.dto';
import { logger } from '../../shared/utils/logger';
import { getSocketServer } from '../../app';
import { getBotManager } from '../../infrastructure/telegram/botManager';
import type { Platform } from '@prisma/client';
import {
  generateVotingSessionQR,
  generateVotingSessionQRForPlatforms,
  normalizeTelegramBotUsername,
  normalizeMaxBotUsername,
} from '../../infrastructure/utils/qrcode';

export class AdminVoteController {
  constructor(private voteService: VoteService) {}

  private getVotingBotUsername(platform: Platform): string {
    if (platform === 'max') {
      return normalizeMaxBotUsername(process.env.MAX_USER_BOT_USERNAME);
    }
    return normalizeTelegramBotUsername(process.env.TELEGRAM_USER_BOT_USERNAME, 'vgulbot');
  }

  /** Платформа QR из query (?platform=max|telegram), по умолчанию telegram. */
  private parseQrPlatform(req: Request): Platform {
    return req.query.platform === 'max' ? 'max' : 'telegram';
  }

  /**
   * GET /api/admin/votes/sessions
   * Получить все сессии голосования
   */
  async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isActive = req.query.isActive === 'true';

      let sessions;
      if (isActive) {
        const session = await this.voteService.getActiveSession();
        sessions = session ? [session] : [];
      } else {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const result = await this.voteService.getSessionHistory(page, limit);
        sessions = result.sessions;
      }

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/votes/sessions/:id
   * Получить сессию с результатами
   */
  async getSessionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const session = await this.voteService.getSessionById(id);
      if (!session) {
        res.status(404).json({
          success: false,
          error: { message: 'Session not found', code: 'NOT_FOUND' },
        });
        return;
      }

      const results = await this.voteService.getResults(id);

      res.json({
        success: true,
        data: {
          session,
          results: results.songs,
          // В активной сессии голоса ещё есть в таблице Vote — берём актуальный totalVotes.
          // В завершённой сессии Vote удаляются (архитектурно), поэтому используем session.totalVoters.
          totalVoters: session.isActive ? results.totalVotes : session.totalVoters,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/votes/sessions/start
   * Запустить новую сессию голосования
   */
  async startSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { songIds } = req.body as StartSessionDto;
      const session = await this.voteService.startSession(songIds);

      // Рассылаем событие через Socket.io
      const socketServer = getSocketServer();
      if (socketServer) {
        socketServer.broadcastSessionStarted({
          id: session.id,
          startedAt: session.startedAt,
        });
      }

      logger.info('Voting session started by admin', {
        sessionId: session.id,
        adminId: req.user?.userId,
        songIds,
      });

      // Генерируем QR-код и deep link для сессии
      // QR ведёт на t.me/bot?start=vote_SESSION — пользователь сначала попадает в бота,
      // бот сохраняет sessionId в Redis и отправляет web_app кнопку,
      // Mini App проверяет pending session и открывает голосование
      const botUsername = this.getVotingBotUsername('telegram');
      const qrData = await generateVotingSessionQR(session.id, botUsername);

      res.status(201).json({
        success: true,
        data: {
          session,
          qrCode: {
            dataURL: qrData.qrCodeDataURL,
            deepLink: qrData.deepLink,
            platform: 'telegram' as Platform,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/votes/sessions/:id/qr
   * Получить QR-код для сессии
   */
  async getSessionQR(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const session = await this.voteService.getSessionById(id);
      if (!session) {
        res.status(404).json({
          success: false,
          error: { message: 'Session not found', code: 'NOT_FOUND' },
        });
        return;
      }

      // QR ведёт на бота выбранной платформы:
      //   telegram → t.me/bot?start=vote_SESSION, max → max.ru/bot?start=vote_SESSION
      const platform = this.parseQrPlatform(req);
      const botUsername = this.getVotingBotUsername(platform);
      if (!botUsername) {
        // Например, Max выбран, но MAX_USER_BOT_USERNAME не задан — QR был бы битым.
        res.status(422).json({
          success: false,
          error: {
            message: `Bot username for platform "${platform}" is not configured`,
            code: 'BOT_USERNAME_NOT_CONFIGURED',
          },
        });
        return;
      }
      const qrData = await generateVotingSessionQRForPlatforms(session.id, platform, botUsername);

      res.json({
        success: true,
        data: {
          qrCode: {
            dataURL: qrData.qrCodeDataURL,
            deepLink: qrData.deepLink,
            platform,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/votes/sessions/:id/end
   * Завершить сессию голосования
   */
  async endSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.voteService.endSession(id);

      // Рассылаем событие через Socket.io
      const socketServer = getSocketServer();
      if (socketServer) {
        socketServer.broadcastSessionEnded({
          sessionId: id,
          results: result.finalResultsSnapshot.songs,
          totalVoters: result.totalVoters,
          winningSong: result.winningSong,
        });
      }

      // Уведомления проголосовавшим через бота (fire-and-forget).
      // Получатели несут платформу — BotManager фан-аутит по платформам.
      const botManager = getBotManager();
      if (botManager && result.winningSong && result.voters.length > 0) {
        void botManager
          .notifyVotingWinner(result.voters, result.winningSong, id)
          .catch((err: unknown) => logger.error('Failed to notify voters', { err, sessionId: id }));
      }

      const adminUser = req.user;
      const adminId = adminUser ? adminUser.userId : undefined;
      logger.info('Voting session ended by admin', {
        sessionId: id,
        adminId,
        totalVoters: result.totalVoters,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/votes/sessions/:id/qr/send-to-admins
   * Отправить QR-код сессии админам всех зарегистрированных платформ.
   * Каждой платформе шлётся СВОЙ QR (t.me / max.ru) — фан-аут в BotManager.
   */
  async sendSessionQRToAdmins(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const session = await this.voteService.getSessionById(id);
      if (!session) {
        res.status(404).json({
          success: false,
          error: { message: 'Session not found', code: 'NOT_FOUND' },
        });
        return;
      }

      const botManager = getBotManager();
      if (!botManager) {
        res.status(503).json({
          success: false,
          error: { message: 'Bot manager is not initialized', code: 'ADMIN_BOT_UNAVAILABLE' },
        });
        return;
      }

      await botManager.notifyVotingQrToAdmins(session.id, req.user?.userId);

      res.json({
        success: true,
        data: { sent: true },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/votes/stats
   * Получить статистику голосования
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.query.sessionId as string | undefined;
      const results = await this.voteService.getResults(sessionId);

      if (!sessionId) {
        const session = await this.voteService.getActiveSession();
        if (!session) {
          res.json({
            success: true,
            data: {
              totalVotes: 0,
              activeSongs: 0,
              totalVoters: 0,
              results: [],
            },
          });
          return;
        }
      }

      const session = sessionId
        ? await this.voteService.getSessionById(sessionId)
        : await this.voteService.getActiveSession();

      const totalVoters = session?.isActive ? results.totalVotes : session?.totalVoters || 0;

      res.json({
        success: true,
        data: {
          totalVotes: results.totalVotes,
          activeSongs: results.songs.length,
          totalVoters,
          results: results.songs,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/votes/history
   * Получить историю сессий
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.voteService.getSessionHistory(page, limit);

      res.json({
        success: true,
        data: {
          sessions: result.sessions.map((s) => ({
            id: s.id,
            startedAt: s.startedAt,
            endedAt: s.endedAt,
            totalVoters: s.totalVoters,
          })),
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
