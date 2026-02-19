import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../shared/utils/logger';
import { runAsync } from '../../shared/utils/asyncHandler';
import { getTelegramErrorCode } from '../../shared/utils/telegramErrors';
import { IUserRepository } from '../database/repositories/UserRepository';
import { IBookingRepository } from '../database/repositories/BookingRepository';
import { USER_ROLES } from '../../shared/constants';
import { prisma } from '../../config/database';

export class AdminBot {
  private bot: TelegramBot;
  private bookingRepository: IBookingRepository;
  private adminTelegramIds: Set<number>;
  private onBookingConfirmed?: (payload: {
    bookingId: string;
    bookingDate: string;
    formatName?: string;
    fullName: string;
    contactValue: string;
  }) => Promise<void>;
  private awaitingBroadcastText: Set<number>;
  private awaitingBroadcastButtons: Set<number>;
  private awaitingBroadcastMedia: Set<number>;
  private pendingBroadcasts: Map<
    number,
    {
      text: string;
      buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }>;
      includeDefaultButton: boolean;
      media?: { type: 'photo' | 'video'; fileId: string };
    }
  >;
  private onBroadcast?: (payload: {
    text: string;
    buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }>;
    media?: { type: 'photo' | 'video'; fileId: string };
    onProgress?: (progress: { sent: number; failed: number; total: number }) => Promise<void>;
  }) => Promise<{ sent: number; failed: number; total: number }>;
  private chatsWithKeyboard: Set<number>;

  private static readonly BUTTON_LABELS = {
    adminPanel: '🔗 Админка',
    stats: '📊 Статистика',
    broadcast: '🗣️ Рассылка',
    refreshAdmins: '🔄 Обновить админов',
    help: 'ℹ️ Помощь',
  } as const;

  private static readonly KEYBOARD_LAYOUT: string[][] = [
    [AdminBot.BUTTON_LABELS.adminPanel, AdminBot.BUTTON_LABELS.stats],
    [AdminBot.BUTTON_LABELS.broadcast, AdminBot.BUTTON_LABELS.refreshAdmins],
    [AdminBot.BUTTON_LABELS.help],
  ];

  /** Интервал перезагрузки списка админов из БД (мс). После UPDATE в БД новые админы подхватятся без рестарта. */
  private static readonly ADMIN_RELOAD_INTERVAL_MS = 60_000;

  constructor(
    token: string,
    _userRepository: IUserRepository,
    bookingRepository: IBookingRepository,
    onBookingConfirmed?: (payload: {
      bookingId: string;
      bookingDate: string;
      formatName?: string;
      fullName: string;
      contactValue: string;
    }) => Promise<void>,
    onBroadcast?: (payload: {
      text: string;
      buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }>;
      onProgress?: (progress: { sent: number; failed: number; total: number }) => Promise<void>;
    }) => Promise<{ sent: number; failed: number; total: number }>
  ) {
    this.bot = new TelegramBot(token, { polling: true });
    this.bookingRepository = bookingRepository;
    this.adminTelegramIds = new Set();
    this.onBookingConfirmed = onBookingConfirmed;
    this.awaitingBroadcastText = new Set();
    this.awaitingBroadcastButtons = new Set();
    this.awaitingBroadcastMedia = new Set();
    this.pendingBroadcasts = new Map();
    this.onBroadcast = onBroadcast;
    this.chatsWithKeyboard = new Set();

    void this.loadAdmins();
    setInterval(() => {
      void this.loadAdmins();
    }, AdminBot.ADMIN_RELOAD_INTERVAL_MS);
    this.setupCommands();
    this.setupCallbacks();

    logger.info('Admin Bot initialized');
  }

  /**
   * Загрузка списка админов из БД (вызывается при старте и по таймеру).
   */
  private async loadAdmins(): Promise<void> {
    try {
      const admins = await prisma.user.findMany({
        where: { role: USER_ROLES.ADMIN },
        select: { telegramId: true },
      });

      this.adminTelegramIds.clear();
      admins.forEach((admin) => {
        const telegramId = Number(admin.telegramId);
        if (!isNaN(telegramId)) {
          this.adminTelegramIds.add(telegramId);
        }
      });

      logger.info('Admins loaded', { count: this.adminTelegramIds.size });
    } catch (error) {
      logger.error('Error loading admins', { error });
    }
  }

  /**
   * Проверка, является ли пользователь админом
   */
  private isAdmin(telegramId: number): boolean {
    return this.adminTelegramIds.has(telegramId);
  }

  /**
   * Настройка команд
   */
  private setupCommands(): void {
    // Команда /start - ссылка на админку
    this.bot.onText(
      /\/start/,
      runAsync(async (msg) => {
        try {
          const chatId = msg.chat.id;
          const telegramId = msg.from?.id;

          if (!telegramId || !this.isAdmin(telegramId)) {
            await this.bot.sendMessage(
              chatId,
              '❌ У вас нет доступа к админ-панели.\n\nОбратитесь к администратору для получения доступа.'
            );
            return;
          }

          await this.sendAdminMenu(chatId);
          await this.sendAdminPanelLink(chatId);
        } catch (error) {
          logger.error('Error handling /start command', { error, chatId: msg.chat.id });
        }
      })
    );

    // Команда /admin - получение ссылки на админку
    this.bot.onText(
      /\/admin/,
      runAsync(async (msg) => {
        try {
          const chatId = msg.chat.id;
          const telegramId = msg.from?.id;

          if (!telegramId || !this.isAdmin(telegramId)) {
            await this.bot.sendMessage(chatId, '❌ У вас нет доступа.');
            return;
          }

          await this.sendAdminMenu(chatId);
          await this.sendAdminPanelLink(chatId, { compact: true });
        } catch (error) {
          logger.error('Error handling /admin command', { error, chatId: msg.chat.id });
        }
      })
    );

    // Команда /stats - статистика
    this.bot.onText(
      /\/stats/,
      runAsync(async (msg) => {
        try {
          const chatId = msg.chat.id;
          const telegramId = msg.from?.id;

          if (!telegramId || !this.isAdmin(telegramId)) {
            await this.bot.sendMessage(chatId, '❌ У вас нет доступа.');
            return;
          }

          // Получаем статистику
          await this.sendStatsMessage(chatId);
        } catch (error) {
          logger.error('Error handling /stats command', { error, chatId: msg.chat.id });
        }
      })
    );

    this.bot.onText(
      /\/broadcast$/,
      runAsync(async (msg) => {
        try {
          const chatId = msg.chat.id;
          const telegramId = msg.from?.id;

          if (!telegramId || !this.isAdmin(telegramId)) {
            await this.bot.sendMessage(chatId, '❌ У вас нет доступа.');
            return;
          }

          await this.initiateBroadcastFlow(chatId, telegramId);
        } catch (error) {
          logger.error('Error handling /broadcast command', { error, chatId: msg.chat.id });
        }
      })
    );

    this.bot.onText(
      /\/broadcast_cancel$/,
      runAsync(async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;
        this.awaitingBroadcastText.delete(telegramId);
        this.awaitingBroadcastButtons.delete(telegramId);
        this.awaitingBroadcastMedia.delete(telegramId);
        this.pendingBroadcasts.delete(telegramId);
        await this.bot.sendMessage(chatId, 'Рассылка отменена.');
      })
    );

    this.bot.on(
      'message',
      runAsync(async (msg) => {
        try {
          const chatId = msg.chat.id;
          const telegramId = msg.from?.id;
          if (!telegramId || !this.isAdmin(telegramId)) return;
          const textContent = msg.text?.trim();

          if (textContent && this.awaitingBroadcastText.has(telegramId)) {
            this.awaitingBroadcastText.delete(telegramId);
            this.awaitingBroadcastButtons.delete(telegramId);
            this.awaitingBroadcastMedia.delete(telegramId);

            const existing = this.pendingBroadcasts.get(telegramId);
            const nextDraft = existing
              ? {
                  ...existing,
                  text: textContent,
                  includeDefaultButton: existing.includeDefaultButton ?? false,
                }
              : { text: textContent, buttons: [], includeDefaultButton: false };
            this.pendingBroadcasts.set(telegramId, nextDraft);

            await this.sendBroadcastPreview(chatId, telegramId);
            return;
          }

          if (this.awaitingBroadcastButtons.has(telegramId) && textContent) {
            const draft = this.pendingBroadcasts.get(telegramId);
            if (!draft) return;

            const parsed = this.parseBroadcastButtons(textContent);
            if (parsed.buttons.length === 0) {
              await this.bot.sendMessage(
                chatId,
                'Не получилось распознать кнопки. Формат: Текст | ссылка'
              );
              return;
            }

            this.awaitingBroadcastButtons.delete(telegramId);
            this.pendingBroadcasts.set(telegramId, { ...draft, buttons: parsed.buttons });

            await this.sendBroadcastPreview(chatId, telegramId);
            return;
          }

          if (this.awaitingBroadcastMedia.has(telegramId)) {
            const draft = this.pendingBroadcasts.get(telegramId);
            if (!draft) return;

            if (msg.photo?.length) {
              const fileId = msg.photo[msg.photo.length - 1].file_id;
              this.awaitingBroadcastMedia.delete(telegramId);
              this.pendingBroadcasts.set(telegramId, {
                ...draft,
                media: { type: 'photo', fileId },
              });
              await this.bot.sendMessage(chatId, '📸 Фото прикреплено.');
              await this.sendBroadcastPreview(chatId, telegramId);
              return;
            }

            if (msg.video) {
              this.awaitingBroadcastMedia.delete(telegramId);
              this.pendingBroadcasts.set(telegramId, {
                ...draft,
                media: { type: 'video', fileId: msg.video.file_id },
              });
              await this.bot.sendMessage(chatId, '🎬 Видео прикреплено.');
              await this.sendBroadcastPreview(chatId, telegramId);
              return;
            }

            await this.bot.sendMessage(chatId, 'Пришлите фото или видео для рассылки.');
          }

          if (!textContent) return;
          if (textContent.startsWith('/')) return;

          if (textContent === AdminBot.BUTTON_LABELS.adminPanel) {
            await this.sendAdminPanelLink(chatId, { compact: true });
            return;
          }

          if (textContent === AdminBot.BUTTON_LABELS.stats) {
            await this.sendStatsMessage(chatId);
            return;
          }

          if (textContent === AdminBot.BUTTON_LABELS.broadcast) {
            await this.initiateBroadcastFlow(chatId, telegramId);
            return;
          }

          if (textContent === AdminBot.BUTTON_LABELS.refreshAdmins) {
            try {
              await this.loadAdmins();
              await this.bot.sendMessage(
                chatId,
                `✅ Список админов обновлён.\nВсего админов: ${this.adminTelegramIds.size}`
              );
            } catch (error) {
              logger.error('Error reloading admins manually', { error });
              await this.bot.sendMessage(chatId, '⚠️ Не получилось обновить список админов.');
            }
            return;
          }

          if (textContent === AdminBot.BUTTON_LABELS.help) {
            await this.sendHelpMessage(chatId);
            return;
          }
        } catch (error) {
          logger.error('Error handling broadcast draft message', { error, chatId: msg.chat.id });
        }
      })
    );

    // Команда /help
    this.bot.onText(
      /\/help/,
      runAsync(async (msg) => {
        const chatId = msg.chat.id;
        await this.sendHelpMessage(chatId);
      })
    );
  }

  /**
   * Настройка callback обработчиков
   */
  private setupCallbacks(): void {
    this.bot.on(
      'callback_query',
      runAsync(async (query) => {
        try {
          const chatId = query.message?.chat.id;
          if (!chatId) return;

          const telegramId = query.from.id;
          if (!this.isAdmin(telegramId)) {
            await this.bot.answerCallbackQuery(query.id, { text: '❌ У вас нет доступа.' });
            return;
          }

          const data = query.data;

          if (data === 'open_admin_panel') {
            const adminUrl = this.getAdminPanelUrl();
            await this.bot.answerCallbackQuery(query.id);
            await this.bot.sendMessage(chatId, `🔗 ${adminUrl}`);
          }

          if (!data) return;

          if (data === 'broadcast_cancel') {
            this.awaitingBroadcastText.delete(telegramId);
            this.awaitingBroadcastButtons.delete(telegramId);
            this.pendingBroadcasts.delete(telegramId);
            await this.bot.answerCallbackQuery(query.id, { text: 'Рассылка отменена' });
            return;
          }

          if (data === 'broadcast_buttons_yes') {
            const draft = this.pendingBroadcasts.get(telegramId);
            if (!draft) {
              await this.bot.answerCallbackQuery(query.id, { text: 'Нет текста рассылки.' });
              return;
            }
            this.awaitingBroadcastButtons.add(telegramId);
            await this.bot.answerCallbackQuery(query.id);
            await this.bot.sendMessage(
              chatId,
              'Отправьте кнопки в формате:\n' +
                'Текст | ссылка\n' +
                'Например:\n' +
                'Связаться | https://t.me/username\n' +
                'Упомянуть | tg://user?id=123456789'
            );
            return;
          }

          if (data === 'broadcast_toggle_app') {
            const draft = this.pendingBroadcasts.get(telegramId);
            if (!draft) {
              await this.bot.answerCallbackQuery(query.id, { text: 'Нет текста рассылки.' });
              return;
            }
            this.pendingBroadcasts.set(telegramId, {
              ...draft,
              includeDefaultButton: !draft.includeDefaultButton,
            });
            await this.bot.answerCallbackQuery(query.id, {
              text: draft.includeDefaultButton ? 'Кнопка отключена' : 'Кнопка будет добавлена',
            });
            await this.sendBroadcastPreview(chatId, telegramId);
            return;
          }

          if (data === 'broadcast_media_prompt') {
            const draft = this.pendingBroadcasts.get(telegramId);
            if (!draft) {
              await this.bot.answerCallbackQuery(query.id, { text: 'Нет текста рассылки.' });
              return;
            }
            this.awaitingBroadcastMedia.add(telegramId);
            await this.bot.answerCallbackQuery(query.id);
            await this.bot.sendMessage(
              chatId,
              'Пришлите фото или видео для рассылки (одно вложение).'
            );
            return;
          }

          if (data === 'broadcast_media_clear') {
            const draft = this.pendingBroadcasts.get(telegramId);
            if (!draft) {
              await this.bot.answerCallbackQuery(query.id, { text: 'Нет текста рассылки.' });
              return;
            }
            if (draft.media) {
              this.pendingBroadcasts.set(telegramId, { ...draft, media: undefined });
            }
            await this.bot.answerCallbackQuery(query.id, { text: 'Медиа удалено' });
            await this.sendBroadcastPreview(chatId, telegramId);
            return;
          }

          if (data === 'broadcast_edit_text') {
            const draft = this.pendingBroadcasts.get(telegramId);
            if (!draft) {
              await this.bot.answerCallbackQuery(query.id, { text: 'Нет черновика рассылки.' });
              return;
            }
            this.awaitingBroadcastText.add(telegramId);
            await this.bot.answerCallbackQuery(query.id);
            await this.bot.sendMessage(
              chatId,
              'Отправьте новый текст для рассылки одним сообщением.'
            );
            return;
          }

          if (data === 'broadcast_edit_buttons') {
            const draft = this.pendingBroadcasts.get(telegramId);
            if (!draft) {
              await this.bot.answerCallbackQuery(query.id, { text: 'Нет текста рассылки.' });
              return;
            }
            this.awaitingBroadcastButtons.add(telegramId);
            await this.bot.answerCallbackQuery(query.id);
            await this.bot.sendMessage(chatId, 'Отправьте новый список кнопок (Текст | ссылка).');
            return;
          }

          if (data === 'broadcast_send') {
            const draft = this.pendingBroadcasts.get(telegramId);
            if (!draft) {
              await this.bot.answerCallbackQuery(query.id, { text: 'Нет черновика рассылки.' });
              return;
            }

            if (!this.onBroadcast) {
              await this.bot.answerCallbackQuery(query.id, { text: 'Рассылка недоступна.' });
              return;
            }

            const miniAppUrl = this.getMiniAppUrl();
            const finalButtons = [
              ...draft.buttons,
              ...(draft.includeDefaultButton
                ? [{ text: 'Открыть приложение', url: miniAppUrl, kind: 'web_app' as const }]
                : []),
            ];

            await this.bot.answerCallbackQuery(query.id, { text: 'Запускаю рассылку...' });
            this.pendingBroadcasts.delete(telegramId);

            const statusMessage = await this.bot.sendMessage(chatId, 'Рассылка запускается...');
            const spinner = ['|', '/', '-', '\\'];
            let spinnerIndex = 0;
            let lastProgress = { sent: 0, failed: 0, total: 0 };

            const isMessageNotModifiedError = (err: unknown): boolean => {
              const msg =
                err && typeof err === 'object' && 'message' in err
                  ? String((err as { message?: unknown }).message)
                  : '';
              return msg.toLowerCase().includes('message is not modified');
            };

            const updateStatus = async (force = false) => {
              if (!force && lastProgress.total === 0) return;
              const frame = spinner[spinnerIndex % spinner.length];
              spinnerIndex += 1;
              const text =
                `Рассылка ${frame}\n` +
                `Отправлено: ${lastProgress.sent} из ${lastProgress.total}\n` +
                `Ошибок: ${lastProgress.failed}`;
              try {
                await this.bot.editMessageText(text, {
                  chat_id: chatId,
                  message_id: statusMessage.message_id,
                });
              } catch (err: unknown) {
                // Это частая, безопасная ситуация при конкурентных обновлениях статуса
                // (Telegram 400: message is not modified). Не ломаем рассылку и не спамим error-логами.
                if (isMessageNotModifiedError(err)) return;
                logger.warn('Failed to update broadcast status message', {
                  chatId,
                  messageId: statusMessage.message_id,
                  error: err,
                });
              }
            };

            const timer = setInterval(() => {
              updateStatus().catch(() => null);
            }, 1200);

            let result: { sent: number; failed: number; total: number };
            try {
              result = await this.onBroadcast({
                text: draft.text,
                buttons: finalButtons,
                media: draft.media,
                onProgress: async (progress) => {
                  lastProgress = progress;
                  if (progress.sent === progress.total) {
                    await updateStatus(true);
                  }
                },
              });
            } finally {
              clearInterval(timer);
            }

            await this.bot.sendMessage(
              chatId,
              `✅ Рассылка завершена\n\nОтправлено: ${result.sent}\nОшибок: ${result.failed}`
            );
            return;
          }

          const confirmPrefix = 'booking_confirm:';
          const cancelPrefix = 'booking_cancel:';

          if (data.startsWith(confirmPrefix) || data.startsWith(cancelPrefix)) {
            const bookingId = data.replace(confirmPrefix, '').replace(cancelPrefix, '');
            const isConfirm = data.startsWith(confirmPrefix);

            const booking = await this.bookingRepository.findById(bookingId);
            if (!booking) {
              await this.bot.answerCallbackQuery(query.id, { text: '❌ Заявка не найдена.' });
              return;
            }

            if (booking.status !== 'pending') {
              const statusLabel =
                booking.status === 'confirmed' ? '✅ Уже подтверждена' : '❌ Уже отменена';
              await this.bot.answerCallbackQuery(query.id, { text: statusLabel });
              return;
            }

            await this.bookingRepository.updateStatus(
              bookingId,
              isConfirm ? 'confirmed' : 'cancelled'
            );

            if (isConfirm && this.onBookingConfirmed) {
              await this.onBookingConfirmed({
                bookingId: booking.id,
                bookingDate: booking.bookingDate.toISOString().split('T')[0],
                formatName: booking.format?.name || 'Не указан',
                fullName: booking.fullName,
                contactValue: booking.contactValue,
              });
            }

            const statusLine = isConfirm ? 'Статус: ✅ Подтверждена' : 'Статус: ❌ Отменена';
            if (query.message?.text) {
              await this.bot.editMessageText(`${query.message.text}\n\n${statusLine}`, {
                chat_id: chatId,
                message_id: query.message.message_id,
              });
            }

            await this.bot.editMessageReplyMarkup(
              { inline_keyboard: [] },
              { chat_id: chatId, message_id: query.message?.message_id }
            );

            await this.bot.answerCallbackQuery(query.id, {
              text: isConfirm ? '✅ Заявка подтверждена' : '❌ Заявка отменена',
            });
          }
        } catch (error) {
          logger.error('Error handling callback query', { error, queryId: query.id });
        }
      })
    );
  }

  private async sendBroadcastPreview(chatId: number, telegramId: number): Promise<void> {
    const draft = this.pendingBroadcasts.get(telegramId);
    if (!draft) return;

    await this.bot.sendMessage(chatId, this.buildBroadcastPreview(draft), {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Отправить', callback_data: 'broadcast_send' }],
          [
            { text: '✏️ Изменить текст', callback_data: 'broadcast_edit_text' },
            { text: '➕ Кнопки', callback_data: 'broadcast_buttons_yes' },
          ],
          [
            {
              text: draft.includeDefaultButton
                ? '📱 Кнопка Mini App: ВКЛ'
                : '📱 Кнопка Mini App: ВЫКЛ',
              callback_data: 'broadcast_toggle_app',
            },
          ],
          [
            {
              text: draft.media ? '🗑 Удалить медиа' : '🖼 Прикрепить медиа',
              callback_data: draft.media ? 'broadcast_media_clear' : 'broadcast_media_prompt',
            },
          ],
          [{ text: '❌ Отмена', callback_data: 'broadcast_cancel' }],
        ],
      },
    });
  }

  private buildBroadcastPreview(draft: {
    text: string;
    buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }>;
    includeDefaultButton: boolean;
    media?: { type: 'photo' | 'video'; fileId: string };
  }): string {
    const buttonLines: string[] = [];
    if (draft.buttons.length) {
      draft.buttons.forEach((button) =>
        buttonLines.push(
          `• ${button.text} → ${button.url}${button.kind === 'web_app' ? ' (Mini App)' : ''}`
        )
      );
    }
    if (draft.includeDefaultButton) {
      buttonLines.push('• Открыть приложение (Mini App)');
    }
    if (buttonLines.length === 0) {
      buttonLines.push('• — нет');
    }

    const mediaLine = draft.media
      ? `📎 Медиа: ${draft.media.type === 'photo' ? 'Фото' : 'Видео'} прикреплено`
      : '📎 Медиа не прикреплена';

    return `Черновик рассылки:\n\n${draft.text}\n\nКнопки:\n${buttonLines.join('\n')}\n\n${mediaLine}`;
  }

  private parseBroadcastButtons(input: string): {
    buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }>;
  } {
    const lines = input
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }> = [];

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 2) continue;
      const text = parts[0].trim();
      const rawUrl = parts.slice(1).join('|').trim();
      if (!text || !rawUrl) continue;

      const normalized = this.normalizeBroadcastButton(rawUrl);
      if (!normalized) continue;

      buttons.push({ text, url: normalized.url, kind: normalized.kind });
      if (buttons.length >= 8) break;
    }

    return { buttons };
  }

  private normalizeBroadcastButton(
    rawUrl: string
  ): { url: string; kind: 'url' | 'web_app' } | null {
    const value = rawUrl.trim();
    if (!value) return null;

    const miniAppUrl = this.getMiniAppUrl();

    if (value.startsWith('app:') || value.startsWith('webapp:')) {
      const suffix = value.replace(/^app:|^webapp:/, '').trim();
      const url = suffix
        ? `${miniAppUrl}${suffix.startsWith('/') || suffix.startsWith('?') ? '' : '/'}${suffix}`
        : miniAppUrl;
      return { url, kind: 'web_app' };
    }

    if (value.startsWith('@')) {
      return { url: `https://t.me/${value.slice(1)}`, kind: 'url' };
    }

    const idMatch = value.match(/^(user|id):(\d+)$/i);
    if (idMatch) {
      return { url: `tg://user?id=${idMatch[2]}`, kind: 'url' };
    }

    if (value.startsWith('tg://user?id=')) {
      return { url: value, kind: 'url' };
    }

    if (value.startsWith('https://') || value.startsWith('http://')) {
      return { url: value, kind: 'url' };
    }

    if (value.startsWith('t.me/')) {
      return { url: `https://${value}`, kind: 'url' };
    }

    if (value.startsWith('telegram.me/')) {
      return { url: `https://${value}`, kind: 'url' };
    }

    if (value === 'app' || value === 'miniapp') {
      return { url: miniAppUrl, kind: 'web_app' };
    }

    return null;
  }

  private getAdminPanelUrl(): string {
    return process.env.ADMIN_PANEL_URL || 'https://your-domain.com/admin';
  }

  private buildAdminBookingUrl(bookingId: string): string {
    const base = this.getAdminPanelUrl().replace(/\/$/, '');
    return `${base}/bookings/${bookingId}`;
  }

  private getMiniAppUrl(): string {
    return process.env.MINI_APP_URL || 'https://your-domain.com';
  }

  private getAdminKeyboardMarkup(): TelegramBot.ReplyKeyboardMarkup {
    const keyboard: TelegramBot.KeyboardButton[][] = AdminBot.KEYBOARD_LAYOUT.map((row) =>
      row.map((text) => ({ text }))
    );
    return {
      keyboard,
      resize_keyboard: true,
      input_field_placeholder: 'Выберите действие…',
    };
  }

  private async sendAdminMenu(chatId: number, { force = false } = {}): Promise<void> {
    if (!force && this.chatsWithKeyboard.has(chatId)) return;
    await this.bot.sendMessage(
      chatId,
      '📋 Главное меню доступно. Выберите действие на клавиатуре ниже.',
      {
        reply_markup: this.getAdminKeyboardMarkup(),
        disable_web_page_preview: true,
      }
    );
    this.chatsWithKeyboard.add(chatId);
  }

  private async sendAdminPanelLink(chatId: number, { compact = false } = {}): Promise<void> {
    const adminUrl = this.getAdminPanelUrl();
    const message = compact
      ? `🔗 Ссылка на админ-панель:\n${adminUrl}`
      : '🔐 Админ-панель\n\n' +
        'Используйте ссылку ниже для входа в админ-панель:\n\n' +
        `${adminUrl}\n\n` +
        'Или используйте команду /admin для получения ссылки.';

    await this.bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔗 Открыть админ-панель',
              web_app: { url: adminUrl },
            },
          ],
        ],
      },
      disable_web_page_preview: true,
    });
  }

  private async sendStatsMessage(chatId: number): Promise<void> {
    const stats = await this.bookingRepository.getStats();

    const message =
      '📊 Статистика бронирований:\n\n' +
      `Всего: ${stats.total}\n` +
      `✅ Подтверждено: ${stats.confirmed}\n` +
      `⏳ Ожидает: ${stats.pending}\n` +
      `❌ Отменено: ${stats.cancelled}\n` +
      `💰 Общий доход: ${stats.totalIncome.toFixed(2)} руб.\n` +
      `📈 Конверсия: ${stats.conversionRate.toFixed(1)}%`;

    await this.bot.sendMessage(chatId, message, {
      reply_markup: this.getAdminKeyboardMarkup(),
    });
    this.chatsWithKeyboard.add(chatId);
  }

  private async initiateBroadcastFlow(chatId: number, telegramId: number): Promise<void> {
    this.awaitingBroadcastText.add(telegramId);
    this.awaitingBroadcastButtons.delete(telegramId);
    this.awaitingBroadcastMedia.delete(telegramId);
    this.pendingBroadcasts.delete(telegramId);

    await this.bot.sendMessage(
      chatId,
      '🗣️ Рассылка всем пользователям\n\n' +
        'Отправьте текст сообщения одним сообщением.\n' +
        'После текста можно добавить кнопки (например, упоминание пользователя).\n\n' +
        'Формат кнопок:\n' +
        'Текст | ссылка\n' +
        'Например:\n' +
        'Написать @user | https://t.me/user\n' +
        'Упомянуть по ID | tg://user?id=123456789\n' +
        'Профиль | user:123456789',
      {
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'broadcast_cancel' }]],
        },
      }
    );
  }

  private async sendHelpMessage(chatId: number): Promise<void> {
    await this.bot.sendMessage(
      chatId,
      '🔐 Админ-команды:\n\n' +
        '/start - Получить ссылку на админ-панель\n' +
        '/admin - Открыть админ-панель\n' +
        '/stats - Статистика бронирований\n' +
        '/broadcast - Рассылка всем пользователям\n' +
        '/help - Показать это сообщение',
      {
        reply_markup: this.getAdminKeyboardMarkup(),
      }
    );
    this.chatsWithKeyboard.add(chatId);
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
    try {
      const message =
        '👤 Новый пользователь зарегистрировался:\n\n' +
        `🆔 Telegram ID: ${userData.telegramId}\n` +
        (userData.username ? `👤 Username: @${userData.username}\n` : '') +
        (userData.firstName || userData.lastName
          ? `📝 Имя: ${userData.firstName || ''} ${userData.lastName || ''}\n`
          : '');

      // Отправляем всем админам
      for (const adminId of this.adminTelegramIds) {
        try {
          await this.bot.sendMessage(adminId, message);
        } catch (error: unknown) {
          const code = getTelegramErrorCode(error);
          if (code !== 403) logger.error('Error sending new user notification', { error, adminId });
        }
      }
    } catch (error) {
      logger.error('Error notifying new user', { error });
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
    try {
      const message =
        '📅 Новое бронирование:\n\n' +
        `🆔 ID заявки: ${bookingData.id}\n` +
        `📅 Дата: ${bookingData.bookingDate}\n` +
        (bookingData.formatName ? `🎤 Формат: ${bookingData.formatName}\n` : '') +
        `👤 Имя из формы: ${bookingData.fullName}\n` +
        `📞 Контакт: ${bookingData.contactValue}\n` +
        (bookingData.city ? `📍 Город: ${bookingData.city}\n` : '') +
        (bookingData.telegramId ? `🆔 Telegram ID: ${bookingData.telegramId}\n` : '') +
        (bookingData.username ? `👤 Username: @${bookingData.username}\n` : '') +
        (bookingData.firstName || bookingData.lastName
          ? `📋 Имя в Telegram: ${[bookingData.firstName, bookingData.lastName].filter(Boolean).join(' ')}\n`
          : '');

      // Отправляем всем админам
      for (const adminId of this.adminTelegramIds) {
        try {
          await this.bot.sendMessage(adminId, message, {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '✅ Подтвердить',
                    callback_data: `booking_confirm:${bookingData.id}`,
                  },
                  {
                    text: '❌ Отменить',
                    callback_data: `booking_cancel:${bookingData.id}`,
                  },
                ],
                [
                  {
                    text: '🔗 Открыть админ-панель',
                    web_app: {
                      url: this.buildAdminBookingUrl(bookingData.id),
                    },
                  },
                ],
              ],
            },
          });
        } catch (err: unknown) {
          const code = getTelegramErrorCode(err);
          if (code !== 403) {
            logger.error('Error sending new booking notification', { error: err, adminId });
          }
        }
      }
    } catch (error) {
      logger.error('Error notifying new booking', { error });
    }
  }

  /**
   * Отправка QR-кода сессии голосования всем админам.
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

    for (const adminId of this.adminTelegramIds) {
      try {
        await this.bot.sendPhoto(
          adminId,
          payload.qrPngBuffer,
          {
            caption,
            reply_markup: {
              inline_keyboard: [[{ text: 'Открыть ссылку', url: payload.deepLink }]],
            },
          },
          {
            filename: `voting-qr-${payload.sessionId}.png`,
            contentType: 'image/png',
          }
        );
      } catch (err: unknown) {
        const code = getTelegramErrorCode(err);
        if (code !== 403) {
          logger.error('Error sending voting QR to admin', {
            error: err,
            adminId,
            sessionId: payload.sessionId,
          });
        }
      }
    }
  }

  /**
   * Обновление списка админов
   */
  async refreshAdmins(): Promise<void> {
    await this.loadAdmins();
  }

  /**
   * Остановка polling (для graceful shutdown)
   */
  async stop(): Promise<void> {
    await this.bot.stopPolling();
  }

  /**
   * Получение экземпляра бота (для внешнего использования)
   */
  getBot(): TelegramBot {
    return this.bot;
  }
}
