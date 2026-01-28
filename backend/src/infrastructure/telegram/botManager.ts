import { UserBot } from './UserBot';
import { AdminBot } from './AdminBot';
import { ReferralService } from '../../domain/services/ReferralService';
import { BookingService } from '../../domain/services/BookingService';
import { IUserRepository } from '../database/repositories/UserRepository';
import { IBookingRepository } from '../database/repositories/BookingRepository';
import { logger } from '../../shared/utils/logger';

export class BotManager {
  private userBot: UserBot | null = null;
  private adminBot: AdminBot | null = null;

  constructor(
    private referralService: ReferralService,
    private bookingService: BookingService,
    private userRepository: IUserRepository,
    private bookingRepository: IBookingRepository
  ) {}

  /**
   * Инициализация ботов
   */
  async initialize(): Promise<void> {
    try {
      const userBotToken = process.env.TELEGRAM_USER_BOT_TOKEN;
      const adminBotToken = process.env.TELEGRAM_ADMIN_BOT_TOKEN;

      if (!userBotToken || !adminBotToken) {
        logger.warn('Telegram bot tokens not configured, bots will not be initialized');
        return;
      }

    // Инициализируем User Bot
    this.userBot = new UserBot(userBotToken, this.referralService);

      // Инициализируем Admin Bot
      this.adminBot = new AdminBot(adminBotToken, this.userRepository, this.bookingRepository);

      logger.info('Telegram bots initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Telegram bots', { error });
      throw error;
    }
  }

  /**
   * Получить User Bot
   */
  getUserBot(): UserBot | null {
    return this.userBot;
  }

  /**
   * Получить Admin Bot
   */
  getAdminBot(): AdminBot | null {
    return this.adminBot;
  }

  /**
   * Отправка уведомления о новом пользователе
   */
  async notifyNewUser(userData: {
    telegramId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<void> {
    if (this.adminBot) {
      await this.adminBot.notifyNewUser(userData);
    }
  }

  /**
   * Отправка уведомления о новом бронировании
   */
  async notifyNewBooking(bookingData: {
    id: string;
    bookingDate: string;
    formatName?: string;
    fullName: string;
    contactValue: string;
    city?: string;
  }): Promise<void> {
    if (this.adminBot) {
      await this.adminBot.notifyNewBooking(bookingData);
    }
  }

  /**
   * Отправка подтверждения бронирования пользователю
   */
  async sendBookingConfirmation(telegramId: number, bookingData: {
    bookingDate: string;
    formatName?: string;
    fullName: string;
  }): Promise<void> {
    if (this.userBot) {
      await this.userBot.sendBookingConfirmation(telegramId.toString(), bookingData);
    }
  }

  /**
   * Отправка уведомления о подтверждении бронирования пользователю
   */
  async notifyBookingConfirmed(bookingData: {
    bookingId: string;
    bookingDate: string;
    formatName?: string;
    fullName: string;
    contactValue: string;
  }): Promise<void> {
    try {
      // Получаем пользователя по bookingId
      const booking = await this.bookingRepository.findById(bookingData.bookingId);
      if (!booking || !booking.user) {
        logger.warn('Booking not found for confirmation notification', { bookingId: bookingData.bookingId });
        return;
      }

      if (this.userBot) {
        await this.userBot.sendBookingConfirmation(booking.user.telegramId.toString(), {
          bookingDate: bookingData.bookingDate,
          formatName: bookingData.formatName,
          fullName: bookingData.fullName,
        });
        logger.info('Booking confirmation sent to user', {
          bookingId: bookingData.bookingId,
          telegramId: booking.user.telegramId.toString(),
        });
      }
    } catch (error) {
      logger.error('Failed to send booking confirmation', { error, bookingId: bookingData.bookingId });
    }
  }
}

// Глобальный экземпляр для доступа из других модулей
let botManagerInstance: BotManager | null = null;

export function getBotManager(): BotManager | null {
  return botManagerInstance;
}

export function setBotManager(instance: BotManager): void {
  botManagerInstance = instance;
}
