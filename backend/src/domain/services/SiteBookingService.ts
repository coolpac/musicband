import { BookingService } from './BookingService';
import { IFormatRepository } from '../../infrastructure/database/repositories/FormatRepository';
import { SiteBookingDto } from '../../application/dto/site.dto';
import { normalizeRussianPhone } from '../../shared/utils/phone';
import { sanitizeLine, sanitizeMultiline } from '../../shared/utils/text';
import { parseDateOnly, formatDateInTimezone } from '../../shared/utils/timezone';
import { logger } from '../../shared/utils/logger';
import { getBotManager } from '../../infrastructure/telegram/botManager';

/** Ограничения длины полей формы после нормализации (колонки в БД — text, режем сами). */
const FIELD_LIMITS = {
  FULL_NAME: 120,
  CITY: 120,
  EMAIL: 254,
  COMMENT: 2000,
} as const;

export type SiteBookingResult =
  | { status: 'created'; id: string; bookingDate: string; bookingTime: string | null }
  /** Поля формы не прошли доменную проверку: телефон, дата, формат */
  | { status: 'invalid'; fields: Record<string, string> }
  /** Дата в прошлом, заблокирована или уже занята — для посетителя это одно и то же */
  | { status: 'unavailable' };

/**
 * Заявка с публичного сайта: нормализация ввода анонимного посетителя,
 * создание Booking без Telegram-пользователя и уведомление админов.
 */
export class SiteBookingService {
  constructor(
    private bookingService: BookingService,
    private formatRepository: IFormatRepository
  ) {}

  async createBooking(input: SiteBookingDto): Promise<SiteBookingResult> {
    const fields: Record<string, string> = {};

    // Телефон — единственный канал связи с анонимом, поэтому нормализация строгая
    const phone = normalizeRussianPhone(input.phone);
    if (!phone) {
      fields.phone = 'Введите российский номер телефона';
    }

    const bookingDate = parseDateOnly(input.bookingDate);
    if (!bookingDate) {
      fields.bookingDate = 'Укажите существующую дату';
    }

    const fullName = sanitizeLine(input.fullName, FIELD_LIMITS.FULL_NAME);
    if (fullName.length < 2) {
      fields.fullName = 'Укажите имя';
    }

    const formatId = input.formatId ? input.formatId : undefined;
    if (formatId) {
      const format = await this.formatRepository.findById(formatId);
      if (!format) {
        fields.formatId = 'Такой формат больше не доступен';
      }
    }

    // `!phone || !bookingDate` здесь не лишнее: оно и сужает типы для TypeScript
    if (!phone || !bookingDate || Object.keys(fields).length > 0) {
      return { status: 'invalid', fields };
    }

    const bookingTime = input.bookingTime ? input.bookingTime : undefined;
    const city = optional(sanitizeLine(input.city ?? '', FIELD_LIMITS.CITY));
    const email = optional(sanitizeLine(input.email ?? '', FIELD_LIMITS.EMAIL).toLowerCase());
    const comment = optional(sanitizeMultiline(input.comment ?? '', FIELD_LIMITS.COMMENT));

    const outcome = await this.bookingService.tryCreateBooking({
      userId: null,
      formatId,
      bookingDate,
      bookingTime,
      fullName,
      contactType: 'phone',
      contactValue: phone,
      email,
      comment,
      city,
      origin: 'website',
    });

    if (outcome.status !== 'created') {
      return { status: 'unavailable' };
    }

    const booking = outcome.booking;
    const bookingDateStr = formatDateInTimezone(booking.bookingDate);

    // Fire-and-forget: медленный Telegram не должен задерживать ответ посетителю.
    // Заявка уже в БД и видна в админке, уведомление — приятный бонус.
    void this.notifyAdmins({
      id: booking.id,
      bookingDate: bookingDateStr,
      bookingTime: booking.bookingTime ?? undefined,
      formatName: booking.format?.name,
      fullName: booking.fullName,
      contactValue: booking.contactValue,
      email: booking.email ?? undefined,
      comment: booking.comment ?? undefined,
      city: booking.city ?? undefined,
    });

    return {
      status: 'created',
      id: booking.id,
      bookingDate: bookingDateStr,
      bookingTime: booking.bookingTime,
    };
  }

  private async notifyAdmins(payload: {
    id: string;
    bookingDate: string;
    bookingTime?: string;
    formatName?: string;
    fullName: string;
    contactValue: string;
    email?: string;
    comment?: string;
    city?: string;
  }): Promise<void> {
    try {
      const botManager = getBotManager();
      if (!botManager) return;
      // У посетителя сайта нет платформы — уведомляем админов на ВСЕХ платформах (Telegram и Max).
      await botManager.notifyNewBookingToAllAdmins({ ...payload, origin: 'website' });
    } catch (error) {
      logger.error('Failed to notify admins about a website booking', {
        error,
        bookingId: payload.id,
      });
    }
  }
}

function optional(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}
