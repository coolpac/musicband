import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../../domain/services/BookingService';
import { CreateBookingDto } from '../../application/dto/booking.dto';
import { logger } from '../../shared/utils/logger';
import { getBotManager } from '../../infrastructure/telegram/botManager';

export class BookingController {
  constructor(private bookingService: BookingService) {}

  /**
   * POST /api/bookings
   * Создать бронирование
   */
  async createBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const data = req.body as CreateBookingDto;
      const booking = await this.bookingService.createBooking({
        userId: req.user.userId,
        formatId: data.formatId,
        bookingDate: new Date(data.bookingDate),
        fullName: data.fullName,
        contactType: data.contactType,
        contactValue: data.contactValue,
        city: data.city,
        source: data.source,
      });

      logger.info('Booking created', {
        bookingId: booking.id,
        userId: req.user.userId,
      });

      // Отправляем уведомления через Telegram Bots
      const botManager = getBotManager();
      if (botManager) {
        // Уведомление админам
        await botManager.notifyNewBooking({
          id: booking.id,
          bookingDate: booking.bookingDate.toISOString().split('T')[0],
          formatName: booking.format?.name,
          fullName: booking.fullName,
          contactValue: booking.contactValue,
          city: booking.city || undefined,
          telegramId: booking.user.telegramId.toString(),
          username: booking.user.username ?? undefined,
          firstName: booking.user.firstName ?? undefined,
          lastName: booking.user.lastName ?? undefined,
        });

        // Уведомление пользователю (будет отправлено после подтверждения админом)
        // Это будет обрабатываться в AdminBookingController при подтверждении
      }

      res.status(201).json({
        success: true,
        data: booking,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/bookings/available-dates
   * Получить доступные даты для бронирования
   */
  async getAvailableDates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const formatId = req.query.formatId as string | undefined;
      const month = req.query.month as string | undefined;

      const result = await this.bookingService.getAvailableDates(formatId, month);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/bookings/my
   * Получить бронирования текущего пользователя
   */
  async getMyBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const bookings = await this.bookingService.getUserBookings(req.user.userId);

      res.json({
        success: true,
        data: bookings,
      });
    } catch (error) {
      next(error);
    }
  }
}
