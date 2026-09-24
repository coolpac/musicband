import { Prisma, PrismaClient, Booking, BookingStatus, User, Format } from '@prisma/client';
import { prisma } from '../../../config/database';
import { formatDateInTimezone } from '../../../shared/utils/timezone';

/** CreateBookingData → Prisma-инпут. */
function toCreateInput(data: CreateBookingData): Prisma.BookingUncheckedCreateInput {
  return {
    userId: data.userId ?? null,
    formatId: data.formatId,
    bookingDate: data.bookingDate,
    bookingTime: data.bookingTime,
    fullName: data.fullName,
    contactType: data.contactType,
    contactValue: data.contactValue,
    email: data.email,
    comment: data.comment,
    city: data.city,
    source: data.source,
    origin: data.origin ?? 'miniapp',
    status: 'pending',
  };
}

/** `user` = null у заявок с публичного сайта: у посетителя нет Telegram-аккаунта. */
export type BookingWithUserAndFormat = Booking & { user: User | null; format: Format | null };

/** Откуда пришла заявка. Колонка `bookings.origin`. */
export type BookingOrigin = 'miniapp' | 'website';

/** Краткая карточка пользователя, которую подтягивает список заявок админки. */
export type BookingListUser = Pick<
  User,
  'id' | 'telegramId' | 'username' | 'firstName' | 'lastName'
>;

/** Строка списка заявок в админке. `user` = null у заявок с сайта. */
export type BookingListItem = Booking & {
  user: BookingListUser | null;
  format: Format | null;
};

export interface FindBookingsOptions {
  date?: Date;
  status?: BookingStatus;
  origin?: BookingOrigin;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * Результат «безопасного» создания заявки: проверка лимита и вставка выполнены
 * в одной транзакции под advisory-локом по дате, поэтому гонок read-then-write нет.
 */
export type GuardedBookingResult =
  | { status: 'created'; booking: Booking; autoBlocked: boolean }
  | { status: 'blocked' }
  | { status: 'full' };

export interface IBookingRepository {
  findById(id: string): Promise<BookingWithUserAndFormat | null>;
  findByUserId(userId: string): Promise<Booking[]>;
  findByDate(date: Date): Promise<Booking[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<Booking[]>;
  findByStatus(status: BookingStatus): Promise<Booking[]>;
  findAll(options?: FindBookingsOptions): Promise<{ bookings: BookingListItem[]; total: number }>;
  createGuarded(
    data: CreateBookingData,
    maxPerDay: number,
    autoBlockReason: string
  ): Promise<GuardedBookingResult>;
  update(id: string, data: UpdateBookingData): Promise<Booking>;
  updateStatus(id: string, status: BookingStatus): Promise<Booking>;
  updateIncome(id: string, income: number): Promise<Booking>;
  delete(id: string): Promise<void>;
  getStats(): Promise<BookingStats>;
}

export interface CreateBookingData {
  /** null/undefined — заявка с сайта (анонимный посетитель) */
  userId?: string | null;
  formatId?: string;
  bookingDate: Date;
  /** Пожелание по времени, HH:mm. Только для заявок с сайта. */
  bookingTime?: string;
  fullName: string;
  contactType?: string;
  contactValue: string;
  email?: string;
  comment?: string;
  city?: string;
  source?: string;
  origin?: BookingOrigin;
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
    return this.client.booking.findUnique({
      where: { id },
      include: {
        user: true,
        format: true,
      },
    });
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
      // Стабильная сортировка: по дате события, а внутри дня — по времени создания
      orderBy: [{ bookingDate: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
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

  async findAll(
    options?: FindBookingsOptions
  ): Promise<{ bookings: BookingListItem[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    const where: {
      bookingDate?: Date | { gte?: Date; lte?: Date };
      status?: BookingStatus;
      origin?: BookingOrigin;
    } = {};

    if (options?.origin) {
      where.origin = options.origin;
    }

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
        orderBy: [{ bookingDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.client.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  /**
   * Создание заявки с проверкой «дата свободна и на ней меньше maxPerDay активных заявок».
   *
   * Проверка и вставка выполняются в одной транзакции под `pg_advisory_xact_lock`
   * по ключу даты: без этого два параллельных запроса на одну дату оба видели бы
   * «1 активная из 2» и создавали бы третью заявку. Лок снимается вместе с транзакцией.
   */
  async createGuarded(
    data: CreateBookingData,
    maxPerDay: number,
    autoBlockReason: string
  ): Promise<GuardedBookingResult> {
    const lockKey = `booking:${formatDateInTimezone(data.bookingDate)}`;

    return this.client.$transaction(async (tx) => {
      // hashtext() → int4, неявно расширяется до bigint-сигнатуры pg_advisory_xact_lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const blocked = await tx.blockedDate.findUnique({
        where: { blockedDate: data.bookingDate },
        select: { id: true },
      });
      if (blocked) {
        return { status: 'blocked' as const };
      }

      const activeCount = await tx.booking.count({
        where: { bookingDate: data.bookingDate, status: { not: 'cancelled' } },
      });
      if (activeCount >= maxPerDay) {
        return { status: 'full' as const };
      }

      const booking = await tx.booking.create({ data: toCreateInput(data) });

      // Лимит исчерпан — сразу закрываем дату, чтобы календарь не показывал её свободной.
      // upsert (а не create) — чтобы конфликт с ручной блокировкой админа не оборвал транзакцию.
      let autoBlocked = false;
      if (activeCount + 1 >= maxPerDay) {
        await tx.blockedDate.upsert({
          where: { blockedDate: data.bookingDate },
          create: { blockedDate: data.bookingDate, reason: autoBlockReason },
          update: {},
        });
        autoBlocked = true;
      }

      return { status: 'created' as const, booking, autoBlocked };
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
