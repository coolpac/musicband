import { PrismaClient, Partner } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IPartnerRepository {
  findAll(): Promise<Partner[]>;
  findById(id: string): Promise<Partner | null>;
  create(data: CreatePartnerData): Promise<Partner>;
  update(id: string, data: UpdatePartnerData): Promise<Partner>;
  delete(id: string): Promise<void>;
}

export interface CreatePartnerData {
  name: string;
  logoUrl?: string;
  link?: string;
}

export interface UpdatePartnerData {
  name?: string;
  logoUrl?: string;
  link?: string;
}

export class PrismaPartnerRepository implements IPartnerRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<Partner[]> {
    return this.client.partner.findMany({
      orderBy: { createdAt: 'desc' },
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
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.partner.delete({
      where: { id },
    });
  }
}
