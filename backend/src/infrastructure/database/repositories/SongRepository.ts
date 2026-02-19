import { PrismaClient, Song } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface ISongRepository {
  findAll(options?: FindSongsOptions): Promise<Song[]>;
  findById(id: string): Promise<Song | null>;
  findByIds(ids: string[]): Promise<Song[]>;
  findActive(): Promise<Song[]>;
  create(data: CreateSongData): Promise<Song>;
  update(id: string, data: UpdateSongData): Promise<Song>;
  updateMany(ids: string[], data: UpdateSongData): Promise<void>;
  delete(id: string): Promise<void>;
  toggleActive(id: string): Promise<Song>;
}

export interface FindSongsOptions {
  isActive?: boolean;
  orderBy?: 'createdAt' | 'orderIndex' | 'title';
  orderDirection?: 'asc' | 'desc';
}

export interface CreateSongData {
  title: string;
  artist: string;
  coverUrl?: string;
  artistImageUrl?: string;
  lyrics?: string;
  isActive?: boolean;
  orderIndex?: number;
}

export interface UpdateSongData {
  title?: string;
  artist?: string;
  coverUrl?: string;
  artistImageUrl?: string;
  lyrics?: string;
  isActive?: boolean;
  orderIndex?: number;
}

export class PrismaSongRepository implements ISongRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(options?: FindSongsOptions): Promise<Song[]> {
    const where = options?.isActive !== undefined ? { isActive: options.isActive } : {};

    const orderBy: Record<string, string> = {};
    if (options?.orderBy) {
      orderBy[options.orderBy] = options.orderDirection || 'asc';
    } else {
      orderBy.orderIndex = 'asc';
    }

    return this.client.song.findMany({
      where,
      orderBy,
    });
  }

  async findById(id: string): Promise<Song | null> {
    return this.client.song.findUnique({
      where: { id },
    });
  }

  async findByIds(ids: string[]): Promise<Song[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.client.song.findMany({
      where: {
        id: { in: ids },
      },
    });
  }

  async findActive(): Promise<Song[]> {
    return this.client.song.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async create(data: CreateSongData): Promise<Song> {
    const createData: Record<string, unknown> = {
      title: data.title,
      artist: data.artist,
      isActive: data.isActive || false,
      orderIndex: data.orderIndex || 0,
    };

    if (data.coverUrl !== undefined && data.coverUrl !== '') {
      createData.coverUrl = data.coverUrl;
    }
    if (data.artistImageUrl !== undefined && data.artistImageUrl !== '') {
      createData.artistImageUrl = data.artistImageUrl;
    }
    if (data.lyrics !== undefined) {
      createData.lyrics = data.lyrics;
    }

    return this.client.song.create({
      data: {
        title: data.title,
        artist: data.artist,
        coverUrl: data.coverUrl || undefined,
        artistImageUrl: data.artistImageUrl || undefined,
        lyrics: data.lyrics,
        isActive: data.isActive ?? false,
        orderIndex: data.orderIndex ?? 0,
      },
    });
  }

  async update(id: string, data: UpdateSongData): Promise<Song> {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.artist !== undefined) updateData.artist = data.artist;
    if (data.coverUrl !== undefined) updateData.coverUrl = data.coverUrl;
    if (data.artistImageUrl !== undefined) updateData.artistImageUrl = data.artistImageUrl;
    if (data.lyrics !== undefined) updateData.lyrics = data.lyrics;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;

    return this.client.song.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Batch update множества песен одним запросом
   * Используется для оптимизации N+1 проблем
   */
  async updateMany(ids: string[], data: UpdateSongData): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.artist !== undefined) updateData.artist = data.artist;
    if (data.coverUrl !== undefined) updateData.coverUrl = data.coverUrl;
    if (data.artistImageUrl !== undefined) updateData.artistImageUrl = data.artistImageUrl;
    if (data.lyrics !== undefined) updateData.lyrics = data.lyrics;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;

    await this.client.song.updateMany({
      where: {
        id: { in: ids },
      },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.song.delete({
      where: { id },
    });
  }

  async toggleActive(id: string): Promise<Song> {
    const song = await this.findById(id);
    if (!song) {
      throw new Error('Song not found');
    }

    return this.update(id, { isActive: !song.isActive });
  }
}
