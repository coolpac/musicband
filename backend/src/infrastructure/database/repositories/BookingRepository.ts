import { PrismaClient, Booking, BookingStatus, User, Format } from '@prisma/client';
import { prisma } from '../../../config/database';

export type BookingWithUserAndFormat = Booking & { user: User; format: Format | null };

export interface FindBookingsOptions {
  date?: Date;
  status?: BookingStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface IBookingRepository {
  findById(id: string): Promise<BookingWithUserAndFormat | null>;
  findByUserId(userId: string): Promise<Booking[]>;
  findByDate(date: Date): Promise<Booking[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<Booking[]>;
  findByStatus(status: BookingStatus): Promise<Booking[]>;
  findAll(options?: FindBookingsOptions): Promise<{ bookings: Booking[]; total: number }>;
  create(data: CreateBookingData): Promise<Booking>;
  update(id: string, data: UpdateBookingData): Promise<Booking>;
  updateStatus(id: string, status: BookingStatus): Promise<Booking>;
  updateIncome(id: string, income: number): Promise<Booking>;
  delete(id: string): Promise<void>;
  getStats(): Promise<BookingStats>;
}

export interface CreateBookingData {
  userId: string;
  formatId?: string;
  bookingDate: Date;
  fullName: string;
  contactType?: string;
  contactValue: string;
  city?: string;
  source?: string;
}

export interface UpdateBookingData {
  formatId?: string;
  bookingDate?: Date;
  fullName?: string;
  contactType?: string;
  contactValue?: string;
  city?: string;
  source?: string;
  status?: BookingStatus;
  income?: number;
}

export interface BookingStats {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  totalIncome: number;
  conversionRate: number;
}

export class PrismaBookingRepository implements IBookingRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findById(id: string): Promise<BookingWithUserAndFormat | null> {
    const row = await this.client.booking.findUnique({
      where: { id },
      include: {
        user: true,
        format: true,
      },
    });
    return row as BookingWithUserAndFormat | null;
  }

  async findByUserId(userId: string): Promise<Booking[]> {
    return this.client.booking.findMany({
      where: { userId },
      include: {
        format: true,
      },
      orderBy: { bookingDate: 'desc' },
    });
  }

  async findByDate(date: Date): Promise<Booking[]> {
    return this.client.booking.findMany({
      where: {
        bookingDate: date,
      },
      include: {
        user: true,
        format: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Booking[]> {
    return this.client.booking.findMany({
      where: {
        bookingDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: true,
        format: true,
      },
      orderBy: { bookingDate: 'asc' },
    });
  }

  async findByStatus(status: BookingStatus): Promise<Booking[]> {
    return this.client.booking.findMany({
      where: { status },
      include: {
        user: true,
        format: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(options?: FindBookingsOptions): Promise<{ bookings: Booking[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    const where: {
      bookingDate?: Date | { gte?: Date; lte?: Date };
      status?: BookingStatus;
    } = {};

    if (options?.date) {
      where.bookingDate = options.date;
    } else if (options?.startDate || options?.endDate) {
      where.bookingDate = {};
      if (options.startDate) {
        where.bookingDate.gte = options.startDate;
      }
      if (options.endDate) {
        where.bookingDate.lte = options.endDate;
      }
    }

    if (options?.status) {
      where.status = options.status;
    }

    const [bookings, total] = await Promise.all([
      this.client.booking.findMany({
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
          format: true,
        },
        orderBy: { bookingDate: 'desc' },
        skip,
        take: limit,
      }),
      this.client.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  async create(data: CreateBookingData): Promise<Booking> {
    return this.client.booking.create({
      data: {
        userId: data.userId,
        formatId: data.formatId,
        bookingDate: data.bookingDate,
        fullName: data.fullName,
        contactType: data.contactType,
        contactValue: data.contactValue,
        city: data.city,
        source: data.source,
        status: 'pending',
      },
      include: {
        user: true,
        format: true,
      },
    });
  }

  async update(id: string, data: UpdateBookingData): Promise<Booking> {
    return this.client.booking.update({
      where: { id },
      data: {
        formatId: data.formatId,
        bookingDate: data.bookingDate,
        fullName: data.fullName,
        contactType: data.contactType,
        contactValue: data.contactValue,
        city: data.city,
        source: data.source,
        status: data.status,
        income: data.income,
      },
      include: {
        user: true,
        format: true,
      },
    });
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    return this.update(id, { status });
  }

  async updateIncome(id: string, income: number): Promise<Booking> {
    return this.update(id, { income });
  }

  async delete(id: string): Promise<void> {
    await this.client.booking.delete({
      where: { id },
    });
  }

  async getStats(): Promise<BookingStats> {
    const [total, confirmed, pending, cancelled, incomeResult] = await Promise.all([
      this.client.booking.count(),
      this.client.booking.count({ where: { status: 'confirmed' } }),
      this.client.booking.count({ where: { status: 'pending' } }),
      this.client.booking.count({ where: { status: 'cancelled' } }),
      this.client.booking.aggregate({
        _sum: {
          income: true,
        },
        where: {
          income: { not: null },
        },
      }),
    ]);

    const totalIncome = incomeResult._sum.income?.toNumber() || 0;
    const conversionRate = total > 0 ? (confirmed / total) * 100 : 0;

    return {
      total,
      confirmed,
      pending,
      cancelled,
      totalIncome,
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }
}
