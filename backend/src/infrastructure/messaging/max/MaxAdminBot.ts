import type { Platform } from '@prisma/client';
import { logger } from '../../../shared/utils/logger';
import { IUserRepository } from '../../database/repositories/UserRepository';
import { IBookingRepository } from '../../database/repositories/BookingRepository';
import { USER_ROLES } from '../../../shared/constants';
import { prisma } from '../../../config/database';
import type {
  NewBookingNotice,
  NewUserNotice,
  BroadcastButton,
  BroadcastProgress,
} from '../types';
import { MaxClient, type MaxButton } from './maxClient';
import { classifyMaxError } from './maxErrors';

type BroadcastSegment = 'all' | 'just_person' | 'organizer';

interface BroadcastDraft {
  text: string;
  buttons: BroadcastButton[];
  includeDefaultButton: boolean;
  media?: { type: 'photo' | 'video' | 'document'; fileId: string };
  segment: BroadcastSegment;
}

/** Callback, который BotManager использует для уведомления пользователя о подтверждённом бронировании. */
type OnBookingConfirmed = (payload: {
  bookingId: string;
  bookingDate: string;
  formatName?: string;
  fullName: string;
  contactValue: string;
}) => Promise<void>;

/** Callback запуска рассылки (BotManager разрешает аудиторию и шлёт через адаптер). */
type OnBroadcast = (payload: {
  text: string;
  buttons: BroadcastButton[];
  media?: { type: 'photo' | 'video' | 'document'; fileId: string };
  segment?: BroadcastSegment;
  platform?: 'telegram' | 'max' | 'both';
  onProgress?: (progress: BroadcastProgress) => Promise<void>;
}) => Promise<BroadcastProgress>;

/**
 * Админский бот Max. Зеркалит src/infrastructure/telegram/AdminBot.ts: список админов
 * (загружается из БД c platform='max', обновляется по таймеру), /start + /admin (ссылка
 * на админку), /stats (статистика бронирований), /broadcast + /broadcast_cancel (мастер
 * рассылки: сегмент → текст → кнопки → превью → отправка), confirm/cancel
 * бронирований, а также admin-facing методы PlatformBots (notifyNewBooking / notifyNewUser /
 * sendCsvToAdmin).
 *
 * DEFERRED (Phase 4 scope): интерактивный шаг прикрепления МЕДИА в мастере рассылки
 * намеренно опущен для Max. Причина: broadcast-медиа в Telegram — это file_id
 * (BroadcastMedia.fileId), который не переносится в Max. Поэтому мастер собирает только
 * текст + кнопки + сегмент (паритет с Telegram по этим полям), а поле media остаётся
 * pass-through в payload (всегда undefined). MaxBots.broadcast получит этот payload и
 * пропустит media без ошибки (лог + continue).
 *
 * Логика обработчиков вынесена в публичные методы (handleStart/handleStats/handleBroadcast/
 * handleBroadcastCancel/handleMessage/handleCallback), а в конструкторе они только привязываются
 * к bot.command/bot.on. Это позволяет тестировать поведение без реального long-poll
 * (как MaxUserBot).
 *
 * Текст сообщений скопирован из AdminBot, чтобы формулировки совпадали между платформами.
 * Состояние мастера рассылки держится в памяти этого инстанса (отдельного от Telegram),
 * поэтому пересечься с Telegram-черновиками не может.
 */
export class MaxAdminBot {
  readonly platform: Platform = 'max';

  private readonly adminMaxIds = new Set<number>();
  private readonly awaitingBroadcastText = new Set<number>();
  private readonly awaitingBroadcastButtons = new Set<number>();
  private readonly pendingBroadcasts = new Map<number, BroadcastDraft>();
  private readonly reloadTimer: NodeJS.Timeout;

  /** Интервал перезагрузки списка админов из БД (мс). */
  private static readonly ADMIN_RELOAD_INTERVAL_MS = 60_000;

  constructor(
    private readonly client: MaxClient,
    _userRepository: IUserRepository,
    private readonly bookingRepository: IBookingRepository,
    private readonly onBookingConfirmed?: OnBookingConfirmed,
    private readonly onBroadcast?: OnBroadcast
  ) {
    void this.loadAdmins();
    this.reloadTimer = setInterval(() => {
      void this.loadAdmins();
    }, MaxAdminBot.ADMIN_RELOAD_INTERVAL_MS);
    // Не держим event loop открытым из-за таймера перезагрузки админов.
    this.reloadTimer.unref?.();

    this.registerHandlers();
    logger.info('Max Admin Bot initialized');
  }

  private registerHandlers(): void {
    const bot = this.client.bot;

    bot.command('start', async (ctx) => {
      try {
        const userId = ctx.message?.sender?.user_id ?? ctx.chatId;
        if (userId) await this.handleStart(userId);
      } catch (error) {
        logger.error('Max admin: error handling /start', { error });
      }
    });

    bot.command('admin', async (ctx) => {
      try {
        const userId = ctx.message?.sender?.user_id ?? ctx.chatId;
        if (userId) await this.handleStart(userId);
      } catch (error) {
        logger.error('Max admin: error handling /admin', { error });
      }
    });

    bot.command('stats', async (ctx) => {
      try {
        const userId = ctx.message?.sender?.user_id ?? ctx.chatId;
        if (userId) await this.handleStats(userId);
      } catch (error) {
        logger.error('Max admin: error handling /stats', { error });
      }
    });

    bot.command('broadcast', async (ctx) => {
      try {
        const userId = ctx.message?.sender?.user_id ?? ctx.chatId;
        if (userId) await this.handleBroadcast(userId);
      } catch (error) {
        logger.error('Max admin: error handling /broadcast', { error });
      }
    });

    bot.command('broadcast_cancel', async (ctx) => {
      try {
        const userId = ctx.message?.sender?.user_id ?? ctx.chatId;
        if (userId) await this.handleBroadcastCancel(userId);
      } catch (error) {
        logger.error('Max admin: error handling /broadcast_cancel', { error });
      }
    });

    // Свободный текст — шаги мастера рассылки (текст / кнопки).
    bot.on('message_created', async (ctx) => {
      try {
        const userId = ctx.message?.sender?.user_id ?? ctx.chatId;
        const text = ctx.message?.body?.text;
        if (userId && typeof text === 'string') {
          await this.handleMessage(userId, text);
        }
      } catch (error) {
        logger.error('Max admin: error handling message_created', { error });
      }
    });

    // Callback-кнопки: бронирования + мастер рассылки.
    bot.on('message_callback', async (ctx) => {
      try {
        const cb = ctx.callback;
        if (!cb) return;
        await this.handleCallback(cb.user.user_id, cb.payload ?? '', cb.callback_id);
      } catch (error) {
        logger.error('Max admin: error handling message_callback', { error });
      }
    });

    bot.catch((error) => {
      logger.error('Max admin bot error', { error });
    });
  }

  /** Загрузка списка админов из БД (platform='max'), при старте и по таймеру. */
  private async loadAdmins(): Promise<void> {
    try {
      const admins = await prisma.user.findMany({
        where: { role: USER_ROLES.ADMIN, platform: 'max' },
        select: { platformId: true },
      });

      this.adminMaxIds.clear();
      admins.forEach((admin) => {
        const maxId = Number(admin.platformId);
        if (!Number.isNaN(maxId)) {
          this.adminMaxIds.add(maxId);
        }
      });

      logger.info('Max admins loaded', { count: this.adminMaxIds.size });
    } catch (error) {
      logger.error('Max: error loading admins', { error });
    }
  }

  private isAdmin(userId: number): boolean {
    return this.adminMaxIds.has(userId);
  }

  // --- handlers (тестируемы напрямую) ---

  /** /start и /admin — ссылка на админ-панель. */
  async handleStart(userId: number): Promise<void> {
    if (!this.isAdmin(userId)) {
      await this.client.sendMessage(
        userId,
        '❌ У вас нет доступа к админ-панели.\n\nОбратитесь к администратору для получения доступа.'
      );
      return;
    }
    await this.sendAdminPanelLink(userId);
  }

  /** /stats — статистика бронирований. */
  async handleStats(userId: number): Promise<void> {
    if (!this.isAdmin(userId)) {
      await this.client.sendMessage(userId, '❌ У вас нет доступа.');
      return;
    }
    const stats = await this.bookingRepository.getStats();
    const message =
      '📊 Статистика бронирований:\n\n' +
      `Всего: ${stats.total}\n` +
      `✅ Подтверждено: ${stats.confirmed}\n` +
      `⏳ Ожидает: ${stats.pending}\n` +
      `❌ Отменено: ${stats.cancelled}\n` +
      `💰 Общий доход: ${stats.totalIncome.toFixed(2)} руб.\n` +
      `📈 Конверсия: ${stats.conversionRate.toFixed(1)}%`;
    await this.client.sendMessage(userId, message);
  }

  /** /broadcast — начало мастера рассылки (выбор аудитории). */
  async handleBroadcast(userId: number): Promise<void> {
    if (!this.isAdmin(userId)) {
      await this.client.sendMessage(userId, '❌ У вас нет доступа.');
      return;
    }
    this.clearBroadcastState(userId);
    await this.sendSegmentSelection(userId);
  }

  /** /broadcast_cancel — отмена мастера рассылки. */
  async handleBroadcastCancel(userId: number): Promise<void> {
    this.clearBroadcastState(userId);
    await this.client.sendMessage(userId, 'Рассылка отменена.');
  }

  /** Свободный текст: шаги мастера рассылки (текст сообщения / список кнопок). */
  async handleMessage(userId: number, rawText: string): Promise<void> {
    if (!this.isAdmin(userId)) return;
    const text = rawText.trim();
    if (!text) return;

    if (this.awaitingBroadcastText.has(userId)) {
      this.awaitingBroadcastText.delete(userId);
      this.awaitingBroadcastButtons.delete(userId);

      const existing = this.pendingBroadcasts.get(userId);
      const draft: BroadcastDraft = existing
        ? { ...existing, text }
        : { text, buttons: [], includeDefaultButton: false, segment: 'all' };
      this.pendingBroadcasts.set(userId, draft);

      await this.sendBroadcastPreview(userId);
      return;
    }

    if (this.awaitingBroadcastButtons.has(userId)) {
      const draft = this.pendingBroadcasts.get(userId);
      if (!draft) return;

      const buttons = this.parseBroadcastButtons(text);
      if (buttons.length === 0) {
        await this.client.sendMessage(
          userId,
          'Не получилось распознать кнопки. Формат: Текст | ссылка'
        );
        return;
      }

      this.awaitingBroadcastButtons.delete(userId);
      this.pendingBroadcasts.set(userId, { ...draft, buttons });
      await this.sendBroadcastPreview(userId);
    }
  }

  /** Callback-кнопки: confirm/cancel бронирований и шаги мастера рассылки. */
  async handleCallback(userId: number, payload: string, callbackId: string): Promise<void> {
    if (!this.isAdmin(userId)) {
      await this.client.answerCallback(callbackId, { notification: '❌ У вас нет доступа.' });
      return;
    }

    if (payload === 'broadcast_cancel') {
      this.clearBroadcastState(userId);
      await this.client.answerCallback(callbackId, { notification: 'Рассылка отменена' });
      return;
    }

    if (payload.startsWith('broadcast_segment:')) {
      const segment = payload.replace('broadcast_segment:', '') as BroadcastSegment;
      this.pendingBroadcasts.set(userId, {
        text: '',
        buttons: [],
        includeDefaultButton: false,
        segment,
      });
      this.awaitingBroadcastText.add(userId);
      await this.client.answerCallback(callbackId);
      await this.client.sendMessage(
        userId,
        `👥 Аудитория: ${this.getSegmentLabel(segment)}\n\nОтправьте текст сообщения одним сообщением.`
      );
      return;
    }

    if (payload === 'broadcast_change_segment') {
      await this.client.answerCallback(callbackId);
      await this.sendSegmentSelection(userId);
      return;
    }

    if (payload === 'broadcast_buttons_yes' || payload === 'broadcast_edit_buttons') {
      const draft = this.pendingBroadcasts.get(userId);
      if (!draft) {
        await this.client.answerCallback(callbackId, { notification: 'Нет текста рассылки.' });
        return;
      }
      this.awaitingBroadcastButtons.add(userId);
      await this.client.answerCallback(callbackId);
      await this.client.sendMessage(
        userId,
        'Отправьте кнопки в формате:\n' +
          'Текст | ссылка\n' +
          'Например:\n' +
          'Связаться | https://example.com'
      );
      return;
    }

    if (payload === 'broadcast_toggle_app') {
      const draft = this.pendingBroadcasts.get(userId);
      if (!draft) {
        await this.client.answerCallback(callbackId, { notification: 'Нет текста рассылки.' });
        return;
      }
      this.pendingBroadcasts.set(userId, {
        ...draft,
        includeDefaultButton: !draft.includeDefaultButton,
      });
      await this.client.answerCallback(callbackId, {
        notification: draft.includeDefaultButton ? 'Кнопка отключена' : 'Кнопка будет добавлена',
      });
      await this.sendBroadcastPreview(userId);
      return;
    }

    if (payload === 'broadcast_edit_text') {
      const draft = this.pendingBroadcasts.get(userId);
      if (!draft) {
        await this.client.answerCallback(callbackId, { notification: 'Нет черновика рассылки.' });
        return;
      }
      this.awaitingBroadcastText.add(userId);
      await this.client.answerCallback(callbackId);
      await this.client.sendMessage(userId, 'Отправьте новый текст для рассылки одним сообщением.');
      return;
    }

    if (payload === 'broadcast_send') {
      await this.handleBroadcastSend(userId, callbackId);
      return;
    }

    const confirmPrefix = 'booking_confirm:';
    const cancelPrefix = 'booking_cancel:';
    if (payload.startsWith(confirmPrefix) || payload.startsWith(cancelPrefix)) {
      await this.handleBookingDecision(payload, callbackId);
    }
  }

  // --- broadcast wizard internals ---

  private clearBroadcastState(userId: number): void {
    this.awaitingBroadcastText.delete(userId);
    this.awaitingBroadcastButtons.delete(userId);
    this.pendingBroadcasts.delete(userId);
  }

  private async sendSegmentSelection(userId: number): Promise<void> {
    await this.client.sendMessageWithKeyboard(userId, '🗣️ Рассылка\n\nВыберите аудиторию:', [
      [{ kind: 'callback', text: '📢 Все пользователи', payload: 'broadcast_segment:all' }],
      [{ kind: 'callback', text: '👤 Физлица', payload: 'broadcast_segment:just_person' }],
      [{ kind: 'callback', text: '🎤 Организаторы', payload: 'broadcast_segment:organizer' }],
      [{ kind: 'callback', text: '❌ Отмена', payload: 'broadcast_cancel' }],
    ]);
  }

  private async sendBroadcastPreview(userId: number): Promise<void> {
    const draft = this.pendingBroadcasts.get(userId);
    if (!draft) return;

    const rows: MaxButton[][] = [
      [{ kind: 'callback', text: '🚀 Отправить', payload: 'broadcast_send' }],
      [
        { kind: 'callback', text: '✏️ Изменить текст', payload: 'broadcast_edit_text' },
        { kind: 'callback', text: '➕ Кнопки', payload: 'broadcast_buttons_yes' },
      ],
      [
        {
          kind: 'callback',
          text: draft.includeDefaultButton ? '📱 Кнопка приложения: ВКЛ' : '📱 Кнопка приложения: ВЫКЛ',
          payload: 'broadcast_toggle_app',
        },
      ],
      [{ kind: 'callback', text: '👥 Изменить аудиторию', payload: 'broadcast_change_segment' }],
      [{ kind: 'callback', text: '❌ Отмена', payload: 'broadcast_cancel' }],
    ];

    await this.client.sendMessageWithKeyboard(userId, this.buildBroadcastPreview(draft), rows);
  }

  private buildBroadcastPreview(draft: BroadcastDraft): string {
    const segmentLine = `👥 Аудитория: ${this.getSegmentLabel(draft.segment)}`;

    const buttonLines: string[] = [];
    draft.buttons.forEach((button) =>
      buttonLines.push(`• ${button.text} → ${button.url}`)
    );
    if (draft.includeDefaultButton) {
      buttonLines.push('• Открыть приложение');
    }
    if (buttonLines.length === 0) {
      buttonLines.push('• — нет');
    }

    return `Черновик рассылки:\n\n${segmentLine}\n\n${draft.text}\n\nКнопки:\n${buttonLines.join('\n')}`;
  }

  private async handleBroadcastSend(userId: number, callbackId: string): Promise<void> {
    const draft = this.pendingBroadcasts.get(userId);
    if (!draft) {
      await this.client.answerCallback(callbackId, { notification: 'Нет черновика рассылки.' });
      return;
    }
    if (!this.onBroadcast) {
      await this.client.answerCallback(callbackId, { notification: 'Рассылка недоступна.' });
      return;
    }

    const finalButtons: BroadcastButton[] = [
      ...draft.buttons,
      ...(draft.includeDefaultButton
        ? [{ text: 'Открыть приложение', url: this.getMiniAppUrl(), kind: 'web_app' as const }]
        : []),
    ];

    await this.client.answerCallback(callbackId, { notification: 'Запускаю рассылку...' });
    this.pendingBroadcasts.delete(userId);

    const result = await this.onBroadcast({
      text: draft.text,
      buttons: finalButtons,
      // media — pass-through (всегда undefined: медиа-шаг для Max отложен, см. docstring класса).
      media: draft.media,
      segment: draft.segment,
    });

    await this.client.sendMessage(
      userId,
      `✅ Рассылка завершена\n\nОтправлено: ${result.sent}\nОшибок: ${result.failed}`
    );
  }

  private parseBroadcastButtons(input: string): BroadcastButton[] {
    const lines = input
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const buttons: BroadcastButton[] = [];

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 2) continue;
      const text = parts[0].trim();
      const rawUrl = parts.slice(1).join('|').trim();
      if (!text || !rawUrl) continue;

      const url = this.normalizeBroadcastUrl(rawUrl);
      if (!url) continue;

      buttons.push({ text, url, kind: 'url' });
      if (buttons.length >= 8) break;
    }

    return buttons;
  }

  private normalizeBroadcastUrl(rawUrl: string): string | null {
    const value = rawUrl.trim();
    if (!value) return null;
    if (value.startsWith('https://') || value.startsWith('http://')) return value;
    if (value === 'app' || value === 'miniapp') return this.getMiniAppUrl();
    return null;
  }

  private getSegmentLabel(segment: BroadcastSegment): string {
    switch (segment) {
      case 'all':
        return '📢 Все пользователи';
      case 'just_person':
        return '👤 Физлица';
      case 'organizer':
        return '🎤 Организаторы';
      default:
        return '📢 Все';
    }
  }

  // --- booking decision ---

  private async handleBookingDecision(payload: string, callbackId: string): Promise<void> {
    const confirmPrefix = 'booking_confirm:';
    const cancelPrefix = 'booking_cancel:';
    const isConfirm = payload.startsWith(confirmPrefix);
    const bookingId = payload.replace(confirmPrefix, '').replace(cancelPrefix, '');

    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      await this.client.answerCallback(callbackId, { notification: '❌ Заявка не найдена.' });
      return;
    }

    if (booking.status !== 'pending') {
      const statusLabel =
        booking.status === 'confirmed' ? '✅ Уже подтверждена' : '❌ Уже отменена';
      await this.client.answerCallback(callbackId, { notification: statusLabel });
      return;
    }

    await this.bookingRepository.updateStatus(bookingId, isConfirm ? 'confirmed' : 'cancelled');

    if (isConfirm && this.onBookingConfirmed) {
      await this.onBookingConfirmed({
        bookingId: booking.id,
        bookingDate: booking.bookingDate.toISOString().split('T')[0],
        formatName: booking.format?.name || 'Не указан',
        fullName: booking.fullName,
        contactValue: booking.contactValue,
      });
    }

    await this.client.answerCallback(callbackId, {
      notification: isConfirm ? '✅ Заявка подтверждена' : '❌ Заявка отменена',
    });
  }

  // --- helpers ---

  private getAdminPanelUrl(): string {
    return process.env.ADMIN_PANEL_URL || process.env.FRONTEND_URL || 'https://your-domain.com/admin';
  }

  private getMiniAppUrl(): string {
    return process.env.MINI_APP_URL || process.env.FRONTEND_URL || 'https://your-domain.com';
  }

  private async sendAdminPanelLink(userId: number): Promise<void> {
    const adminUrl = this.getAdminPanelUrl();
    await this.client.sendMessageWithKeyboard(
      userId,
      '🔐 Админ-панель\n\nИспользуйте кнопку ниже для входа в админ-панель:\n\n' + `${adminUrl}`,
      [[{ kind: 'link', text: '🔗 Открыть админ-панель', url: adminUrl }]]
    );
  }

  // --- PlatformBots admin-facing methods ---

  async notifyNewBooking(bookingData: NewBookingNotice): Promise<void> {
    const message =
      '📅 Новое бронирование:\n\n' +
      `🆔 ID заявки: ${bookingData.id}\n` +
      `📅 Дата: ${bookingData.bookingDate}\n` +
      (bookingData.formatName ? `🎤 Формат: ${bookingData.formatName}\n` : '') +
      `👤 Имя из формы: ${bookingData.fullName}\n` +
      `📞 Контакт: ${bookingData.contactValue}\n` +
      (bookingData.city ? `📍 Город: ${bookingData.city}\n` : '') +
      (bookingData.username ? `👤 Username: @${bookingData.username}\n` : '') +
      (bookingData.firstName || bookingData.lastName
        ? `📋 Имя: ${[bookingData.firstName, bookingData.lastName].filter(Boolean).join(' ')}\n`
        : '');

    const rows: MaxButton[][] = [
      [
        { kind: 'callback', text: '✅ Подтвердить', payload: `booking_confirm:${bookingData.id}` },
        { kind: 'callback', text: '❌ Отменить', payload: `booking_cancel:${bookingData.id}` },
      ],
      [{ kind: 'link', text: '🔗 Открыть админ-панель', url: this.getAdminPanelUrl() }],
    ];

    for (const adminId of this.adminMaxIds) {
      try {
        await this.client.sendMessageWithKeyboard(adminId, message, rows);
      } catch (err: unknown) {
        const info = classifyMaxError(err);
        if (!info.isUserUnreachable) {
          logger.error('Max: error sending new booking notification', { error: err, adminId });
        }
      }
    }
  }

  async notifyNewUser(userData: NewUserNotice): Promise<void> {
    const message =
      '👤 Новый пользователь зарегистрировался:\n\n' +
      `🆔 ID: ${userData.platformId}\n` +
      (userData.username ? `👤 Username: @${userData.username}\n` : '') +
      (userData.firstName || userData.lastName
        ? `📝 Имя: ${userData.firstName || ''} ${userData.lastName || ''}\n`
        : '');

    for (const adminId of this.adminMaxIds) {
      try {
        await this.client.sendMessage(adminId, message);
      } catch (err: unknown) {
        const info = classifyMaxError(err);
        if (!info.isUserUnreachable) {
          logger.error('Max: error sending new user notification', { error: err, adminId });
        }
      }
    }
  }

  /**
   * Отправка QR-кода сессии голосования всем админам Max (зеркало
   * AdminBot.notifyVotingQrToAdmins). QR кодирует max.ru-ссылку, поэтому шлётся
   * именно Max-админам. Изображение загружается и отправляется через
   * MaxClient.uploadAndSendImage; deepLink дублируется в подписи и в link-кнопке.
   */
  async notifyVotingQrToAdmins(payload: {
    sessionId: string;
    deepLink: string;
    qrPngBuffer: Buffer;
    requestedByAdminId?: string;
  }): Promise<void> {
    const caption =
      '🗳️ QR-код для голосования\n\n' +
      `Сессия: ${payload.sessionId}\n` +
      `Ссылка: ${payload.deepLink}\n` +
      (payload.requestedByAdminId ? `Инициатор: #${payload.requestedByAdminId}` : '');

    const rows: MaxButton[][] = [[{ kind: 'link', text: 'Открыть ссылку', url: payload.deepLink }]];

    for (const adminId of this.adminMaxIds) {
      try {
        await this.client.uploadAndSendImage(adminId, payload.qrPngBuffer, caption, rows);
      } catch (err: unknown) {
        const info = classifyMaxError(err);
        if (!info.isUserUnreachable) {
          logger.error('Max: error sending voting QR to admin', {
            error: err,
            adminId,
            sessionId: payload.sessionId,
          });
        }
      }
    }
  }

  /**
   * Отправка CSV-экспорта администратору. В Max Bot API (через MaxClient) нет хелпера
   * для отправки документов, поэтому CSV вкладывается в текст сообщения.
   */
  async sendCsvToAdmin(platformId: string, csv: Buffer, filename: string): Promise<void> {
    const content = csv.toString('utf8');
    await this.client.sendMessage(
      Number(platformId),
      `📊 Экспорт: ${filename}\n\n${content}`
    );
  }

  /** Обновление списка админов (для внешнего вызова). */
  async refreshAdmins(): Promise<void> {
    await this.loadAdmins();
  }

  /** Запуск long-poll (делегирует MaxClient). */
  async start(): Promise<void> {
    await this.client.start();
  }

  /** Остановка long-poll. */
  stop(): void {
    clearInterval(this.reloadTimer);
    this.client.stop();
  }
}
