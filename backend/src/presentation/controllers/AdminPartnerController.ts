import { Request, Response, NextFunction } from 'express';
import { PartnerService } from '../../domain/services/PartnerService';
import {
  CreatePartnerDto,
  UpdatePartnerDto,
  ReorderPartnersDto,
} from '../../application/dto/partner.dto';
import { logger } from '../../shared/utils/logger';

export class AdminPartnerController {
  constructor(private partnerService: PartnerService) {}

  async getAllPartners(_req: Request, res: Response, next: NextFunction): Promise<void> {
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

  async createPartner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreatePartnerDto;
      const partner = await this.partnerService.createPartner(data);

      logger.info('Partner created by admin', {
        partnerId: partner.id,
        adminId: req.user?.userId,
      });

      res.status(201).json({
        success: true,
        data: partner,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePartner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdatePartnerDto;
      const partner = await this.partnerService.updatePartner(id, data);

      res.json({
        success: true,
        data: partner,
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePartner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await this.partnerService.deletePartner(id);

      res.json({
        success: true,
        message: 'Partner deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async reorderPartners(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ids } = req.body as ReorderPartnersDto;
      await this.partnerService.reorderPartners(ids);

      logger.info('Partners reordered by admin', {
        count: ids.length,
        adminId: req.user?.userId,
      });

      res.json({
        success: true,
        message: 'Partners reordered',
      });
    } catch (error) {
      next(error);
    }
  }
}
