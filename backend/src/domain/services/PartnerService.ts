import { IPartnerRepository } from '../../infrastructure/database/repositories/PartnerRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';

export class PartnerService {
  constructor(private partnerRepository: IPartnerRepository) {}

  async getAllPartners() {
    return this.partnerRepository.findAll();
  }

  async getPartnerById(id: string) {
    const partner = await this.partnerRepository.findById(id);
    if (!partner) {
      throw new NotFoundError('Partner');
    }
    return partner;
  }

  async createPartner(data: { name: string; logoUrl?: string; link?: string }) {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Partner name is required');
    }

    const partner = await this.partnerRepository.create(data);

    logger.info('Partner created', { partnerId: partner.id, name: partner.name });

    return partner;
  }

  async updatePartner(id: string, data: { name?: string; logoUrl?: string; link?: string }) {
    await this.getPartnerById(id);
    return this.partnerRepository.update(id, data);
  }

  async deletePartner(id: string) {
    await this.getPartnerById(id);
    await this.partnerRepository.delete(id);

    logger.info('Partner deleted', { partnerId: id });
  }
}
