import { Request, Response, NextFunction } from 'express';
import { VoteService } from '../../domain/services/VoteService';
import { CastVoteDto } from '../../application/dto/vote.dto';

export class VoteController {
  constructor(private voteService: VoteService) {}

  /**
   * POST /api/votes
   * Проголосовать за песню
   */
  async castVote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const { songId } = req.body as CastVoteDto;
      await this.voteService.castVote(req.user.userId, songId);

      res.json({
        success: true,
        message: 'Vote cast successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/votes/results
   * Получить результаты голосования
   */
  async getResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.query.sessionId as string | undefined;
      const results = await this.voteService.getResults(sessionId);

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/votes/my
   * Получить голос текущего пользователя
   */
  async getMyVote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const result = await this.voteService.getUserVote(req.user.userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
