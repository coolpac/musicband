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
import {
  generateVotingSessionQRForPlatforms,
  normalizeTelegramBotUsername,
  normalizeMaxBotUsername,
} from '../utils/qrcode';
import type {
  PlatformBots,
  BookingNotice,
  NewBookingNotice,
  NewUserNotice,
  SongNotice,
  MessageTarget,
  ReviewNotice,
  ReviewRequestResult,
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

  // Прямые ссылки на Telegram-боты сохраняются для обратной совместимости
  // (getAdminBot()). Рассылка QR голосования обобщена в Phase 6 —
  // см. notifyVotingQrToAdmins (фан-аут по платформам с per-platform deep link).
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
   * Отправка уведомления о новом бронировании (админам конкретной платформы).
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
   * Уведомление о новом бронировании ВСЕМ админам на ВСЕХ зарегистрированных платформах.
   * Замысел: ни один админ не должен пропустить заявку, независимо от того, на какой
   * платформе он сидит и на какой платформе сделана бронь. Каждый admin-бот сам
   * рассылает только своим админам (loadAdmins фильтрует по своей платформе), поэтому
   * с Telegram-only данными поведение идентично прежнему (Max-адаптер просто не зарегистрирован).
   */
  async notifyNewBookingToAllAdmins(bookingData: NewBookingNotice): Promise<void> {
    for (const bots of this.platforms.values()) {
      try {
        await bots.notifyNewBooking(bookingData);
      } catch (error) {
        logger.error('Failed to notify admins of new booking', {
          platform: bots.platform,
          bookingId: bookingData.id,
          error,
        });
      }
    }
  }

  /**
   * Уведомление о новом пользователе ВСЕМ админам на ВСЕХ платформах (см. notifyNewBookingToAllAdmins).
   * Сам факт регистрации нового пользователя важен для всех админов, а не только для
   * админов платформы этого пользователя.
   */
  async notifyNewUserToAllAdmins(userData: NewUserNotice): Promise<void> {
    for (const bots of this.platforms.values()) {
      try {
        await bots.notifyNewUser(userData);
      } catch (error) {
        logger.error('Failed to notify admins of new user', {
          platform: bots.platform,
          userPlatform: userData.platform,
          error,
        });
      }
    }
  }

  /**
   * Рассылка пользователям. Разрешение сегмента в список получателей остаётся
   * здесь (БД), сама отправка с throttling — в адаптере.
   *
   * Fan-out по платформам: для КАЖДОГО зарегистрированного адаптера разрешаем
   * аудиторию его платформы и вызываем его broadcast. С Telegram-only данными
   * (Max не зарегистрирован / нет Max-пользователей) поведение идентично прежнему.
   *
   * onProgress агрегируется по всем платформам (накопительные sent/failed/total),
   * чтобы admin-бот видел общий прогресс.
   */
  async broadcastToUsers(payload: {
    text: string;
    buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }>;
    media?: { type: 'photo' | 'video' | 'document'; fileId: string };
    segment?: 'all' | 'just_person' | 'organizer';
    platform?: 'telegram' | 'max' | 'both';
    onProgress?: (progress: { sent: number; failed: number; total: number }) => Promise<void>;
  }): Promise<{ sent: number; failed: number; total: number }> {
    const segment = payload.segment ?? 'all';
    const targetPlatform = payload.platform ?? 'both';

    if (this.platforms.size === 0) {
      logger.warn('No platforms registered, broadcast skipped');
      return { sent: 0, failed: 0, total: 0 };
    }

    // Целевые платформы: 'both' (или не указано) — все зарегистрированные (прежнее
    // поведение); 'telegram'/'max' — только эта одна, остальные пропускаем.
    const targets = [...this.platforms].filter(
      ([platform]) => targetPlatform === 'both' || platform === targetPlatform
    );

    // Аккумулируем прогресс по уже завершённым платформам, чтобы onProgress
    // (один индикатор у admin-бота) показывал суммарные числа по всем платформам.
    let baseSent = 0;
    let baseFailed = 0;
    let baseTotal = 0;

    const aggregate = { sent: 0, failed: 0, total: 0 };

    // Медиа загружается в Telegram admin-бота и хранится как Telegram file_id. Чтобы
    // доставить его на ВСЕ платформы, один раз резолвим file_id в публичный URL через
    // Telegram-адаптер: Telegram отправит по URL, Max скачает по URL и загрузит к себе.
    let mediaUrl: string | undefined;
    if (payload.media) {
      // Telegram-адаптер умеет резолвить file_id → URL (getFileLink). Делаем это один
      // раз: Telegram отправит по URL, а Max по нему скачает и загрузит к себе.
      const tg = this.getPlatform('telegram');
      if (tg?.resolveMediaUrl) {
        mediaUrl = await tg.resolveMediaUrl(payload.media.fileId);
      }
      if (!mediaUrl) {
        logger.warn('Broadcast: media URL not resolved; Max will fall back to text-only', {
          mediaType: payload.media.type,
        });
      }
    }

    for (const [platform, bots] of targets) {
      // Изоляция по платформам: сбой одной платформы (запрос аудитории или
      // отправка) не должен прерывать рассылку в остальные — иначе admin-бот
      // не получит финальное «Рассылка завершена».
      try {
        const platformIds = await this.getAudienceIds(platform, segment);
        logger.info('Broadcast: platform audience resolved', {
          platform,
          segment,
          recipients: platformIds.length,
          hasMedia: !!payload.media,
          buttons: payload.buttons.length,
        });

        const result = await bots.broadcast(platformIds, {
          text: payload.text,
          buttons: payload.buttons,
          media: payload.media,
          mediaUrl,
          onProgress: payload.onProgress
            ? async (progress) => {
                await payload.onProgress!({
                  sent: baseSent + progress.sent,
                  failed: baseFailed + progress.failed,
                  total: baseTotal + progress.total,
                });
              }
            : undefined,
        });

        baseSent += result.sent;
        baseFailed += result.failed;
        baseTotal += result.total;
        aggregate.sent += result.sent;
        aggregate.failed += result.failed;
        aggregate.total += result.total;
        logger.info('Broadcast: platform done', {
          platform,
          sent: result.sent,
          failed: result.failed,
          total: result.total,
        });
      } catch (error) {
        logger.error('Broadcast failed for platform', {
          platform,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }

    logger.info('Broadcast finished', {
      sent: aggregate.sent,
      failed: aggregate.failed,
      total: aggregate.total,
      segment,
      platform: targetPlatform,
    });
    return aggregate;
  }

  /**
   * Получить список platformId (строки) по платформе и сегменту аудитории.
   * - 'all' — все пользователи платформы
   * - 'just_person' / 'organizer' — только те, кто прошёл onboarding с соответствующей ролью
   *
   * Telegram-ветка идентична прежнему getAudienceTelegramIds (числа → строки),
   * Max-ветка использует ту же логику с platform='max'.
   */
  private async getAudienceIds(
    platform: Platform,
    segment: 'all' | 'just_person' | 'organizer'
  ): Promise<string[]> {
    if (segment === 'all') {
      const users = await prisma.user.findMany({
        where: { platform },
        select: { platformId: true },
      });
      return users
        .map((user) => user.platformId.toString())
        .filter((id) => id !== '' && id !== 'NaN');
    }

    // Фильтрация по onboarding-роли через JOIN
    const rows = await prisma.$queryRaw<Array<{ platform_id: bigint }>>`
      SELECT u.platform_id
      FROM users u
      INNER JOIN onboarding_answers oa ON oa.platform = u.platform AND oa.platform_id = u.platform_id
      WHERE u.platform::text = ${platform} AND oa.role = ${segment}
    `;
    return rows
      .map((row) => row.platform_id.toString())
      .filter((id) => id !== '' && id !== 'NaN');
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
   * Запрос отзыва пользователю на его платформе (после «Выполнено»).
   * Если платформа не зарегистрирована — возвращаем not-sent (как UserBot отсутствует).
   */
  async sendReviewRequest(target: MessageTarget, review: ReviewNotice): Promise<ReviewRequestResult> {
    const bots = this.getPlatform(target.platform);
    if (!bots) {
      return { sent: false, errorMessage: `Platform ${target.platform} not registered` };
    }
    return bots.sendReviewRequest(target.platformId, review);
  }

  /**
   * Обработка отложенных рассылок участникам голосования.
   * Вызывается каждые 15 мин. Находит записи с scheduledAt <= now и sentAt = null,
   * отправляет сообщение по campaignDay (1 = День 1, 2 = День 3) с кнопкой в приложение, помечает sentAt.
   *
   * Получатели сгруппированы по платформе (см. parseFollowUpRecipients для
   * обратной совместимости со старым форматом — массивом «голых» id-строк) и
   * отправляются через адаптер соответствующей платформы.
   */
  async processScheduledVotingFollowUps(): Promise<void> {
    if (this.platforms.size === 0) return;

    const now = new Date();
    const due = await prisma.votingFollowUp.findMany({
      where: {
        sentAt: null,
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    for (const row of due) {
      const byPlatform = this.parseFollowUpRecipients(row.telegramIds);
      const totalRecipients = [...byPlatform.values()].reduce((sum, ids) => sum + ids.length, 0);

      if (totalRecipients === 0) {
        await prisma.votingFollowUp.update({
          where: { id: row.id },
          data: { sentAt: now },
        });
        continue;
      }

      try {
        const campaignDay = row.campaignDay ?? 1;
        let sent = 0;
        let failed = 0;

        for (const [platform, ids] of byPlatform) {
          if (ids.length === 0) continue;
          const bots = this.getPlatform(platform);
          if (!bots) {
            // Платформа не зарегистрирована (например, нет Max-токенов) — пропускаем её получателей.
            logger.warn('Voting follow-up skipped: platform not registered', {
              followUpId: row.id,
              platform,
              skipped: ids.length,
            });
            continue;
          }
          const result = await bots.sendVotingFollowUp(ids, campaignDay);
          sent += result.sent;
          failed += result.failed;
        }

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
   * Разбор поля VotingFollowUp.telegramIds (JSON) в Map<Platform, platformId[]>.
   *
   * Обратная совместимость: старые/Telegram-записи хранят массив «голых» строк
   * (например ["111","222"]) — каждая трактуется как {platform:'telegram', platformId}.
   * Новые записи хранят массив объектов [{platform, platformId}].
   */
  private parseFollowUpRecipients(raw: unknown): Map<Platform, string[]> {
    const byPlatform = new Map<Platform, string[]>();
    const push = (platform: Platform, id: string) => {
      const list = byPlatform.get(platform) ?? [];
      list.push(id);
      byPlatform.set(platform, list);
    };

    if (!Array.isArray(raw)) return byPlatform;

    for (const entry of raw) {
      if (typeof entry === 'string') {
        // Старый формат: голый id → telegram
        push('telegram', entry);
      } else if (
        entry &&
        typeof entry === 'object' &&
        'platformId' in entry &&
        'platform' in entry
      ) {
        const e = entry as { platform: Platform; platformId: unknown };
        push(e.platform, String(e.platformId));
      }
    }

    return byPlatform;
  }

  /**
   * Уведомление проголосовавших о победителе голосования (массовая рассылка с учётом rate limit).
   * Получатели несут платформу — группируем по платформе и маршрутизируем в нужный адаптер.
   * С только-Telegram голосующими поведение идентично прежнему.
   */
  async notifyVotingWinner(
    voters: Array<{ platform: Platform; platformId: string }>,
    winningSong: SongNotice,
    sessionId: string
  ): Promise<void> {
    if (this.platforms.size === 0) {
      logger.warn('No platforms registered, skipping voting winner notifications');
      return;
    }

    logger.info('Sending voting winner notifications', {
      sessionId,
      voterCount: voters.length,
      winningSong: winningSong.title,
    });

    // Группируем получателей по платформе
    const byPlatform = new Map<Platform, string[]>();
    for (const voter of voters) {
      const list = byPlatform.get(voter.platform) ?? [];
      list.push(voter.platformId);
      byPlatform.set(voter.platform, list);
    }

    let sent = 0;
    let failed = 0;

    for (const [platform, ids] of byPlatform) {
      const bots = this.getPlatform(platform);
      if (!bots) {
        logger.warn('Voting winner skipped: platform not registered', {
          platform,
          skipped: ids.length,
          sessionId,
        });
        continue;
      }

      for (const platformId of ids) {
        try {
          await bots.sendVotingWinner(platformId, winningSong, sessionId);
          sent++;
        } catch (error) {
          failed++;
          logger.error('Failed to send winner notification', {
            platform,
            platformId,
            error,
          });
        }

        // Rate limit: ~30 msg/sec. Задержка 1s каждые 25 сообщений = ~25 msg/sec (с запасом)
        if (sent % 25 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    logger.info('Voting winner notifications completed', {
      sessionId,
      sent,
      failed,
      total: voters.length,
    });
  }

  /**
   * Рассылка QR-кода сессии голосования админам ВСЕХ зарегистрированных платформ.
   *
   * Для каждой платформы строится СВОЙ deep link (t.me для Telegram, max.ru для Max)
   * с username бота этой платформы, генерируется QR именно под эту ссылку и
   * отправляется админам платформы через её адаптер. Так Telegram-админы получают
   * привычный t.me-QR (байт-в-байт прежнее поведение), а Max-админы — max.ru-QR.
   *
   * Изоляция по платформам: сбой одной платформы не прерывает рассылку в остальные.
   */
  async notifyVotingQrToAdmins(sessionId: string, requestedByAdminId?: string): Promise<void> {
    if (this.platforms.size === 0) {
      logger.warn('No platforms registered, skipping voting QR to admins');
      return;
    }

    for (const [platform, bots] of this.platforms) {
      try {
        const botUsername = this.getVotingBotUsername(platform);
        if (!botUsername) {
          // Без username получится битый deep link (например, https://max.ru/?start=...),
          // поэтому пропускаем платформу, а не шлём админам нерабочий QR.
          logger.warn('Voting QR skipped: bot username not configured', { platform, sessionId });
          continue;
        }
        const qr = await generateVotingSessionQRForPlatforms(sessionId, platform, botUsername);
        if (!qr.qrCodeBuffer) {
          logger.error('Voting QR buffer not generated', { platform, sessionId });
          continue;
        }
        await bots.sendVotingQrToAdmins({
          sessionId,
          deepLink: qr.deepLink,
          qrPngBuffer: qr.qrCodeBuffer,
          requestedByAdminId,
        });
      } catch (error) {
        logger.error('Failed to send voting QR to admins', { platform, sessionId, error });
      }
    }
  }

  /**
   * username бота для построения deep link конкретной платформы.
   * telegram → TELEGRAM_USER_BOT_USERNAME (fallback vgulbot, как в AdminVoteController);
   * max → MAX_USER_BOT_USERNAME.
   */
  private getVotingBotUsername(platform: Platform): string {
    if (platform === 'max') {
      return normalizeMaxBotUsername(process.env.MAX_USER_BOT_USERNAME);
    }
    return normalizeTelegramBotUsername(process.env.TELEGRAM_USER_BOT_USERNAME, 'vgulbot');
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
