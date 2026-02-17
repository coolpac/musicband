import { Prisma, PrismaClient, Format } from '@prisma/client';
import { prisma } from '../../../config/database';

/** Статусы формата: available — показывать в бронировании, hidden — скрыт */
export type FormatStatus = 'available' | 'hidden';

export interface IFormatRepository {
  findAll(): Promise<Format[]>;
  findAllForBooking(): Promise<Format[]>;
  findById(id: string): Promise<Format | null>;
  findByName(name: string): Promise<Format | null>;
  create(data: CreateFormatData): Promise<Format>;
  update(id: string, data: UpdateFormatData): Promise<Format>;
  delete(id: string): Promise<void>;
}

export interface CreateFormatData {
  name: string;
  description?: string;
  shortDescription?: string;
  imageUrl?: string;
  suitableFor?: unknown;
  performers?: unknown;
  status?: string;
  order?: number;
}

export interface UpdateFormatData {
  name?: string;
  description?: string;
  shortDescription?: string;
  imageUrl?: string;
  suitableFor?: unknown;
  performers?: unknown;
  status?: string;
  order?: number;
}

export class PrismaFormatRepository implements IFormatRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<Format[]> {
    return this.client.format.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async findAllForBooking(): Promise<Format[]> {
    return this.client.format.findMany({
      where: { status: 'available' },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(id: string): Promise<Format | null> {
    return this.client.format.findUnique({
      where: { id },
    });
  }

  async findByName(name: string): Promise<Format | null> {
    return this.client.format.findUnique({
      where: { name },
    });
  }

  async create(data: CreateFormatData): Promise<Format> {
    return this.client.format.create({
      data: {
        name: data.name,
        description: data.description,
        shortDescription: data.shortDescription,
        imageUrl: data.imageUrl,
        suitableFor: data.suitableFor ?? undefined,
        performers: data.performers ?? undefined,
        status: data.status ?? 'available',
        order: data.order ?? 0,
      },
    });
  }

  async update(id: string, data: UpdateFormatData): Promise<Format> {
    return this.client.format.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.shortDescription !== undefined && { shortDescription: data.shortDescription }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.suitableFor !== undefined && {
          suitableFor: data.suitableFor === null ? Prisma.JsonNull : data.suitableFor,
        }),
        ...(data.performers !== undefined && {
          performers: data.performers === null ? Prisma.JsonNull : data.performers,
        }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.format.delete({ where: { id } });
  }
}