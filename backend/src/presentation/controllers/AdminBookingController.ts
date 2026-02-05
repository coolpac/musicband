import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../../domain/services/BookingService';
import { UpdateBookingStatusDto, UpdateBookingIncomeDto, CompleteBookingDto, BlockDateDto } from '../../application/dto/booking.dto';
import { logger } from '../../shared/utils/logger';
import { getBotManager } from '../../infrastructure/telegram/botManager';
import { ValidationError } from '../../shared/errors';
import { formatDateInTimezone } from '../../shared/utils/timezone';

export class AdminBookingController {
  constructor(private bookingService: BookingService) {}

  /**
   * GET /api/admin/bookings
   * Получить все бронирования с фильтрами
   */
  async getAllBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = req.query.date as string | undefined;
      const status = req.query.status as 'pending' | 'confirmed' | 'cancelled' | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await this.bookingService.getAllBookings({
        date,
        status,
        page,
        limit,
      });

      res.json({
        success: true,
        data: {
          bookings: result.bookings,
          total: result.total,
          page,
          limit,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/bookings/stats
   * Получить статистику бронирований
   */
  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.bookingService.getStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/bookings/:id/status
   * Обновить статус бронирования
   */
  async updateBookingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body as UpdateBookingStatusDto;

      const booking = await this.bookingService.updateBookingStatus(id, status);

      logger.info('Booking status updated by admin', {
        bookingId: id,
        status,
        adminId: req.user?.userId,
      });

      // Отправляем уведомление пользователю при подтверждении
      if (status === 'confirmed') {
        const botManager = getBotManager();
        if (botManager && booking.user) {
          await botManager.notifyBookingConfirmed({
            bookingId: booking.id,
            bookingDate: formatDateInTimezone(booking.bookingDate),
            formatName: booking.format?.name || 'Не указан',
            fullName: booking.fullName,
            contactValue: booking.contactValue,
          });
        }
      }

      res.json({
        success: true,
        data: { booking },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/bookings/:id/income
   * Обновить доход от бронирования
   */
  async updateBookingIncome(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { income } = req.body as UpdateBookingIncomeDto;

      const booking = await this.bookingService.updateBookingIncome(id, income);

      logger.info('Booking income updated by admin', {
        bookingId: id,
        income,
        adminId: req.user?.userId,
      });

      res.json({
        success: true,
        data: { booking },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/bookings/:id/complete
   * Отметить заявку как выполненную: записать доход и отправить пользователю кнопку «Оставить отзыв».
   */
  async completeBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { income } = req.body as CompleteBookingDto;

      const booking = await this.bookingService.getBookingById(id);
      if (booking.status !== 'confirmed') {
        throw new ValidationError('Booking must be confirmed before completing');
      }

      const updated = await this.bookingService.updateBookingIncome(id, income);

      logger.info('Booking completed by admin', {
        bookingId: id,
        income,
        adminId: req.user?.userId,
      });

      const botManager = getBotManager();
      // Отправляем запрос отзыва при "Выполнено" (включая повторную отправку, если нужно).
      // Важно: сообщение отправляет UserBot — пользователь должен иметь диалог с ботом.
      if (botManager && (updated as any).user?.telegramId) {
        const userTelegramId = (updated as any).user.telegramId;
        const userBot = botManager.getUserBot();
        if (userBot) {
          await userBot.sendReviewRequest(userTelegramId.toString(), {
            bookingId: updated.id,
            bookingDate: formatDateInTimezone(updated.bookingDate),
            formatName: (updated as any).format?.name ?? undefined,
            fullName: (updated as any).fullName ?? '',
          });
        } else {
          logger.warn('UserBot not initialized, review request not sent', {
            bookingId: id,
            telegramId: userTelegramId?.toString?.() ?? String(userTelegramId),
          });
        }
      }

      res.json({
        success: true,
        data: { booking: updated },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/admin/bookings/:id
   * Удалить заявку (например, спам)
   */
  async deleteBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      await this.bookingService.deleteBooking(id);

      logger.info('Booking deleted by admin', {
        bookingId: id,
        adminId: req.user?.userId,
      });

      res.json({
        success: true,
        message: 'Booking deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/bookings/blocked-dates
   * Список заблокированных дат за месяц (?month=YYYY-MM)
   */
  async getBlockedDates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const month = req.query.month as string | undefined;
      const blockedDates = await this.bookingService.getBlockedDates(month);

      res.json({
        success: true,
        data: blockedDates.map((bd) => ({
          id: bd.id,
          date: formatDateInTimezone(bd.blockedDate),
          reason: bd.reason ?? undefined,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/bookings/block-date
   * Заблокировать дату для бронирования
   */
  async blockDate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date, reason } = req.body as BlockDateDto;

      const blockedDate = await this.bookingService.blockDate(date, reason);

      logger.info('Date blocked by admin', {
        date,
        reason,
        adminId: req.user?.userId,
      });

      res.status(201).json({
        success: true,
        data: { blockedDate },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/admin/bookings/block-date/:id
   * Разблокировать дату
   */
  async unblockDate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      await this.bookingService.unblockDate(id);

      logger.info('Date unblocked by admin', {
        blockedDateId: id,
        adminId: req.user?.userId,
      });

      res.json({
        success: true,
        message: 'Date unblocked successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/bookings/calendar
   * Получить календарь бронирований
   */
  async getCalendar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const month = req.query.month as string | undefined;

      const calendar = await this.bookingService.getCalendar(month);

      res.json({
        success: true,
        data: calendar,
      });
    } catch (error) {
      next(error);
    }
  }
}
