import { PrismaClient, Format } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IFormatRepository {
  findAll(): Promise<Format[]>;
  findById(id: string): Promise<Format | null>;
  findByName(name: string): Promise<Format | null>;
  create(data: CreateFormatData): Promise<Format>;
  update(id: string, data: UpdateFormatData): Promise<Format>;
  delete(id: string): Promise<void>;
}

export interface CreateFormatData {
  name: string;
  description?: string;
}

export interface UpdateFormatData {
  name?: string;
  description?: string;
}

export class PrismaFormatRepository implements IFormatRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<Format[]> {
    return this.client.format.findMany({
      orderBy: { name: 'asc' },
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
      },
    });
  }

  async update(id: string, data: UpdateFormatData): Promise<Format> {
    return this.client.format.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.format.delete({
      where: { id },
    });
  }
}
