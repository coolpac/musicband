import { PrismaClient, BlockedDate } from '@prisma/client';
import { prisma } from '../../../config/database';
import { getTodayDateString, formatDateInTimezone, APP_TIMEZONE } from '../../../shared/utils/timezone';

export interface IBlockedDateRepository {
  findAll(): Promise<BlockedDate[]>;
  findById(id: string): Promise<BlockedDate | null>;
  findByDate(date: Date): Promise<BlockedDate | null>;
  isDateBlocked(date: Date): Promise<boolean>;
  create(data: CreateBlockedDateData): Promise<BlockedDate>;
  delete(id: string): Promise<void>;
  getBlockedDatesInRange(startDate: Date, endDate: Date): Promise<Date[]>;
  findInRange(startDate: Date, endDate: Date): Promise<BlockedDate[]>;
}

export interface CreateBlockedDateData {
  blockedDate: Date;
  reason?: string;
}

export class PrismaBlockedDateRepository implements IBlockedDateRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<BlockedDate[]> {
    return this.client.blockedDate.findMany({
      orderBy: { blockedDate: 'asc' },
    });
  }

  async findById(id: string): Promise<BlockedDate | null> {
    return this.client.blockedDate.findUnique({
      where: { id },
    });
  }

  async findByDate(date: Date): Promise<BlockedDate | null> {
    return this.client.blockedDate.findUnique({
      where: {
        blockedDate: date,
      },
    });
  }

  async isDateBlocked(date: Date): Promise<boolean> {
    const todayStr = getTodayDateString(APP_TIMEZONE);
    const checkDateStr = formatDateInTimezone(date, APP_TIMEZONE);
    if (checkDateStr < todayStr) {
      return true; // Прошедшие даты (в поясе приложения) всегда заблокированы
    }

    const blocked = await this.findByDate(date);
    return blocked !== null;
  }

  async create(data: CreateBlockedDateData): Promise<BlockedDate> {
    return this.client.blockedDate.create({
      data: {
        blockedDate: data.blockedDate,
        reason: data.reason,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.blockedDate.delete({
      where: { id },
    });
  }

  async getBlockedDatesInRange(startDate: Date, endDate: Date): Promise<Date[]> {
    const blockedDates = await this.client.blockedDate.findMany({
      where: {
        blockedDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        blockedDate: true,
      },
    });

    return blockedDates.map((bd) => bd.blockedDate);
  }

  /** Полный список заблокированных дат в диапазоне (для админки) */
  async findInRange(startDate: Date, endDate: Date): Promise<BlockedDate[]> {
    return this.client.blockedDate.findMany({
      where: {
        blockedDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { blockedDate: 'asc' },
    });
  }
}
