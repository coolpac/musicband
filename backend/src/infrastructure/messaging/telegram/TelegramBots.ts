import type { Platform } from '@prisma/client';
import { UserBot } from '../../telegram/UserBot';
import { AdminBot } from '../../telegram/AdminBot';
import { logger } from '../../../shared/utils/logger';
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

/**
 * Адаптер Telegram под интерфейс PlatformBots. Делегирует существующим UserBot/AdminBot
 * — поведение байт-в-байт совпадает с тем, что раньше делал BotManager напрямую.
 *
 * Платформенный throttling рассылок (broadcast) живёт здесь: он завязан на сырое
 * Telegram Bot API (sendPhoto/sendVideo/sendDocument/sendMessage + reply_markup) и rate-limit.
 * Разрешение аудитории/сегментов остаётся в BotManager и передаётся сюда готовым списком id.
 */
export class TelegramBots implements PlatformBots {
  readonly platform: Platform = 'telegram';

  constructor(
    private readonly userBot: UserBot,
    private readonly adminBot: AdminBot
  ) {}

  /** Telegram-боты стартуют polling в конструкторе, отдельный start не нужен. */
  start(): void {
    // no-op: polling уже запущен при создании UserBot/AdminBot
  }

  async stop(): Promise<void> {
    await Promise.all([this.userBot.stop(), this.adminBot.stop()]);
  }

  // --- user-facing ---

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
    await this.userBot.sendVotingWinnerNotification(BigInt(platformId), song, sessionId);
  }

  // --- admin-facing ---

  async notifyNewBooking(booking: NewBookingNotice): Promise<void> {
    await this.adminBot.notifyNewBooking(booking);
  }

  async notifyNewUser(user: NewUserNotice): Promise<void> {
    await this.adminBot.notifyNewUser(user);
  }

  async sendCsvToAdmin(platformId: string, csv: Buffer, filename: string): Promise<void> {
    await this.adminBot.sendCsvToAdmin(Number(platformId), csv, filename);
  }

  /** QR голосования Telegram-админам — поведение байт-в-байт прежнего AdminVoteController. */
  async sendVotingQrToAdmins(notice: VotingQrNotice): Promise<void> {
    await this.adminBot.notifyVotingQrToAdmins(notice);
  }

  /**
   * Рассылка по уже разрешённому списку получателей с throttling (~25 msg/сек).
   * Логика перенесена из BotManager.broadcastToUsers без изменения поведения.
   */
  async broadcast(platformIds: string[], payload: BroadcastPayload): Promise<BroadcastProgress> {
    const replyMarkup = this.buildBroadcastReplyMarkup(payload.buttons);

    let sent = 0;
    let failed = 0;
    const total = platformIds.length;

    if (payload.onProgress) {
      await payload.onProgress({ sent, failed, total });
    }

    const bot = this.userBot.getBot();
    for (const platformId of platformIds) {
      try {
        if (payload.media) {
          const caption = payload.text;
          if (payload.media.type === 'photo') {
            await bot.sendPhoto(platformId, payload.media.fileId, {
              caption,
              reply_markup: replyMarkup,
            });
          } else if (payload.media.type === 'video') {
            await bot.sendVideo(platformId, payload.media.fileId, {
              caption,
              reply_markup: replyMarkup,
            });
          } else {
            // document
            await bot.sendDocument(platformId, payload.media.fileId, {
              caption,
              reply_markup: replyMarkup,
            });
          }
        } else {
          await bot.sendMessage(
            platformId,
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
          logger.error('Broadcast failed', { telegramId: platformId, error });
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

  private buildBroadcastReplyMarkup(buttons: BroadcastButton[]) {
    if (!buttons.length) return undefined;

    const inlineRows: BroadcastButton[][] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineRows.push(buttons.slice(i, i + 2));
    }

    return {
      inline_keyboard: inlineRows.map((row) =>
        row.map((button) =>
          button.kind === 'web_app'
            ? { text: button.text, web_app: { url: button.url } }
            : { text: button.text, url: button.url }
        )
      ),
    };
  }
}
