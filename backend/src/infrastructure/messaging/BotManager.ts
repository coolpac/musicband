import type { Platform } from '@prisma/client';
import { UserBot } from '../telegram/UserBot';
import { AdminBot } from '../telegram/AdminBot';
import { TelegramBots } from './telegram/TelegramBots';
import { MaxBots } from './max/MaxBots';
import { ReferralService } from '../../domain/services/ReferralService';
import { BookingService } from '../../domain/services/BookingService';
import { IUserRepository } from '../database/repositories/UserRepository';
import { IBookingRepository } from '../database/repositories/BookingRepository';
import { IOnboardingRepository } from '../database/repositories/OnboardingRepository';
import { logger } from '../../shared/utils/logger';
import { prisma } from '../../config/database';
import type {
  PlatformBots,
  BookingNotice,
  NewBookingNotice,
  NewUserNotice,
  SongNotice,
  MessageTarget,
} from './types';

export type { MessageTarget };

/**
 * BotManager — реестр мессенджер-платформ. Хранит Map<Platform, PlatformBots>
 * и маршрутизирует уведомления в нужный адаптер. Оркестрация, требующая БД
 * (разрешение аудитории рассылки, отложенные follow-up, поиск booking),
 * остаётся здесь; отправка конкретных сообщений делегируется адаптеру.
 *
 * Сейчас регистрируется только Telegram-адаптер. Регистрация Max — Phase 4.
 */
export class BotManager {
  private readonly platforms = new Map<Platform, PlatformBots>();

  // Прямые ссылки на Telegram-боты сохраняются для обратной совместимости:
  // некоторые контроллеры обращаются к getUserBot()/getAdminBot() напрямую
  // (sendReviewRequest, notifyVotingQrToAdmins). Это убирается в Phase 5.
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
   * Регистрация адаптера платформы в реестре + запуск его жизненного цикла.
   * start() обязателен: Telegram-боты начинают polling в конструкторе (no-op),
   * а Max-адаптер (Phase 4) запускает long polling именно здесь.
   */
  async registerPlatform(bots: PlatformBots): Promise<void> {
    this.platforms.set(bots.platform, bots);
    await bots.start();
  }

  /**
   * Получить адаптер для платформы (или undefined, если не зарегистрирован).
   */
  private getPlatform(platform: Platform): PlatformBots | undefined {
    return this.platforms.get(platform);
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

      // Регистрируем Telegram-адаптер в реестре платформ (и запускаем его).
      await this.registerPlatform(new TelegramBots(this.userBot, this.adminBot));

      // SEAM (Phase 4): регистрация Max-адаптера. Только если ОБА токена заданы —
      // иначе пропускаем (как Telegram при отсутствии токенов). Колбэки
      // onBookingConfirmed/onBroadcast — те же, что у Telegram (BotManager оркестрирует БД).
      await this.initializeMaxPlatform();

      logger.info('Telegram bots initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Telegram bots', { error });
      throw error;
    }
  }

  /**
   * Регистрация Max-адаптера. Запускается только если заданы ОБА токена
   * (MAX_USER_BOT_TOKEN + MAX_ADMIN_BOT_TOKEN). Иначе — graceful skip с логом,
   * чтобы поведение при отсутствии Max-токенов оставалось Telegram-only (как раньше).
   */
  private async initializeMaxPlatform(): Promise<void> {
    const maxUserToken = process.env.MAX_USER_BOT_TOKEN;
    const maxAdminToken = process.env.MAX_ADMIN_BOT_TOKEN;

    if (!maxUserToken || !maxAdminToken) {
      logger.info('Max bot tokens not configured, Max platform will not be registered');
      return;
    }

    // Изолируем инициализацию Max: её сбой НЕ должен ронять старт сервера,
    // когда Telegram уже успешно поднялся (Telegram-only режим переживает это).
    try {
      const maxBots = MaxBots.fromTokens(maxUserToken, maxAdminToken, {
        referralService: this.referralService,
        userRepository: this.userRepository,
        bookingRepository: this.bookingRepository,
        onboardingRepository: this.onboardingRepository,
        onBookingConfirmed: async (payload) => {
          await this.notifyBookingConfirmed(payload);
        },
        onBroadcast: async (payload) => this.broadcastToUsers(payload),
      });

      await this.registerPlatform(maxBots);
      logger.info('Max bots initialized successfully');
    } catch (error) {
      logger.error('Max platform init failed; continuing Telegram-only', { error });
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
   * Отправка уведомления о новом пользователе.
   * Платформа берётся из самого notice (NewUserNotice.platform).
   */
  async notifyNewUser(userData: NewUserNotice): Promise<void> {
    const bots = this.getPlatform(userData.platform);
    if (bots) {
      await bots.notifyNewUser(userData);
    }
  }

  async sendCsvToAdmin(target: MessageTarget, csvBuffer: Buffer, filename: string): Promise<void> {
    const bots = this.getPlatform(target.platform);
    if (bots) {
      await bots.sendCsvToAdmin(target.platformId, csvBuffer, filename);
    }
  }

  /**
   * Отправка уведомления о новом бронировании (админам платформы).
   */
  async notifyNewBooking(
    target: { platform: Platform },
    bookingData: NewBookingNotice
  ): Promise<void> {
    const bots = this.getPlatform(target.platform);
    if (bots) {
      await bots.notifyNewBooking(bookingData);
    }
  }

  /**
   * Рассылка пользователям. Разрешение сегмента в список получателей остаётся
   * здесь (БД), сама отправка с throttling — в адаптере.
   *
   * Сейчас сегментация и аудитория — только Telegram, поэтому маршрутизируем в telegram.
   * Поддержка Max-аудитории — Phase 5.
   */
  async broadcastToUsers(payload: {
    text: string;
    buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }>;
    media?: { type: 'photo' | 'video' | 'document'; fileId: string };
    segment?: 'all' | 'just_person' | 'organizer';
    onProgress?: (progress: { sent: number; failed: number; total: number }) => Promise<void>;
  }): Promise<{ sent: number; failed: number; total: number }> {
    const bots = this.getPlatform('telegram');
    if (!bots) {
      logger.warn('Telegram bots not initialized, broadcast skipped');
      return { sent: 0, failed: 0, total: 0 };
    }

    // Получаем список telegramId с учётом сегмента
    const telegramIds = await this.getAudienceTelegramIds(payload.segment ?? 'all');
    const platformIds = telegramIds.map((id) => id.toString());

    const result = await bots.broadcast(platformIds, {
      text: payload.text,
      buttons: payload.buttons,
      media: payload.media,
      onProgress: payload.onProgress,
    });

    logger.info('Broadcast finished', {
      sent: result.sent,
      failed: result.failed,
      total: result.total,
      segment: payload.segment ?? 'all',
    });
    return result;
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
        where: { platform: 'telegram' },
        select: { platformId: true },
      });
      return users.map((user) => Number(user.platformId)).filter((id) => !Number.isNaN(id));
    }

    // Фильтрация по onboarding-роли через JOIN
    const rows = await prisma.$queryRaw<Array<{ platform_id: bigint }>>`
      SELECT u.platform_id
      FROM users u
      INNER JOIN onboarding_answers oa ON oa.platform = u.platform AND oa.platform_id = u.platform_id
      WHERE u.platform = 'telegram' AND oa.role = ${segment}
    `;
    return rows.map((row) => Number(row.platform_id)).filter((id) => !Number.isNaN(id));
  }

  /**
   * Отправка подтверждения бронирования пользователю
   */
  async sendBookingConfirmation(target: MessageTarget, bookingData: BookingNotice): Promise<void> {
    const bots = this.getPlatform(target.platform);
    if (bots) {
      await bots.sendBookingConfirmation(target.platformId, bookingData);
    }
  }

  async sendBookingReceived(target: MessageTarget, bookingData: BookingNotice): Promise<void> {
    const bots = this.getPlatform(target.platform);
    if (bots) {
      await bots.sendBookingReceived(target.platformId, bookingData);
    }
  }

  /**
   * Обработка отложенных рассылок участникам голосования.
   * Вызывается каждые 15 мин. Находит записи с scheduledAt <= now и sentAt = null,
   * отправляет сообщение по campaignDay (1 = День 1, 2 = День 3) с кнопкой в приложение, помечает sentAt.
   */
  async processScheduledVotingFollowUps(): Promise<void> {
    // follow-up аудитория — пока только Telegram (telegramIds в записи)
    const bots = this.getPlatform('telegram');
    if (!bots) return;

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
        const { sent, failed } = await bots.sendVotingFollowUp(telegramIds, campaignDay);
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
    winningSong: SongNotice,
    sessionId: string
  ): Promise<void> {
    // Голосование — пока только Telegram-аудитория
    const bots = this.getPlatform('telegram');
    if (!bots) {
      logger.warn('Telegram bots not initialized, skipping voting winner notifications');
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
        await bots.sendVotingWinner(telegramId.toString(), winningSong, sessionId);
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

      const bots = this.getPlatform(booking.user.platform);
      if (bots) {
        await bots.sendBookingConfirmation(booking.user.platformId.toString(), {
          bookingDate: bookingData.bookingDate,
          formatName: bookingData.formatName,
          fullName: bookingData.fullName,
        });
        logger.info('Booking confirmation sent to user', {
          bookingId: bookingData.bookingId,
          telegramId: booking.user.platformId.toString(),
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
   * Graceful shutdown - останавливает всех ботов всех платформ
   * Вызывается только при завершении работы сервера (SIGTERM/SIGINT)
   */
  async stop(): Promise<void> {
    logger.info('Stopping messaging bots...');

    const stopPromises: Array<Promise<void> | void> = [];
    for (const bots of this.platforms.values()) {
      stopPromises.push(
        Promise.resolve(bots.stop()).catch((error: unknown) => {
          logger.error('Error stopping platform bots', { platform: bots.platform, error });
        })
      );
    }

    await Promise.all(stopPromises);
    logger.info('All messaging bots stopped');
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
