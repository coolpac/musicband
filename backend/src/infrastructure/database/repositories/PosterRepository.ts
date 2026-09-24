import { PrismaClient, Poster } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IPosterRepository {
  findAll(): Promise<Poster[]>;
  findActive(): Promise<Poster[]>;
  findById(id: string): Promise<Poster | null>;
  create(data: CreatePosterData): Promise<Poster>;
  update(id: string, data: UpdatePosterData): Promise<Poster>;
  delete(id: string): Promise<void>;
}

export interface CreatePosterData {
  title: string;
  description?: string;
  imageUrl?: string;
  link?: string;
  order?: number;
  /** Дата события (без времени). null — баннер без даты, он не «протухает». */
  eventDate?: Date | null;
  venue?: string | null;
  isActive?: boolean;
}

export interface UpdatePosterData {
  title?: string;
  description?: string;
  imageUrl?: string;
  link?: string;
  order?: number;
  eventDate?: Date | null;
  venue?: string | null;
  isActive?: boolean;
}

export class PrismaPosterRepository implements IPosterRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<Poster[]> {
    return this.client.poster.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /** Только видимые афиши — для публичной выдачи (главная). */
  async findActive(): Promise<Poster[]> {
    return this.client.poster.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findById(id: string): Promise<Poster | null> {
    return this.client.poster.findUnique({
      where: { id },
    });
  }

  async create(data: CreatePosterData): Promise<Poster> {
    return this.client.poster.create({
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        link: data.link,
        order: data.order,
        eventDate: data.eventDate ?? null,
        venue: data.venue ?? null,
        isActive: data.isActive,
      },
    });
  }

  async update(id: string, data: UpdatePosterData): Promise<Poster> {
    return this.client.poster.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        link: data.link,
        order: data.order,
        // undefined — «поле не прислали», null — «очистить»
        ...(data.eventDate !== undefined && { eventDate: data.eventDate }),
        ...(data.venue !== undefined && { venue: data.venue }),
        isActive: data.isActive,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.poster.delete({
      where: { id },
    });
  }
}
