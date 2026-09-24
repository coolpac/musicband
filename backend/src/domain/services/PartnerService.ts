import { IPartnerRepository } from '../../infrastructure/database/repositories/PartnerRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import { invalidatePublicSiteCache } from '../../infrastructure/site/siteCache';

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

  private static readonly MAX_PARTNERS = 9;

  async createPartner(data: { name: string; logoUrl?: string; link?: string; order?: number }) {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Partner name is required');
    }

    const count = await this.partnerRepository.count();
    if (count >= PartnerService.MAX_PARTNERS) {
      throw new ValidationError(`Максимум ${PartnerService.MAX_PARTNERS} партнеров`);
    }

    const partner = await this.partnerRepository.create(data);

    logger.info('Partner created', { partnerId: partner.id, name: partner.name });
    await invalidatePublicSiteCache();

    return partner;
  }

  async updatePartner(
    id: string,
    data: { name?: string; logoUrl?: string; link?: string; order?: number }
  ) {
    await this.getPartnerById(id);
    const partner = await this.partnerRepository.update(id, data);
    await invalidatePublicSiteCache();

    return partner;
  }

  async reorderPartners(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await this.partnerRepository.updateOrder(ids[i], i);
    }
    await invalidatePublicSiteCache();
  }

  async deletePartner(id: string) {
    await this.getPartnerById(id);
    await this.partnerRepository.delete(id);

    logger.info('Partner deleted', { partnerId: id });
    await invalidatePublicSiteCache();
  }
}
