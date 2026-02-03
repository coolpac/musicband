import { IFormatRepository } from '../../infrastructure/database/repositories/FormatRepository';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';

export class FormatService {
  constructor(private formatRepository: IFormatRepository) {}

  async getAllFormats() {
    return this.formatRepository.findAll();
  }

  /**
   * Форматы, доступные для выбора при бронировании (status = 'available').
   */
  async getFormatsForBooking() {
    try {
      return await this.formatRepository.findAllForBooking();
    } catch (error) {
      // Fallback: если query с фильтром падает, используем полный список и фильтруем в памяти
      logger.error('Failed to load formats for booking, falling back to all formats', { error });
      const formats = await this.formatRepository.findAll();
      return formats.filter((format) => format.status === 'available');
    }
  }

  async getFormatById(id: string) {
    const format = await this.formatRepository.findById(id);
    if (!format) {
      throw new NotFoundError('Format');
    }
    return format;
  }

  async createFormat(data: {
    name: string;
    description?: string;
    shortDescription?: string;
    imageUrl?: string;
    suitableFor?: unknown;
    performers?: unknown;
    status?: string;
    order?: number;
  }) {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Format name is required');
    }

    const status = data.status && ['available', 'hidden'].includes(data.status) ? data.status : 'available';

    // Проверяем, не существует ли уже формат с таким именем
    const existing = await this.formatRepository.findByName(data.name);
    if (existing) {
      throw new ConflictError('Format with this name already exists');
    }

    const format = await this.formatRepository.create({
      ...data,
      status,
      order: data.order ?? 0,
    });

    logger.info('Format created', { formatId: format.id, name: format.name });

    return format;
  }

  async updateFormat(
    id: string,
    data: {
      name?: string;
      description?: string;
      shortDescription?: string;
      imageUrl?: string;
      suitableFor?: unknown;
      performers?: unknown;
      status?: string;
      order?: number;
    }
  ) {
    await this.getFormatById(id);

    if (data.name) {
      const existing = await this.formatRepository.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new ConflictError('Format with this name already exists');
      }
    }

    const updateData = { ...data };
    if (data.status !== undefined && !['available', 'hidden'].includes(data.status)) {
      updateData.status = 'available';
    }

    return this.formatRepository.update(id, updateData);
  }

  async deleteFormat(id: string) {
    await this.getFormatById(id);
    await this.formatRepository.delete(id);

    logger.info('Format deleted', { formatId: id });
  }
}
