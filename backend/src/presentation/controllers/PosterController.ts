import { Request, Response, NextFunction } from 'express';
import { PosterService } from '../../domain/services/PosterService';

export class PosterController {
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
}
