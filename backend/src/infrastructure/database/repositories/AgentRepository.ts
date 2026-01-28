import { PrismaClient, Agent, AgentStatus } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IAgentRepository {
  findAll(options?: FindAgentsOptions): Promise<Agent[]>;
  findById(id: string): Promise<Agent | null>;
  findByUserId(userId: string): Promise<Agent | null>;
  findByAgentCode(agentCode: string): Promise<Agent | null>;
  create(data: CreateAgentData): Promise<Agent>;
  update(id: string, data: UpdateAgentData): Promise<Agent>;
  updateStatus(id: string, status: AgentStatus): Promise<Agent>;
  incrementReferrals(id: string): Promise<Agent>;
  incrementActiveReferrals(id: string): Promise<Agent>;
}

export interface FindAgentsOptions {
  status?: AgentStatus;
}

export interface CreateAgentData {
  userId: string;
  agentCode: string;
  status?: AgentStatus;
}

export interface UpdateAgentData {
  status?: AgentStatus;
}

export class PrismaAgentRepository implements IAgentRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(options?: FindAgentsOptions): Promise<Agent[]> {
    const where = options?.status ? { status: options.status } : {};

    return this.client.agent.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Agent | null> {
    return this.client.agent.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: string): Promise<Agent | null> {
    return this.client.agent.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findByAgentCode(agentCode: string): Promise<Agent | null> {
    return this.client.agent.findUnique({
      where: { agentCode },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async create(data: CreateAgentData): Promise<Agent> {
    return this.client.agent.create({
      data: {
        userId: data.userId,
        agentCode: data.agentCode,
        status: data.status || 'active',
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateAgentData): Promise<Agent> {
    return this.client.agent.update({
      where: { id },
      data: {
        status: data.status,
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async updateStatus(id: string, status: AgentStatus): Promise<Agent> {
    return this.update(id, { status });
  }

  async incrementReferrals(id: string): Promise<Agent> {
    return this.client.agent.update({
      where: { id },
      data: {
        totalReferrals: {
          increment: 1,
        },
      },
    });
  }

  async incrementActiveReferrals(id: string): Promise<Agent> {
    return this.client.agent.update({
      where: { id },
      data: {
        totalActiveReferrals: {
          increment: 1,
        },
      },
    });
  }
}
