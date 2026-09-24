import {
  IPosterRepository,
  CreatePosterData,
  UpdatePosterData,
} from '../../infrastructure/database/repositories/PosterRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import { parseDateOnly } from '../../shared/utils/timezone';
import { invalidatePublicSiteCache } from '../../infrastructure/site/siteCache';

/** Афиша редактируется как JSON: дата приходит строкой 'YYYY-MM-DD', пустая строка = очистить. */
export interface PosterInput {
  title?: string;
  description?: string;
  imageUrl?: string;
  link?: string;
  order?: number;
  eventDate?: string | null;
  venue?: string | null;
  isActive?: boolean;
}

/** 'YYYY-MM-DD' → Date, '' / null → null, undefined → undefined (поле не прислали). */
function toEventDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const parsed = parseDateOnly(value);
  if (!parsed) {
    throw new ValidationError('Invalid eventDate. Expected YYYY-MM-DD');
  }
  return parsed;
}

function toVenue(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export class PosterService {
  constructor(private posterRepository: IPosterRepository) {}

  /** Все афиши (включая скрытые) — для админки. */
  async getAllPosters() {
    return this.posterRepository.findAll();
  }

  /** Только видимые афиши — для публичной выдачи (главная). */
  async getActivePosters() {
    return this.posterRepository.findActive();
  }

  async getPosterById(id: string) {
    const poster = await this.posterRepository.findById(id);
    if (!poster) {
      throw new NotFoundError('Poster');
    }
    return poster;
  }

  async createPoster(data: PosterInput & { title: string }) {
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Poster title is required');
    }

    const createData: CreatePosterData = {
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      link: data.link,
      order: data.order,
      eventDate: toEventDate(data.eventDate),
      venue: toVenue(data.venue),
    };

    const poster = await this.posterRepository.create(createData);

    logger.info('Poster created', { posterId: poster.id, title: poster.title });
    await invalidatePublicSiteCache();

    return poster;
  }

  async updatePoster(id: string, data: PosterInput) {
    await this.getPosterById(id);

    const updateData: UpdatePosterData = {
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      link: data.link,
      order: data.order,
      eventDate: toEventDate(data.eventDate),
      venue: toVenue(data.venue),
    };

    const poster = await this.posterRepository.update(id, updateData);
    await invalidatePublicSiteCache();

    return poster;
  }

  /** Переключить видимость афиши (скрыть/показать без удаления). */
  async togglePosterActive(id: string) {
    const poster = await this.getPosterById(id);
    const updated = await this.posterRepository.update(id, { isActive: !poster.isActive });
    logger.info('Poster visibility toggled', { posterId: id, isActive: updated.isActive });
    return updated;
  }

  async deletePoster(id: string) {
    await this.getPosterById(id);
    await this.posterRepository.delete(id);

    logger.info('Poster deleted', { posterId: id });
    await invalidatePublicSiteCache();
  }
}
