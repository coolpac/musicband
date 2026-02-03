import { UserBot } from './UserBot';
import { AdminBot } from './AdminBot';
import { ReferralService } from '../../domain/services/ReferralService';
import { BookingService } from '../../domain/services/BookingService';
import { IUserRepository } from '../database/repositories/UserRepository';
import { IBookingRepository, BookingWithUserAndFormat } from '../database/repositories/BookingRepository';
import { logger } from '../../shared/utils/logger';
import { prisma } from '../../config/database';

export class BotManager {
  private userBot: UserBot | null = null;
  private adminBot: AdminBot | null = null;

  constructor(
    private referralService: ReferralService,
    private bookingService: BookingService,
    private userRepository: IUserRepository,
    private bookingRepository: IBookingRepository
  ) {}

  getBookingService(): BookingService {
    return this.bookingService;
  }

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
      this.adminBot = new AdminBot(
        adminBotToken,
        this.userRepository,
        this.bookingRepository,
        async (payload) => {
          await this.notifyBookingConfirmed(payload);
        },
        async (payload) => this.broadcastToUsers(payload)
      );

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
    telegramId?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<void> {
    if (this.adminBot) {
      await this.adminBot.notifyNewBooking(bookingData);
    }
  }

  async broadcastToUsers(payload: {
    text: string;
    buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }>;
    onProgress?: (progress: { sent: number; failed: number; total: number }) => Promise<void>;
  }): Promise<{ sent: number; failed: number; total: number }> {
    if (!this.userBot) {
      logger.warn('UserBot not initialized, broadcast skipped');
      return { sent: 0, failed: 0, total: 0 };
    }

    const users = await prisma.user.findMany({
      select: { telegramId: true },
    });
    const telegramIds = users
      .map((user) => Number(user.telegramId))
      .filter((id) => !Number.isNaN(id));

    const miniAppUrl = process.env.MINI_APP_URL || 'https://your-domain.com';
    const baseButtons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }> = payload.buttons.length
      ? payload.buttons
      : [{ text: 'Открыть приложение', url: miniAppUrl, kind: 'web_app' }];

    const inlineRows: Array<Array<{ text: string; url: string; kind: 'url' | 'web_app' }>> = [];
    for (let i = 0; i < baseButtons.length; i += 2) {
      inlineRows.push(baseButtons.slice(i, i + 2));
    }

    const replyMarkup = {
      inline_keyboard: inlineRows.map((row) =>
        row.map((button) =>
          button.kind === 'web_app'
            ? { text: button.text, web_app: { url: button.url } }
            : { text: button.text, url: button.url }
        )
      ),
    };

    let sent = 0;
    let failed = 0;
    const total = telegramIds.length;

    if (payload.onProgress) {
      await payload.onProgress({ sent, failed, total });
    }

    for (const telegramId of telegramIds) {
      try {
        await this.userBot.getBot().sendMessage(telegramId, payload.text, { reply_markup: replyMarkup });
        sent++;
      } catch (error: unknown) {
        failed++;
        const code = error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { error_code?: number } }).response?.error_code
          : undefined;
        if (code !== 403) {
          logger.error('Broadcast failed', { telegramId, error });
        }
      }

      if (payload.onProgress && sent % 25 === 0) {
        await payload.onProgress({ sent, failed, total });
      }

      if (sent % 25 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (payload.onProgress) {
      await payload.onProgress({ sent, failed, total });
    }

    logger.info('Broadcast finished', { sent, failed, total });
    return { sent, failed, total };
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

  async sendBookingReceived(telegramId: number, bookingData: {
    bookingDate: string;
    formatName?: string;
    fullName: string;
  }): Promise<void> {
    if (this.userBot) {
      await this.userBot.sendBookingReceived(telegramId.toString(), bookingData);
    }
  }

  /**
   * Уведомление проголосовавших о победителе голосования (массовая рассылка с учётом rate limit)
   */
  async notifyVotingWinner(
    voterTelegramIds: bigint[],
    winningSong: { id: string; title: string; artist: string; coverUrl: string | null },
    sessionId: string
  ): Promise<void> {
    if (!this.userBot) {
      logger.warn('UserBot not initialized, skipping voting winner notifications');
      return;
    }

    logger.info('Sending voting winner notifications', {
      sessionId,
      voterCount: voterTelegramIds.length,
      winningSong: winningSong.title,
    });

    let sent = 0;
    let failed = 0;

    for (const telegramId of voterTelegramIds) {
      try {
        await this.userBot.sendVotingWinnerNotification(telegramId, winningSong, sessionId);
        sent++;
      } catch (error) {
        failed++;
        logger.error('Failed to send winner notification', { telegramId: telegramId.toString(), error });
      }

      // Telegram rate limit: ~30 msg/sec. Задержка 1s каждые 25 сообщений = ~25 msg/sec (с запасом)
      if (sent % 25 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info('Voting winner notifications completed', {
      sessionId,
      sent,
      failed,
      total: voterTelegramIds.length,
    });
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
      const booking = (await this.bookingRepository.findById(bookingData.bookingId)) as BookingWithUserAndFormat | null;
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

  /**
   * Graceful shutdown - останавливает всех ботов
   * Вызывается только при завершении работы сервера (SIGTERM/SIGINT)
   */
  async stop(): Promise<void> {
    logger.info('Stopping Telegram bots...');

    const stopPromises: Promise<void>[] = [];

    if (this.userBot) {
      stopPromises.push(
        this.userBot.stop().catch((error: unknown) => {
          logger.error('Error stopping User Bot', { error });
        })
      );
    }

    if (this.adminBot) {
      stopPromises.push(
        this.adminBot.stop().catch((error: unknown) => {
          logger.error('Error stopping Admin Bot', { error });
        })
      );
    }

    await Promise.all(stopPromises);
    logger.info('All Telegram bots stopped');
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
