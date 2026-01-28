import { PrismaClient, Song } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface ISongRepository {
  findAll(options?: FindSongsOptions): Promise<Song[]>;
  findById(id: string): Promise<Song | null>;
  findActive(): Promise<Song[]>;
  create(data: CreateSongData): Promise<Song>;
  update(id: string, data: UpdateSongData): Promise<Song>;
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
  lyrics?: string;
  isActive?: boolean;
  orderIndex?: number;
}

export interface UpdateSongData {
  title?: string;
  artist?: string;
  coverUrl?: string;
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

  async findActive(): Promise<Song[]> {
    return this.client.song.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async create(data: CreateSongData): Promise<Song> {
    return this.client.song.create({
      data: {
        title: data.title,
        artist: data.artist,
        coverUrl: data.coverUrl,
        lyrics: data.lyrics,
        isActive: data.isActive || false,
        orderIndex: data.orderIndex || 0,
      },
    });
  }

  async update(id: string, data: UpdateSongData): Promise<Song> {
    return this.client.song.update({
      where: { id },
      data: {
        title: data.title,
        artist: data.artist,
        coverUrl: data.coverUrl,
        lyrics: data.lyrics,
        isActive: data.isActive,
        orderIndex: data.orderIndex,
      },
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
