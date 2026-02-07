import { IBookingRepository, CreateBookingData, BookingWithUserAndFormat } from '../../infrastructure/database/repositories/BookingRepository';
import { IBlockedDateRepository } from '../../infrastructure/database/repositories/BlockedDateRepository';
import { IUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { IFormatRepository } from '../../infrastructure/database/repositories/FormatRepository';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import { CacheService, CACHE_KEYS } from '../../shared/utils/cache';
import { CACHE_TTL } from '../../shared/constants';
import { getTodayDateString, formatDateInTimezone } from '../../shared/utils/timezone';

export class BookingService {
  constructor(
    private bookingRepository: IBookingRepository,
    private blockedDateRepository: IBlockedDateRepository,
    private userRepository: IUserRepository,
    private formatRepository?: IFormatRepository
  ) {}

  /**
   * Создание бронирования
   */
  async createBooking(data: CreateBookingData): Promise<BookingWithUserAndFormat> {
    // Проверяем пользователя
    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Проверяем, не заблокирована ли дата
    const isBlocked = await this.blockedDateRepository.isDateBlocked(data.bookingDate);
    if (isBlocked) {
      throw new ValidationError('This date is blocked for booking');
    }

    const booking = await this.bookingRepository.create(data);

    // Инвалидация кешей: доступные даты и календарь админки
    const bookingMonth = `${data.bookingDate.getFullYear()}-${String(data.bookingDate.getMonth() + 1).padStart(2, '0')}`;
    await CacheService.invalidate(CACHE_KEYS.AVAILABLE_DATES(bookingMonth));
    await CacheService.invalidate(CACHE_KEYS.ADMIN_CALENDAR(bookingMonth));

    logger.info('Booking created', {
      bookingId: booking.id,
      userId: data.userId,
      date: data.bookingDate,
    });

    const withRelations = await this.bookingRepository.findById(booking.id);
    if (!withRelations) throw new NotFoundError('Booking');
    return withRelations as BookingWithUserAndFormat;
  }

  /**
   * Получение доступных дат для бронирования (с кешированием в Redis, TTL 5 мин).
   * formats не загружаются — в ответе только dates и blockedDates.
   */
  async getAvailableDates(_formatId?: string, month?: string): Promise<{
    dates: string[];
    blockedDates: string[];
  }> {
    const todayStr = getTodayDateString();

    if (month) {
      const match = month.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
      if (!match) {
        throw new ValidationError('Invalid month format. Expected: YYYY-MM');
      }
    }

    const cacheMonth = month ?? todayStr.slice(0, 7);
    const cacheKey = CACHE_KEYS.AVAILABLE_DATES(cacheMonth);

    return CacheService.getOrSet(
      cacheKey,
      () => this.computeAvailableDates(cacheMonth, todayStr),
      CACHE_TTL.AVAILABLE_DATES
    );
  }

  /**
   * Внутренний расчёт доступных дат (без кеша).
   * Граница «сегодня» — в поясе приложения (Челябинск).
   */
  private async computeAvailableDates(
    cacheMonth: string,
    todayStr: string
  ): Promise<{ dates: string[]; blockedDates: string[] }> {
    const formatDate = (d: Date) => formatDateInTimezone(d);

    const [year, monthNum] = cacheMonth.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);

    const blockedDates = await this.blockedDateRepository.getBlockedDatesInRange(startDate, endDate);
    const blockedDatesStr = blockedDates.map((d) => formatDate(d));
    const blockedSet = new Set(blockedDatesStr);

    const allDates: string[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = formatDate(current);
      if (dateStr >= todayStr) {
        allDates.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }

    const availableDates = allDates.filter((dateStr) => !blockedSet.has(dateStr));

    return {
      dates: availableDates,
      blockedDates: blockedDatesStr,
    };
  }

  /**
   * Получение бронирований пользователя
   */
  async getUserBookings(userId: string) {
    return this.bookingRepository.findByUserId(userId);
  }

  /**
   * Получение бронирования по ID
   */
  async getBookingById(id: string) {
    const booking = await this.bookingRepository.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking');
    }
    return booking;
  }

  /**
   * Обновление статуса бронирования
   */
  async updateBookingStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<BookingWithUserAndFormat> {
    await this.getBookingById(id);
    await this.bookingRepository.updateStatus(id, status);
    const updated = await this.getBookingById(id);
    const bookingDate = (updated as BookingWithUserAndFormat).bookingDate;
    const date = bookingDate instanceof Date ? bookingDate : new Date(bookingDate);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    await CacheService.invalidate(CACHE_KEYS.ADMIN_CALENDAR(month));
    return updated as BookingWithUserAndFormat;
  }

  /**
   * Обновление дохода бронирования
   */
  async updateBookingIncome(id: string, income: number): Promise<BookingWithUserAndFormat> {
    if (income < 0) {
      throw new ValidationError('Income cannot be negative');
    }

    const booking = await this.getBookingById(id);
    await this.bookingRepository.updateIncome(id, income);
    const bookingDate = booking.bookingDate instanceof Date ? booking.bookingDate : new Date(booking.bookingDate);
    const month = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
    await CacheService.invalidate(CACHE_KEYS.ADMIN_CALENDAR(month));

    const updated = await this.getBookingById(id);
    return updated as BookingWithUserAndFormat;
  }

  /**
   * Удаление заявки (например, спам)
   */
  async deleteBooking(id: string): Promise<void> {
    const booking = await this.getBookingById(id);
    await this.bookingRepository.delete(id);

    // Инвалидация кешей: доступные даты и календарь админки
    const bookingDate = booking.bookingDate instanceof Date ? booking.bookingDate : new Date(booking.bookingDate);
    const month = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
    await CacheService.invalidate(CACHE_KEYS.AVAILABLE_DATES(month));
    await CacheService.invalidate(CACHE_KEYS.ADMIN_CALENDAR(month));

    logger.info('Booking deleted by admin', { bookingId: id });
  }

  /**
   * Получение статистики бронирований
   */
  async getStats() {
    return this.bookingRepository.getStats();
  }

  /**
   * Получение всех бронирований с фильтрами (для админа)
   */
  async getAllBookings(options?: {
    date?: string;
    status?: 'pending' | 'confirmed' | 'cancelled';
    page?: number;
    limit?: number;
  }) {
    const findOptions: {
      date?: Date;
      status?: 'pending' | 'confirmed' | 'cancelled';
      page?: number;
      limit?: number;
    } = {
      page: options?.page || 1,
      limit: options?.limit || 50,
    };

    if (options?.date) {
      findOptions.date = new Date(options.date);
    }

    if (options?.status) {
      findOptions.status = options.status;
    }

    return this.bookingRepository.findAll(findOptions);
  }

  /**
   * Блокировка даты для бронирования
   */
  async blockDate(date: string, reason?: string) {
    const blockedDate = new Date(date);
    blockedDate.setHours(0, 0, 0, 0);

    // Проверяем, не заблокирована ли уже
    const existing = await this.blockedDateRepository.findByDate(blockedDate);
    if (existing) {
      throw new ConflictError('Date is already blocked');
    }

    const created = await this.blockedDateRepository.create({
      blockedDate,
      reason,
    });

    // Инвалидация кешей: заблокированные даты и доступные даты
    const month = `${blockedDate.getFullYear()}-${String(blockedDate.getMonth() + 1).padStart(2, '0')}`;
    await CacheService.invalidate(CACHE_KEYS.BLOCKED_DATES(month));
    await CacheService.invalidate(CACHE_KEYS.BLOCKED_DATES());
    await CacheService.invalidate(CACHE_KEYS.AVAILABLE_DATES(month));

    return created;
  }

  /**
   * Список заблокированных дат за месяц (для админки)
   */
  async getBlockedDates(month?: string) {
    const todayStr = getTodayDateString();

    let startDate: Date;
    let endDate: Date;

    if (month) {
      const match = month.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
      if (!match) {
        throw new ValidationError('Invalid month format. Expected: YYYY-MM');
      }
      const [, yearStr, monthStr] = match;
      const year = Number(yearStr);
      const monthNum = Number(monthStr);
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 0);
    } else {
      const [y, m] = todayStr.slice(0, 7).split('-').map(Number);
      startDate = new Date(y, m - 1, 1);
      endDate = new Date(y, m, 0);
    }

    return this.blockedDateRepository.findInRange(startDate, endDate);
  }

  /**
   * Разблокировка даты
   */
  async unblockDate(id: string) {
    const blocked = await this.blockedDateRepository.findById(id);
    if (!blocked) {
      throw new NotFoundError('Blocked date');
    }

    await this.blockedDateRepository.delete(id);

    // Инвалидация кешей: заблокированные даты и доступные даты
    const month = `${blocked.blockedDate.getFullYear()}-${String(blocked.blockedDate.getMonth() + 1).padStart(2, '0')}`;
    await CacheService.invalidate(CACHE_KEYS.BLOCKED_DATES(month));
    await CacheService.invalidate(CACHE_KEYS.BLOCKED_DATES());
    await CacheService.invalidate(CACHE_KEYS.AVAILABLE_DATES(month));
  }

  /**
   * Получение календаря бронирований (для админа). С кешированием в Redis (TTL 2 мин).
   */
  async getCalendar(month?: string) {
    const todayStr = getTodayDateString();

    let startDate: Date;
    let endDate: Date;
    let cacheMonth: string;

    if (month) {
      const match = month.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
      if (!match) {
        throw new ValidationError('Invalid month format. Expected: YYYY-MM');
      }
      const [, yearStr, monthStr] = match;
      const year = Number(yearStr);
      const monthNum = Number(monthStr);
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 0);
      cacheMonth = month;
    } else {
      const [y, m] = todayStr.slice(0, 7).split('-').map(Number);
      startDate = new Date(y, m - 1, 1);
      endDate = new Date(y, m, 0);
      cacheMonth = todayStr.slice(0, 7);
    }

    const cacheKey = CACHE_KEYS.ADMIN_CALENDAR(cacheMonth);
    return CacheService.getOrSet(
      cacheKey,
      () => this.computeCalendar(startDate, endDate),
      CACHE_TTL.ADMIN_CALENDAR
    );
  }

  /**
   * Внутренний расчёт календаря за месяц (без кеша).
   */
  private async computeCalendar(
    startDate: Date,
    endDate: Date
  ): Promise<{ dates: Array<{ date: string; bookings: Awaited<ReturnType<IBookingRepository['findByDateRange']>> }> }> {
    const bookings = await this.bookingRepository.findByDateRange(startDate, endDate);

    const bookingsByDate = new Map<string, typeof bookings>();
    bookings.forEach((booking) => {
      const dateStr = formatDateInTimezone(booking.bookingDate);
      if (!bookingsByDate.has(dateStr)) {
        bookingsByDate.set(dateStr, []);
      }
      bookingsByDate.get(dateStr)!.push(booking);
    });

    const dates: Array<{ date: string; bookings: typeof bookings }> = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = formatDateInTimezone(current);
      dates.push({
        date: dateStr,
        bookings: bookingsByDate.get(dateStr) || [],
      });
      current.setDate(current.getDate() + 1);
    }

    return { dates };
  }
}
