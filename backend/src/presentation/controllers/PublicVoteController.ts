import { Request, Response, NextFunction } from 'express';
import { VoteService } from '../../domain/services/VoteService';
import { SongService } from '../../domain/services/SongService';
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
   * Получить информацию о сессии голосования (для публичной страницы)
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

      if (!session.isActive) {
        res.status(400).json({
          success: false,
          error: { message: 'Session is not active', code: 'SESSION_ENDED' },
        });
        return;
      }

      // Получаем песни и результаты
      const songs = await this.songService.getActiveSongs();
      const results = await this.voteService.getResults(sessionId);

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
   * GET /api/public/vote/active
   * Получить активную сессию голосования
   */
  async getActiveSession(req: Request, res: Response, next: NextFunction): Promise<void> {
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
}
