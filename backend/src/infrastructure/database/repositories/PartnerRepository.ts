import { PrismaClient, Partner } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IPartnerRepository {
  findAll(): Promise<Partner[]>;
  findById(id: string): Promise<Partner | null>;
  create(data: CreatePartnerData): Promise<Partner>;
  update(id: string, data: UpdatePartnerData): Promise<Partner>;
  updateOrder(id: string, order: number): Promise<Partner>;
  count(): Promise<number>;
  delete(id: string): Promise<void>;
}

export interface CreatePartnerData {
  name: string;
  logoUrl?: string;
  link?: string;
  order?: number;
}

export interface UpdatePartnerData {
  name?: string;
  logoUrl?: string;
  link?: string;
  order?: number;
}

export class PrismaPartnerRepository implements IPartnerRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<Partner[]> {
    return this.client.partner.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async findById(id: string): Promise<Partner | null> {
    return this.client.partner.findUnique({
      where: { id },
    });
  }

  async create(data: CreatePartnerData): Promise<Partner> {
    return this.client.partner.create({
      data: {
        name: data.name,
        logoUrl: data.logoUrl,
        link: data.link,
        order: data.order ?? 0,
      },
    });
  }

  async update(id: string, data: UpdatePartnerData): Promise<Partner> {
    return this.client.partner.update({
      where: { id },
      data: {
        name: data.name,
        logoUrl: data.logoUrl,
        link: data.link,
        order: data.order,
      },
    });
  }

  async updateOrder(id: string, order: number): Promise<Partner> {
    return this.client.partner.update({
      where: { id },
      data: { order },
    });
  }

  async count(): Promise<number> {
    return this.client.partner.count();
  }

  async delete(id: string): Promise<void> {
    await this.client.partner.delete({
      where: { id },
    });
  }
}
