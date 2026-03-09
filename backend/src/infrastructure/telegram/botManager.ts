import { UserBot } from './UserBot';
import { AdminBot } from './AdminBot';
import { ReferralService } from '../../domain/services/ReferralService';
import { BookingService } from '../../domain/services/BookingService';
import { IUserRepository } from '../database/repositories/UserRepository';
import { IBookingRepository } from '../database/repositories/BookingRepository';
import { IOnboardingRepository } from '../database/repositories/OnboardingRepository';
import { logger } from '../../shared/utils/logger';
import { prisma } from '../../config/database';

export class BotManager {
  private userBot: UserBot | null = null;
  private adminBot: AdminBot | null = null;

  constructor(
    private referralService: ReferralService,
    private bookingService: BookingService,
    private userRepository: IUserRepository,
    private bookingRepository: IBookingRepository,
    private onboardingRepository: IOnboardingRepository
  ) {}

  getBookingService(): BookingService {
    return this.bookingService;
  }

  /**
   * Инициализация ботов
   */
  initialize(): Promise<void> {
    try {
      const userBotToken = process.env.TELEGRAM_USER_BOT_TOKEN;
      const adminBotToken = process.env.TELEGRAM_ADMIN_BOT_TOKEN;

      if (!userBotToken || !adminBotToken) {
        logger.warn('Telegram bot tokens not configured, bots will not be initialized');
        return Promise.resolve();
      }

      // Инициализируем User Bot (онбординг «Кто вы?» перед приветствием)
      this.userBot = new UserBot(userBotToken, this.referralService, this.onboardingRepository);

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
      return Promise.resolve();
    } catch (error) {
      logger.error('Failed to initialize Telegram bots', { error });
      return Promise.reject(error);
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
    media?: { type: 'photo' | 'video' | 'document'; fileId: string };
    segment?: 'all' | 'just_person' | 'organizer';
    onProgress?: (progress: { sent: number; failed: number; total: number }) => Promise<void>;
  }): Promise<{ sent: number; failed: number; total: number }> {
    if (!this.userBot) {
      logger.warn('UserBot not initialized, broadcast skipped');
      return { sent: 0, failed: 0, total: 0 };
    }

    // Получаем список telegramId с учётом сегмента
    const telegramIds = await this.getAudienceTelegramIds(payload.segment ?? 'all');

    const baseButtons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }> =
      payload.buttons;

    const inlineRows: Array<Array<{ text: string; url: string; kind: 'url' | 'web_app' }>> = [];
    for (let i = 0; i < baseButtons.length; i += 2) {
      inlineRows.push(baseButtons.slice(i, i + 2));
    }

    const replyMarkup = baseButtons.length
      ? {
          inline_keyboard: inlineRows.map((row) =>
            row.map((button) =>
              button.kind === 'web_app'
                ? { text: button.text, web_app: { url: button.url } }
                : { text: button.text, url: button.url }
            )
          ),
        }
      : undefined;

    let sent = 0;
    let failed = 0;
    const total = telegramIds.length;

    if (payload.onProgress) {
      await payload.onProgress({ sent, failed, total });
    }

    for (const telegramId of telegramIds) {
      try {
        const bot = this.userBot.getBot();
        if (payload.media) {
          const caption = payload.text;
          if (payload.media.type === 'photo') {
            await bot.sendPhoto(telegramId, payload.media.fileId, {
              caption,
              reply_markup: replyMarkup,
            });
          } else if (payload.media.type === 'video') {
            await bot.sendVideo(telegramId, payload.media.fileId, {
              caption,
              reply_markup: replyMarkup,
            });
          } else {
            // document
            await bot.sendDocument(telegramId, payload.media.fileId, {
              caption,
              reply_markup: replyMarkup,
            });
          }
        } else {
          await bot.sendMessage(
            telegramId,
            payload.text,
            replyMarkup ? { reply_markup: replyMarkup } : undefined
          );
        }
        sent++;
      } catch (error: unknown) {
        failed++;
        const code =
          error && typeof error === 'object' && 'response' in error
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

    logger.info('Broadcast finished', { sent, failed, total, segment: payload.segment ?? 'all' });
    return { sent, failed, total };
  }

  /**
   * Получить список telegramId по сегменту аудитории.
   * - 'all' — все пользователи
   * - 'just_person' / 'organizer' — только те, кто прошёл onboarding с соответствующей ролью
   */
  private async getAudienceTelegramIds(
    segment: 'all' | 'just_person' | 'organizer'
  ): Promise<number[]> {
    if (segment === 'all') {
      const users = await prisma.user.findMany({
        select: { telegramId: true },
      });
      return users
        .map((user) => Number(user.telegramId))
        .filter((id) => !Number.isNaN(id));
    }

    // Фильтрация по onboarding-роли через JOIN
    const rows = await prisma.$queryRaw<Array<{ telegram_id: bigint }>>`
      SELECT u.telegram_id
      FROM users u
      INNER JOIN onboarding_answers oa ON oa.telegram_id = u.telegram_id
      WHERE oa.role = ${segment}
    `;
    return rows
      .map((row) => Number(row.telegram_id))
      .filter((id) => !Number.isNaN(id));
  }

  /**
   * Отправка подтверждения бронирования пользователю
   */
  async sendBookingConfirmation(
    telegramId: number,
    bookingData: {
      bookingDate: string;
      formatName?: string;
      fullName: string;
    }
  ): Promise<void> {
    if (this.userBot) {
      await this.userBot.sendBookingConfirmation(telegramId.toString(), bookingData);
    }
  }

  async sendBookingReceived(
    telegramId: number,
    bookingData: {
      bookingDate: string;
      formatName?: string;
      fullName: string;
    }
  ): Promise<void> {
    if (this.userBot) {
      await this.userBot.sendBookingReceived(telegramId.toString(), bookingData);
    }
  }

  /**
   * Обработка отложенных рассылок участникам голосования.
   * Вызывается каждые 15 мин. Находит записи с scheduledAt <= now и sentAt = null,
   * отправляет сообщение по campaignDay (1 = День 1, 2 = День 3) с кнопкой в приложение, помечает sentAt.
   */
  async processScheduledVotingFollowUps(): Promise<void> {
    if (!this.userBot) return;

    const now = new Date();
    const due = await prisma.votingFollowUp.findMany({
      where: {
        sentAt: null,
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    for (const row of due) {
      const telegramIds = Array.isArray(row.telegramIds) ? (row.telegramIds as string[]) : [];
      if (telegramIds.length === 0) {
        await prisma.votingFollowUp.update({
          where: { id: row.id },
          data: { sentAt: now },
        });
        continue;
      }
      try {
        const campaignDay = row.campaignDay ?? 1;
        const { sent, failed } = await this.userBot.sendVotingFollowUp(telegramIds, campaignDay);
        await prisma.votingFollowUp.update({
          where: { id: row.id },
          data: { sentAt: new Date() },
        });
        logger.info('Voting follow-up sent', {
          followUpId: row.id,
          sessionId: row.sessionId,
          campaignDay,
          sent,
          failed,
        });
      } catch (err) {
        logger.error('Voting follow-up send failed', {
          followUpId: row.id,
          sessionId: row.sessionId,
          error: err,
        });
      }
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
        logger.error('Failed to send winner notification', {
          telegramId: telegramId.toString(),
          error,
        });
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
      const booking = await this.bookingRepository.findById(bookingData.bookingId);
      if (!booking || !booking.user) {
        logger.warn('Booking not found for confirmation notification', {
          bookingId: bookingData.bookingId,
        });
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
      logger.error('Failed to send booking confirmation', {
        error,
        bookingId: bookingData.bookingId,
      });
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
