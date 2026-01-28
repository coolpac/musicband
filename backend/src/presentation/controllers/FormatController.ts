import { Request, Response, NextFunction } from 'express';
import { FormatService } from '../../domain/services/FormatService';

export class FormatController {
  constructor(private formatService: FormatService) {}

  async getAllFormats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const formats = await this.formatService.getAllFormats();
      res.json({
        success: true,
        data: formats,
      });
    } catch (error) {
      next(error);
    }
  }
}
