import { IBookingRepository, CreateBookingData } from '../../infrastructure/database/repositories/BookingRepository';
import { IBlockedDateRepository } from '../../infrastructure/database/repositories/BlockedDateRepository';
import { IUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { IFormatRepository } from '../../infrastructure/database/repositories/FormatRepository';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import { CacheService, CACHE_KEYS } from '../../shared/utils/cache';
import { CACHE_TTL } from '../../shared/constants';

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
  async createBooking(data: CreateBookingData): Promise<ReturnType<IBookingRepository['create']>> {
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

    // Создаем бронирование
    const booking = await this.bookingRepository.create(data);

    // Инвалидация кеша доступных дат (при создании бронирования)
    const bookingMonth = `${data.bookingDate.getFullYear()}-${String(data.bookingDate.getMonth() + 1).padStart(2, '0')}`;
    await CacheService.invalidate(CACHE_KEYS.AVAILABLE_DATES(bookingMonth));

    logger.info('Booking created', {
      bookingId: booking.id,
      userId: data.userId,
      date: data.bookingDate,
    });

    return booking;
  }

  /**
   * Получение доступных дат для бронирования (с кешированием в Redis, TTL 5 мин).
   * formats не загружаются — в ответе только dates и blockedDates.
   */
  async getAvailableDates(formatId?: string, month?: string): Promise<{
    dates: string[];
    blockedDates: string[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Валидация month: только YYYY-MM, иначе ValidationError
    if (month) {
      const match = month.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
      if (!match) {
        throw new ValidationError('Invalid month format. Expected: YYYY-MM');
      }
    }

    const cacheMonth =
      month ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const cacheKey = CACHE_KEYS.AVAILABLE_DATES(cacheMonth);

    return CacheService.getOrSet(
      cacheKey,
      () => this.computeAvailableDates(cacheMonth, today),
      CACHE_TTL.AVAILABLE_DATES
    );
  }

  /**
   * Внутренний расчёт доступных дат (без кеша).
   * Заблокированные даты — через Set для O(1) lookup вместо O(n) includes.
   */
  private async computeAvailableDates(
    cacheMonth: string,
    today: Date
  ): Promise<{ dates: string[]; blockedDates: string[] }> {
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    let startDate: Date;
    let endDate: Date;

    if (cacheMonth) {
      const [year, monthNum] = cacheMonth.split('-').map(Number);
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 0);
    } else {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    // Загружаем заблокированные даты один раз из БД
    const blockedDates = await this.blockedDateRepository.getBlockedDatesInRange(startDate, endDate);
    const blockedDatesStr = blockedDates.map((d) => formatDate(d));
    const blockedSet = new Set(blockedDatesStr);

    // Все даты месяца (не прошедшие)
    const allDates: string[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      if (current >= today) {
        allDates.push(formatDate(current));
      }
      current.setDate(current.getDate() + 1);
    }

    // O(1) проверка на блокировку вместо O(n) includes
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
  async updateBookingStatus(id: string, status: 'confirmed' | 'cancelled') {
    const booking = await this.getBookingById(id);
    return this.bookingRepository.updateStatus(id, status);
  }

  /**
   * Обновление дохода бронирования
   */
  async updateBookingIncome(id: string, income: number) {
    if (income < 0) {
      throw new ValidationError('Income cannot be negative');
    }

    await this.getBookingById(id);
    return this.bookingRepository.updateIncome(id, income);
  }

  /**
   * Удаление заявки (например, спам)
   */
  async deleteBooking(id: string): Promise<void> {
    const booking = await this.getBookingById(id);
    await this.bookingRepository.delete(id);

    // Инвалидация кеша доступных дат
    const bookingDate = booking.bookingDate instanceof Date ? booking.bookingDate : new Date(booking.bookingDate);
    const month = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`;
    await CacheService.invalidate(CACHE_KEYS.AVAILABLE_DATES(month));

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
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
   * Получение календаря бронирований (для админа).
   * formats загружаются один раз вне цикла по датам.
   */
  async getCalendar(month?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    // Получаем все бронирования за месяц
    const bookings = await this.bookingRepository.findByDateRange(startDate, endDate);

    // Получаем все форматы
    const formats = this.formatRepository ? await this.formatRepository.findAll() : [];

    // Группируем бронирования по датам
    const bookingsByDate = new Map<string, typeof bookings>();
    bookings.forEach((booking) => {
      const dateStr = booking.bookingDate.toISOString().split('T')[0];
      if (!bookingsByDate.has(dateStr)) {
        bookingsByDate.set(dateStr, []);
      }
      bookingsByDate.get(dateStr)!.push(booking);
    });

    // Формируем результат
    const dates: Array<{
      date: string;
      bookings: typeof bookings;
      formats: typeof formats;
    }> = [];

    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      dates.push({
        date: dateStr,
        bookings: bookingsByDate.get(dateStr) || [],
        formats,
      });
      current.setDate(current.getDate() + 1);
    }

    return { dates };
  }
}
