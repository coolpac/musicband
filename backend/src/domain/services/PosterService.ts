import { IPosterRepository } from '../../infrastructure/database/repositories/PosterRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';

export class PosterService {
  constructor(private posterRepository: IPosterRepository) {}

  async getAllPosters() {
    return this.posterRepository.findAll();
  }

  async getPosterById(id: string) {
    const poster = await this.posterRepository.findById(id);
    if (!poster) {
      throw new NotFoundError('Poster');
    }
    return poster;
  }

  async createPoster(data: {
    title: string;
    description?: string;
    imageUrl?: string;
    link?: string;
  }) {
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Poster title is required');
    }

    const poster = await this.posterRepository.create(data);

    logger.info('Poster created', { posterId: poster.id, title: poster.title });

    return poster;
  }

  async updatePoster(
    id: string,
    data: { title?: string; description?: string; imageUrl?: string; link?: string }
  ) {
    await this.getPosterById(id);
    return this.posterRepository.update(id, data);
  }

  async deletePoster(id: string) {
    await this.getPosterById(id);
    await this.posterRepository.delete(id);

    logger.info('Poster deleted', { posterId: id });
  }
}
