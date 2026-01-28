import { IFormatRepository } from '../../infrastructure/database/repositories/FormatRepository';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';

export class FormatService {
  constructor(private formatRepository: IFormatRepository) {}

  async getAllFormats() {
    return this.formatRepository.findAll();
  }

  async getFormatById(id: string) {
    const format = await this.formatRepository.findById(id);
    if (!format) {
      throw new NotFoundError('Format');
    }
    return format;
  }

  async createFormat(data: { name: string; description?: string }) {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Format name is required');
    }

    // Проверяем, не существует ли уже формат с таким именем
    const existing = await this.formatRepository.findByName(data.name);
    if (existing) {
      throw new ConflictError('Format with this name already exists');
    }

    const format = await this.formatRepository.create(data);

    logger.info('Format created', { formatId: format.id, name: format.name });

    return format;
  }

  async updateFormat(id: string, data: { name?: string; description?: string }) {
    await this.getFormatById(id);

    // Если меняется имя, проверяем уникальность
    if (data.name) {
      const existing = await this.formatRepository.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new ConflictError('Format with this name already exists');
      }
    }

    return this.formatRepository.update(id, data);
  }

  async deleteFormat(id: string) {
    await this.getFormatById(id);
    await this.formatRepository.delete(id);

    logger.info('Format deleted', { formatId: id });
  }
}
