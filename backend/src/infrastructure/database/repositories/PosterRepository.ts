import { PrismaClient, Poster } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IPosterRepository {
  findAll(): Promise<Poster[]>;
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
}

export interface UpdatePosterData {
  title?: string;
  description?: string;
  imageUrl?: string;
  link?: string;
}

export class PrismaPosterRepository implements IPosterRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<Poster[]> {
    return this.client.poster.findMany({
      orderBy: { createdAt: 'desc' },
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
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.poster.delete({
      where: { id },
    });
  }
}
