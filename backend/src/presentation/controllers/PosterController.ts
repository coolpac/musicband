import { Request, Response, NextFunction } from 'express';
import { PosterService } from '../../domain/services/PosterService';
import { toPosterDto } from '../../application/mappers/poster.mapper';

export class PosterController {
  constructor(private posterService: PosterService) {}

  async getAllPosters(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Публично отдаём только видимые афиши (скрытые в админке сюда не попадают).
      const posters = await this.posterService.getActivePosters();
      res.json({
        success: true,
        data: posters.map(toPosterDto),
      });
    } catch (error) {
      next(error);
    }
  }
}
