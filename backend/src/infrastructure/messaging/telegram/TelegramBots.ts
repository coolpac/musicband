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

    // Медиа в мастере загружается в ADMIN-бота, а рассылка идёт через USER-бота.
    // Передавать user-боту чужой идентификатор/ссылку нельзя: admin-овый file_id он не
    // примет ("wrong file identifier"), а api.telegram.org/file/...-URL Telegram при
    // sendPhoto отвергает ("wrong type of the web page content"). Поэтому первому
    // получателю шлём БАЙТЫ (Buffer), из ответа берём УЖЕ user-бот-овый file_id и
    // переиспользуем его (строкой) для остальных — без повторной загрузки.
    let mediaSource: Buffer | string | undefined;
    let mediaFilename: string | undefined;
    if (payload.media) {
      // BotManager обычно скачивает байты заранее (один раз на все платформы) и кладёт
      // в payload.mediaBuffer. Если их нет (прямой вызов адаптера) — скачиваем сами.
      if (payload.mediaBuffer) {
        mediaSource = payload.mediaBuffer;
        mediaFilename = payload.mediaFilename;
      } else {
        const resolved = await this.resolveMediaBuffer(payload.media.fileId);
        if (resolved) {
          mediaSource = resolved.buffer;
          mediaFilename = resolved.filename;
        }
      }
    }
    // contentType из расширения: явно заданный тип отключает авто-детект в
    // node-telegram-bot-api (иначе для нераспознанного буфера он кидает
    // "Unsupported Buffer file-type"). filename без contentType — авто-детект.
    const fileOptions: { filename?: string; contentType?: string } | undefined = mediaFilename
      ? { filename: mediaFilename, contentType: TelegramBots.contentTypeForFilename(mediaFilename) }
      : undefined;

    // Если отправка БАЙТОВ первому получателю не прошла — медиа недоставляемо
    // (битый буфер/неподдерживаемый тип). Отключаем медиа и дошлём всем текст,
    // чтобы рассылка не падала целиком на каждом получателе (как было в проде: 48/48).
    let mediaDisabled = false;
    for (const platformId of platformIds) {
      try {
        let delivered = false;
        if (payload.media && mediaSource && !mediaDisabled) {
          const caption = payload.text;
          const opts = { caption, reply_markup: replyMarkup };
          const isBuffer = Buffer.isBuffer(mediaSource);
          // fileOptions нужен только при отправке буфера; для file_id (строка) — нет.
          const fopts = isBuffer ? fileOptions : undefined;
          try {
            let result: import('node-telegram-bot-api').Message;
            if (payload.media.type === 'photo') {
              result = await bot.sendPhoto(platformId, mediaSource, opts, fopts);
            } else if (payload.media.type === 'video') {
              result = await bot.sendVideo(platformId, mediaSource, opts, fopts);
            } else {
              result = await bot.sendDocument(platformId, mediaSource, opts, fopts);
            }
            // Переиспользуем user-бот-овый file_id для следующих получателей.
            const reusable = TelegramBots.extractFileId(payload.media.type, result);
            if (reusable) mediaSource = reusable;
            delivered = true;
          } catch (mediaError) {
            if (isBuffer) {
              // Упала первая отправка байтов → медиа битое/неподдерживаемое: глушим
              // медиа для всех, текущему получателю ниже уйдёт текст.
              logger.error('Broadcast: media undeliverable, falling back to text for all', {
                error: mediaError,
                mediaType: payload.media.type,
              });
              mediaDisabled = true;
            } else {
              // file_id уже работал раньше — это пер-юзерная ошибка (403 и т.п.).
              throw mediaError;
            }
          }
        }
        if (!delivered) {
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

  /**
   * Скачать байты медиа по Telegram file_id через admin-бота (getFileLink → fetch).
   * Используется BotManager один раз на рассылку: байты затем грузятся и в Telegram
   * (user-бот), и в Max. Возвращаем буфер + имя файла; undefined при любом сбое.
   *
   * Почему байты, а не URL: Telegram при sendPhoto-по-URL отвергает собственные
   * api.telegram.org/file/...-ссылки ("wrong type of the web page content"), а
   * Max-SDK трактует строковый source как путь в ФС (fs.stat → ENOENT). Буфер берут оба.
   */
  /** Лимит на медиа рассылки: Telegram-боты всё равно не отправляют файлы >50 МБ. */
  private static readonly MEDIA_MAX_BYTES = 50 * 1024 * 1024;
  /** Таймаут на скачивание медиа (зависший CDN не должен вешать всю рассылку). */
  private static readonly MEDIA_FETCH_TIMEOUT_MS = 30_000;
  /** Сколько всего попыток скачать (на транзиентные 429/5xx/сетевые сбои). */
  private static readonly MEDIA_FETCH_ATTEMPTS = 3;

  async resolveMediaBuffer(
    fileId: string
  ): Promise<{ buffer: Buffer; filename: string } | undefined> {
    let url: string;
    try {
      url = await this.adminBot.getBot().getFileLink(fileId);
    } catch (error) {
      logger.warn('Broadcast: failed to resolve media file link via admin bot', { error, fileId });
      return undefined;
    }

    for (let attempt = 1; attempt <= TelegramBots.MEDIA_FETCH_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TelegramBots.MEDIA_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          const transient = res.status === 429 || res.status >= 500;
          logger.warn('Broadcast: media download returned non-OK', {
            fileId,
            status: res.status,
            attempt,
            willRetry: transient && attempt < TelegramBots.MEDIA_FETCH_ATTEMPTS,
          });
          if (transient && attempt < TelegramBots.MEDIA_FETCH_ATTEMPTS) continue;
          return undefined;
        }
        // Защита по размеру: не тянем гигантский файл в память.
        const declared = Number(res.headers.get('content-length') ?? '0');
        if (declared > TelegramBots.MEDIA_MAX_BYTES) {
          logger.warn('Broadcast: media too large, sending text only', { fileId, bytes: declared });
          return undefined;
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length === 0) {
          logger.warn('Broadcast: media download empty, sending text only', { fileId });
          return undefined;
        }
        if (buffer.length > TelegramBots.MEDIA_MAX_BYTES) {
          logger.warn('Broadcast: media exceeds size limit after download, text only', {
            fileId,
            bytes: buffer.length,
          });
          return undefined;
        }
        let filename = 'broadcast';
        try {
          const base = new URL(url).pathname.split('/').pop();
          if (base) filename = base;
        } catch {
          /* keep default */
        }
        return { buffer, filename };
      } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError';
        logger.warn('Broadcast: media download failed', { fileId, attempt, aborted, error });
        if (attempt >= TelegramBots.MEDIA_FETCH_ATTEMPTS) return undefined;
      } finally {
        clearTimeout(timer);
      }
    }
    return undefined;
  }

  /**
   * MIME по расширению имени файла (имя берётся из Telegram file_path, расширение
   * корректное). Явный contentType отключает авто-детект в node-telegram-bot-api,
   * который для нераспознанного буфера кидает "Unsupported Buffer file-type".
   * Неизвестное расширение → undefined (пусть библиотека пытается определить сама).
   */
  private static contentTypeForFilename(filename: string): string | undefined {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'pdf':
        return 'application/pdf';
      default:
        return undefined;
    }
  }

  /** user-бот-овый file_id из ответа sendPhoto/Video/Document — для переиспользования. */
  private static extractFileId(
    type: 'photo' | 'video' | 'document',
    message: import('node-telegram-bot-api').Message | undefined
  ): string | undefined {
    if (!message) return undefined;
    if (type === 'photo') {
      const sizes = message.photo;
      return sizes && sizes.length ? sizes[sizes.length - 1].file_id : undefined;
    }
    if (type === 'video') return message.video?.file_id;
    return message.document?.file_id;
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
