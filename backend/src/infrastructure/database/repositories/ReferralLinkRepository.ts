import { PrismaClient, ReferralLink } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IReferralLinkRepository {
  findByAgentId(agentId: string): Promise<ReferralLink[]>;
  findById(id: string): Promise<ReferralLink | null>;
  findByLinkCode(linkCode: string): Promise<ReferralLink | null>;
  create(data: CreateReferralLinkData): Promise<ReferralLink>;
  update(id: string, data: UpdateReferralLinkData): Promise<ReferralLink>;
  delete(id: string): Promise<void>;
  incrementClickCount(id: string): Promise<ReferralLink>;
  incrementConversionCount(id: string): Promise<ReferralLink>;
}

export interface CreateReferralLinkData {
  agentId: string;
  linkCode: string;
  name?: string;
  expiresAt?: Date;
}

export interface UpdateReferralLinkData {
  name?: string;
  isActive?: boolean;
  expiresAt?: Date | null;
}

export class PrismaReferralLinkRepository implements IReferralLinkRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findByAgentId(agentId: string): Promise<ReferralLink[]> {
    return this.client.referralLink.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<ReferralLink | null> {
    return this.client.referralLink.findUnique({
      where: { id },
      include: {
        agent: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async findByLinkCode(linkCode: string): Promise<ReferralLink | null> {
    return this.client.referralLink.findUnique({
      where: { linkCode },
      include: {
        agent: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async create(data: CreateReferralLinkData): Promise<ReferralLink> {
    return this.client.referralLink.create({
      data: {
        agentId: data.agentId,
        linkCode: data.linkCode,
        name: data.name,
        expiresAt: data.expiresAt,
      },
      include: {
        agent: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateReferralLinkData): Promise<ReferralLink> {
    return this.client.referralLink.update({
      where: { id },
      data: {
        name: data.name,
        isActive: data.isActive,
        expiresAt: data.expiresAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.referralLink.delete({
      where: { id },
    });
  }

  async incrementClickCount(id: string): Promise<ReferralLink> {
    return this.client.referralLink.update({
      where: { id },
      data: {
        clickCount: {
          increment: 1,
        },
      },
    });
  }

  async incrementConversionCount(id: string): Promise<ReferralLink> {
    return this.client.referralLink.update({
      where: { id },
      data: {
        conversionCount: {
          increment: 1,
        },
      },
    });
  }
}
