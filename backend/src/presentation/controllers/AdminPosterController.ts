import { Request, Response, NextFunction } from 'express';
import { PosterService } from '../../domain/services/PosterService';
import { CreatePosterDto, UpdatePosterDto } from '../../application/dto/poster.dto';
import { logger } from '../../shared/utils/logger';

export class AdminPosterController {
  constructor(private posterService: PosterService) {}

  async getAllPosters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const posters = await this.posterService.getAllPosters();
      res.json({
        success: true,
        data: posters,
      });
    } catch (error) {
      next(error);
    }
  }

  async createPoster(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreatePosterDto;
      const poster = await this.posterService.createPoster(data);

      logger.info('Poster created by admin', {
        posterId: poster.id,
        adminId: req.user?.userId,
      });

      res.status(201).json({
        success: true,
        data: poster,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePoster(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdatePosterDto;
      const poster = await this.posterService.updatePoster(id, data);

      res.json({
        success: true,
        data: poster,
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePoster(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await this.posterService.deletePoster(id);

      res.json({
        success: true,
        message: 'Poster deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
