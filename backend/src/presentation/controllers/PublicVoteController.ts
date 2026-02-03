import { Request, Response, NextFunction } from 'express';
import { VoteService } from '../../domain/services/VoteService';
import { SongService } from '../../domain/services/SongService';
import { redis } from '../../config/redis';
import { logger } from '../../shared/utils/logger';

/**
 * Публичный контроллер для страницы голосования в Mini App
 * Не требует авторизации - авторизация происходит через initData на фронте
 */
export class PublicVoteController {
  constructor(
    private voteService: VoteService,
    private songService: SongService
  ) {}

  /**
   * GET /api/public/vote/session/:sessionId
   * Получить информацию о сессии голосования (для публичной страницы).
   * Три состояния: active, ended_with_winner, expired.
   */
  async getSessionInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = await this.voteService.getSessionById(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: { message: 'Session not found', code: 'NOT_FOUND' },
        });
        return;
      }

      // Состояние 1: Активная сессия — голосование идёт
      if (session.isActive) {
        const songs = await this.songService.getActiveSongs();
        const results = await this.voteService.getResults(sessionId);

        res.json({
          success: true,
          data: {
            status: 'active',
            session: { id: session.id, startedAt: session.startedAt, isActive: true },
            songs: songs.map((s) => ({
              id: s.id,
              title: s.title,
              artist: s.artist,
              coverUrl: s.coverUrl,
              isActive: s.isActive,
            })),
            results: { songs: results.songs, totalVotes: results.totalVotes },
          },
        });
        return;
      }

      // Состояние 2: Завершена, но не истекла — показать победителя
      if (session.expiresAt && new Date(session.expiresAt) > new Date()) {
        let winningSong: { id: string; title: string; artist: string; coverUrl: string | null } | null = null;
        if (session.winningSongId) {
          try {
            const song = await this.songService.getSongById(session.winningSongId);
            winningSong = { id: song.id, title: song.title, artist: song.artist, coverUrl: song.coverUrl };
          } catch {
            // Песня удалена или не найдена — оставляем winningSong null
          }
        }

        res.json({
          success: true,
          data: {
            status: 'ended_with_winner',
            session: {
              id: session.id,
              startedAt: session.startedAt,
              endedAt: session.endedAt,
              isActive: false,
            },
            winningSong,
          },
        });
        return;
      }

      // Состояние 3: Истекла — редирект на главную
      res.json({
        success: true,
        data: {
          status: 'expired',
          session: { id: session.id, isActive: false },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/public/vote/active
   * Получить активную сессию голосования
   */
  async getActiveSession(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await this.voteService.getActiveSession();

      if (!session) {
        res.json({
          success: true,
          data: {
            session: null,
            songs: [],
            results: { songs: [], totalVotes: 0 },
          },
        });
        return;
      }

      const songs = await this.songService.getActiveSongs();
      const results = await this.voteService.getResults(session.id);

      res.json({
        success: true,
        data: {
          session: {
            id: session.id,
            startedAt: session.startedAt,
            isActive: session.isActive,
          },
          songs: songs.map((s) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            coverUrl: s.coverUrl,
            isActive: s.isActive,
          })),
          results: {
            songs: results.songs,
            totalVotes: results.totalVotes,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/public/vote/pending/:telegramId
   * Получить pending vote session для пользователя (сохраняется ботом при /start vote_SESSION).
   * Используется для передачи sessionId в Mini App, т.к. web_app кнопка не поддерживает параметры.
   */
  async getPendingSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { telegramId } = req.params;

      if (!telegramId) {
        res.status(400).json({
          success: false,
          error: { message: 'telegramId is required', code: 'BAD_REQUEST' },
        });
        return;
      }

      const redisKey = `pending_vote:${telegramId}`;
      const sessionId = await redis.get(redisKey);

      if (!sessionId) {
        res.json({
          success: true,
          data: { sessionId: null },
        });
        return;
      }

      // Удаляем pending session после получения (one-time use)
      await redis.del(redisKey);

      logger.info('Pending vote session retrieved and cleared', { telegramId, sessionId });

      res.json({
        success: true,
        data: { sessionId },
      });
    } catch (error) {
      next(error);
    }
  }
}
