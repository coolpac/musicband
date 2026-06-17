import type { Platform } from '@prisma/client';
import { logger } from '../../../shared/utils/logger';
import { ReferralService } from '../../../domain/services/ReferralService';
import { IUserRepository } from '../../database/repositories/UserRepository';
import { IBookingRepository } from '../../database/repositories/BookingRepository';
import { IOnboardingRepository } from '../../database/repositories/OnboardingRepository';
import type {
  PlatformBots,
  BookingNotice,
  NewBookingNotice,
  NewUserNotice,
  SongNotice,
  ReviewNotice,
  ReviewRequestResult,
  BroadcastPayload,
  BroadcastProgress,
  BatchSendResult,
  BroadcastButton,
  VotingQrNotice,
} from '../types';
import { MaxClient, type MaxButton, type MessageAttachment } from './maxClient';
import { MaxUserBot } from './MaxUserBot';
import { MaxAdminBot } from './MaxAdminBot';
import { classifyMaxError } from './maxErrors';

/** Колбэк подтверждения брони (зеркало BotManager.notifyBookingConfirmed). */
type OnBookingConfirmed = (payload: {
  bookingId: string;
  bookingDate: string;
  formatName?: string;
  fullName: string;
  contactValue: string;
}) => Promise<void>;

/** Колбэк запуска рассылки (зеркало BotManager.broadcastToUsers). */
type OnBroadcast = (payload: {
  text: string;
  buttons: BroadcastButton[];
  media?: { type: 'photo' | 'video' | 'document'; fileId: string };
  segment?: 'all' | 'just_person' | 'organizer';
  onProgress?: (progress: BroadcastProgress) => Promise<void>;
}) => Promise<BroadcastProgress>;

export interface MaxBotsDeps {
  referralService: ReferralService;
  userRepository: IUserRepository;
  bookingRepository: IBookingRepository;
  onboardingRepository: IOnboardingRepository;
  onBookingConfirmed?: OnBookingConfirmed;
  onBroadcast?: OnBroadcast;
}

/** Меню команд пользовательского бота Max (для setMyCommands). */
const USER_COMMANDS = [
  { name: 'start', description: 'Начать' },
  { name: 'help', description: 'Помощь' },
];

/** Меню команд админского бота Max (для setMyCommands). */
const ADMIN_COMMANDS = [
  { name: 'start', description: 'Админ-панель' },
  { name: 'admin', description: 'Админ-панель' },
  { name: 'stats', description: 'Статистика' },
  { name: 'broadcast', description: 'Рассылка' },
  { name: 'broadcast_cancel', description: 'Отменить рассылку' },
];

/**
 * Адаптер Max под интерфейс PlatformBots. Зеркалит структуру
 * src/infrastructure/messaging/telegram/TelegramBots.ts, но владеет двумя
 * собственными MaxClient (user-токен и admin-токен) и оборачивающими их
 * MaxUserBot / MaxAdminBot.
 *
 * Отличие от Telegram: long-poll Max стартует НЕ в конструкторе ботов, а в
 * MaxBots.start() (через MaxClient.start(), который запускает poll fire-and-forget
 * и резолвится сразу). Поэтому start() здесь регистрирует команды и стартует оба
 * клиента, не подвисая на бесконечном poll-loop.
 *
 * Платформенный throttling рассылок (broadcast) живёт здесь, как и в TelegramBots.
 * Аудиторию/сегменты по-прежнему разрешает BotManager и передаёт готовый список id.
 *
 * Медиа: photo/video доставляются на Max (uploadImage/uploadVideo по БАЙТАМ, которые
 * BotManager скачивает из Telegram file_id и кладёт в payload.mediaBuffer). Документы и
 * случаи отсутствия байтов — фолбэк на текст + кнопки, без ошибки.
 */
export class MaxBots implements PlatformBots {
  readonly platform: Platform = 'max';

  private readonly userClient: MaxClient;
  private readonly adminClient: MaxClient;
  private readonly userBot: MaxUserBot;
  private readonly adminBot: MaxAdminBot;

  constructor(userClient: MaxClient, adminClient: MaxClient, deps: MaxBotsDeps) {
    this.userClient = userClient;
    this.adminClient = adminClient;

    this.userBot = new MaxUserBot(userClient, deps.referralService, deps.onboardingRepository);
    this.adminBot = new MaxAdminBot(
      adminClient,
      deps.userRepository,
      deps.bookingRepository,
      deps.onBookingConfirmed,
      deps.onBroadcast
    );
  }

  /** Фабрика из токенов (для BotManager): создаёт оба MaxClient и собирает адаптер. */
  static fromTokens(userToken: string, adminToken: string, deps: MaxBotsDeps): MaxBots {
    return new MaxBots(MaxClient.fromToken(userToken), MaxClient.fromToken(adminToken), deps);
  }

  /**
   * Регистрирует меню команд и запускает long-poll обоих ботов. Резолвится быстро и
   * НЕ блокируется на poll-loop: MaxClient.start() сам по себе fire-and-forget (резолвится
   * сразу), но мы дополнительно НЕ ждём его завершения (start() запускается без await),
   * чтобы MaxBots.start() гарантированно резолвился, даже если клиентский старт повиснет.
   */
  async start(): Promise<void> {
    try {
      await this.userClient.setMyCommands(USER_COMMANDS);
      await this.adminClient.setMyCommands(ADMIN_COMMANDS);
    } catch (error) {
      // Команды — не критично для приёма апдейтов; логируем и продолжаем со стартом poll.
      logger.error('Max: failed to set command menus', { error });
    }

    // Fire-and-forget: poll-loop (через MaxClient.start) не должен блокировать инициализацию.
    void Promise.resolve(this.userClient.start()).catch((error: unknown) => {
      logger.error('Max: user bot poll-loop terminated', { error });
    });
    void Promise.resolve(this.adminClient.start()).catch((error: unknown) => {
      logger.error('Max: admin bot poll-loop terminated', { error });
    });
    logger.info('Max bots started');
  }

  /**
   * Остановка обоих ботов (graceful shutdown). Делегируем внутренним ботам, а не
   * клиентам напрямую: MaxAdminBot.stop() помимо client.stop() очищает таймер
   * перезагрузки списка админов (иначе он остаётся висеть).
   */
  async stop(): Promise<void> {
    await Promise.all([
      Promise.resolve(this.userBot.stop()),
      Promise.resolve(this.adminBot.stop()),
    ]);
  }

  // --- user-facing → MaxUserBot ---

  async sendBookingReceived(platformId: string, booking: BookingNotice): Promise<void> {
    await this.userBot.sendBookingReceived(platformId, booking);
  }

  async sendBookingConfirmation(platformId: string, booking: BookingNotice): Promise<void> {
    await this.userBot.sendBookingConfirmation(platformId, booking);
  }

  async sendReviewRequest(platformId: string, review: ReviewNotice): Promise<ReviewRequestResult> {
    return this.userBot.sendReviewRequest(platformId, review);
  }

  async sendVotingFollowUp(platformIds: string[], campaignDay: number): Promise<BatchSendResult> {
    return this.userBot.sendVotingFollowUp(platformIds, campaignDay);
  }

  async sendVotingWinner(platformId: string, song: SongNotice, sessionId: string): Promise<void> {
    await this.userBot.sendVotingWinner(platformId, song, sessionId);
  }

  // --- admin-facing → MaxAdminBot ---

  async notifyNewBooking(booking: NewBookingNotice): Promise<void> {
    await this.adminBot.notifyNewBooking(booking);
  }

  async notifyNewUser(user: NewUserNotice): Promise<void> {
    await this.adminBot.notifyNewUser(user);
  }

  async sendCsvToAdmin(platformId: string, csv: Buffer, filename: string): Promise<void> {
    await this.adminBot.sendCsvToAdmin(platformId, csv, filename);
  }

  /** QR голосования Max-админам (QR кодирует max.ru-ссылку, построенную BotManager). */
  async sendVotingQrToAdmins(notice: VotingQrNotice): Promise<void> {
    await this.adminBot.notifyVotingQrToAdmins(notice);
  }

  /**
   * Рассылка по уже разрешённому списку получателей с throttling (~25 msg/сек),
   * как в TelegramBots.broadcast. Отправляет ТЕКСТ + КНОПКИ, а при наличии
   * payload.mediaUrl (photo/video) — ещё и медиа (грузится в Max один раз и
   * переиспользуется для всех получателей).
   */
  async broadcast(platformIds: string[], payload: BroadcastPayload): Promise<BroadcastProgress> {
    const buttonRows = this.buildBroadcastButtonRows(payload.buttons);

    // Медиа: photo/video Max умеет (uploadImage/uploadVideo по байтам). Грузим ОДИН раз
    // и переиспользуем вложение для всех получателей. Документы Max-клиент не грузит —
    // как и при отсутствии байтов, откатываемся на текст+кнопки.
    let mediaAttachment: MessageAttachment | undefined;
    if (payload.media) {
      const kind: 'image' | 'video' | null =
        payload.media.type === 'photo' ? 'image' : payload.media.type === 'video' ? 'video' : null;
      if (kind === null) {
        // Документ намеренно не поддержан на Max (нет аплоада документов в клиенте).
        logger.warn('Max: broadcast document not supported, sending text only', {
          mediaType: payload.media.type,
        });
      } else if (!payload.mediaBuffer) {
        logger.warn('Max: broadcast media has no bytes, sending text only', {
          mediaType: payload.media.type,
        });
      } else {
        try {
          // Грузим именно БАЙТЫ (Buffer): Max-SDK трактует строковый source как путь в
          // ФС, поэтому URL/file_id сюда передавать нельзя — только буфер.
          mediaAttachment = await this.userClient.uploadMediaAttachment(kind, payload.mediaBuffer);
        } catch (error) {
          logger.error('Max: broadcast media upload failed, sending text only', {
            mediaType: payload.media.type,
            error,
          });
        }
      }
    }

    let sent = 0;
    let failed = 0;
    const total = platformIds.length;

    if (payload.onProgress) {
      await payload.onProgress({ sent, failed, total });
    }

    for (const platformId of platformIds) {
      try {
        if (mediaAttachment) {
          await this.userClient.sendMessageWithAttachments(
            Number(platformId),
            payload.text,
            [mediaAttachment],
            buttonRows.length ? buttonRows : undefined
          );
        } else if (buttonRows.length) {
          await this.userClient.sendMessageWithKeyboard(
            Number(platformId),
            payload.text,
            buttonRows
          );
        } else {
          await this.userClient.sendMessage(Number(platformId), payload.text);
        }
        sent++;
      } catch (err: unknown) {
        failed++;
        const info = classifyMaxError(err);
        if (!info.isUserUnreachable) {
          logger.error('Max broadcast failed', { platformId, error: err });
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

    return { sent, failed, total };
  }

  private buildBroadcastButtonRows(buttons: BroadcastButton[]): MaxButton[][] {
    if (!buttons.length) return [];
    const rows: MaxButton[][] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(
        buttons.slice(i, i + 2).map((button) => ({
          kind: 'link' as const,
          text: button.text,
          url: button.url,
        }))
      );
    }
    return rows;
  }
}
