import { Request, Response, NextFunction } from 'express';
import { FormatService } from '../../domain/services/FormatService';
import { CreateFormatDto, UpdateFormatDto } from '../../application/dto/format.dto';
import { logger } from '../../shared/utils/logger';

export class AdminFormatController {
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

  async createFormat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreateFormatDto;
      const format = await this.formatService.createFormat(data);

      logger.info('Format created by admin', {
        formatId: format.id,
        adminId: req.user?.userId,
      });

      res.status(201).json({
        success: true,
        data: format,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateFormat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateFormatDto;
      const format = await this.formatService.updateFormat(id, data);

      res.json({
        success: true,
        data: format,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteFormat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await this.formatService.deleteFormat(id);

      res.json({
        success: true,
        message: 'Format deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
