import { ISongRepository, CreateSongData, UpdateSongData } from '../../infrastructure/database/repositories/SongRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import { LIMITS, CACHE_TTL } from '../../shared/constants';
import { CacheService, CACHE_KEYS } from '../../shared/utils/cache';

export class SongService {
  constructor(private songRepository: ISongRepository) {}

  /**
   * Получение всех песен
   */
  async getAllSongs(isActive?: boolean) {
    return this.songRepository.findAll({ isActive });
  }

  /**
   * Получение активных песен (с кешированием)
   */
  async getActiveSongs() {
    return CacheService.getOrSet(
      CACHE_KEYS.ACTIVE_SONGS,
      () => this.songRepository.findActive(),
      CACHE_TTL.ACTIVE_SONGS
    );
  }

  /**
   * Инвалидация кеша активных песен
   */
  private async invalidateActiveSongsCache(): Promise<void> {
    await CacheService.invalidate(CACHE_KEYS.ACTIVE_SONGS);
  }

  /**
   * Получение песни по ID
   */
  async getSongById(id: string) {
    const song = await this.songRepository.findById(id);
    if (!song) {
      throw new NotFoundError('Song');
    }
    return song;
  }

  /**
   * Создание песни
   */
  async createSong(data: CreateSongData) {
    if (!data.title || !data.artist) {
      throw new ValidationError('Title and artist are required');
    }

    const song = await this.songRepository.create(data);
    await this.invalidateActiveSongsCache();

    logger.info('Song created', {
      songId: song.id,
      title: song.title,
    });

    return song;
  }

  /**
   * Обновление песни
   */
  async updateSong(id: string, data: UpdateSongData) {
    await this.getSongById(id);
    const updated = await this.songRepository.update(id, data);
    
    // Инвалидируем кеш если изменилась активность
    if (data.isActive !== undefined) {
      await this.invalidateActiveSongsCache();
    }

    return updated;
  }

  /**
   * Удаление песни
   */
  async deleteSong(id: string) {
    await this.getSongById(id);
    await this.songRepository.delete(id);
    await this.invalidateActiveSongsCache();

    logger.info('Song deleted', { songId: id });
  }

  /**
   * Переключение активности песни
   *
   * ВАЖНО: Кеш инвалидируется ДО изменения, чтобы избежать stale data
   *
   * ПРОБЛЕМА БЫЛА:
   * 1. update БД (песня активна)
   * 2. ... 50ms задержка ...
   * 3. invalidate cache
   * -> Клиенты видели старые данные в течение 50ms!
   *
   * РЕШЕНИЕ:
   * 1. invalidate cache СРАЗУ
   * 2. update БД
   * -> Клиенты либо видят свежие данные из БД, либо кеш пуст (тоже идет в БД)
   */
  async toggleSongActive(id: string) {
    await this.getSongById(id);

    // Проверяем лимит активных песен
    const activeSongs = await this.songRepository.findActive();
    const song = await this.songRepository.findById(id);

    if (!song) {
      throw new NotFoundError('Song');
    }

    // Если активируем и уже достигнут лимит
    if (!song.isActive && activeSongs.length >= LIMITS.MAX_ACTIVE_SONGS) {
      throw new ValidationError(`Maximum ${LIMITS.MAX_ACTIVE_SONGS} active songs allowed`);
    }

    // КРИТИЧНО: Инвалидируем кеш ДО изменения (не после!)
    await this.invalidateActiveSongsCache();

    // Теперь обновляем БД
    const updated = await this.songRepository.toggleActive(id);

    return updated;
  }
}
