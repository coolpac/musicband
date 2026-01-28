import { Request, Response, NextFunction } from 'express';
import { PartnerService } from '../../domain/services/PartnerService';

export class PartnerController {
  constructor(private partnerService: PartnerService) {}

  async getAllPartners(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const partners = await this.partnerService.getAllPartners();
      res.json({
        success: true,
        data: partners,
      });
    } catch (error) {
      next(error);
    }
  }
}
