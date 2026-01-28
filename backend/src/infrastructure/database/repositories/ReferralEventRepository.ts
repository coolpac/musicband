import { PrismaClient, ReferralEvent, ReferralEventType, ReferralEventStatus } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IReferralEventRepository {
  findAll(options?: FindReferralEventsOptions): Promise<{ events: ReferralEvent[]; total: number }>;
  findById(id: string): Promise<ReferralEvent | null>;
  findByAgentId(agentId: string, options?: FindReferralEventsOptions): Promise<{ events: ReferralEvent[]; total: number }>;
  create(data: CreateReferralEventData): Promise<ReferralEvent>;
  updateStatus(id: string, status: ReferralEventStatus): Promise<ReferralEvent>;
  getStats(agentId: string, startDate?: Date, endDate?: Date): Promise<ReferralEventStats>;
}

export interface FindReferralEventsOptions {
  page?: number;
  limit?: number;
  eventType?: ReferralEventType;
  status?: ReferralEventStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface CreateReferralEventData {
  agentId: string;
  referralLinkId?: string;
  referredUserId?: string;
  eventType: ReferralEventType;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

export interface ReferralEventStats {
  totalClicks: number;
  totalRegistrations: number;
  totalBookings: number;
  totalVotes: number;
  confirmedEvents: number;
  pendingEvents: number;
  rejectedEvents: number;
  conversionRate: number;
}

export class PrismaReferralEventRepository implements IReferralEventRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(options?: FindReferralEventsOptions): Promise<{ events: ReferralEvent[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    const where: {
      eventType?: ReferralEventType;
      status?: ReferralEventStatus;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};
    if (options?.eventType) {
      where.eventType = options.eventType;
    }
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const [events, total] = await Promise.all([
      this.client.referralEvent.findMany({
        where,
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
          referredUser: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          referralLink: {
            select: {
              id: true,
              linkCode: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.client.referralEvent.count({ where }),
    ]);

    return { events, total };
  }

  async findById(id: string): Promise<ReferralEvent | null> {
    return this.client.referralEvent.findUnique({
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
        referredUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        referralLink: {
          select: {
            id: true,
            linkCode: true,
            name: true,
          },
        },
      },
    });
  }

  async findByAgentId(agentId: string, options?: FindReferralEventsOptions): Promise<{ events: ReferralEvent[]; total: number }> {
    return this.findAll({
      ...options,
      // Переопределяем where для фильтрации по agentId
    });
  }

  async create(data: CreateReferralEventData): Promise<ReferralEvent> {
    return this.client.referralEvent.create({
      data: {
        agentId: data.agentId,
        referralLinkId: data.referralLinkId,
        referredUserId: data.referredUserId,
        eventType: data.eventType,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
        status: 'pending',
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
        referredUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        referralLink: {
          select: {
            id: true,
            linkCode: true,
            name: true,
          },
        },
      },
    });
  }

  async updateStatus(id: string, status: ReferralEventStatus): Promise<ReferralEvent> {
    return this.client.referralEvent.update({
      where: { id },
      data: { status },
    });
  }

  async getStats(agentId: string, startDate?: Date, endDate?: Date): Promise<ReferralEventStats> {
    const where: {
      agentId: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = { agentId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const [
      totalClicks,
      totalRegistrations,
      totalBookings,
      totalVotes,
      confirmedEvents,
      pendingEvents,
      rejectedEvents,
    ] = await Promise.all([
      this.client.referralEvent.count({ where: { ...where, eventType: 'click' } }),
      this.client.referralEvent.count({ where: { ...where, eventType: 'registration' } }),
      this.client.referralEvent.count({ where: { ...where, eventType: 'booking' } }),
      this.client.referralEvent.count({ where: { ...where, eventType: 'vote' } }),
      this.client.referralEvent.count({ where: { ...where, status: 'confirmed' } }),
      this.client.referralEvent.count({ where: { ...where, status: 'pending' } }),
      this.client.referralEvent.count({ where: { ...where, status: 'rejected' } }),
    ]);

    const totalEvents = totalClicks + totalRegistrations + totalBookings + totalVotes;
    const conversionRate = totalClicks > 0 ? (totalRegistrations / totalClicks) * 100 : 0;

    return {
      totalClicks,
      totalRegistrations,
      totalBookings,
      totalVotes,
      confirmedEvents,
      pendingEvents,
      rejectedEvents,
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }
}
