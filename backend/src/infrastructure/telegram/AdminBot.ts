import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../../shared/utils/logger';
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
  private pendingBroadcasts: Map<number, { text: string; buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }> }>;
  private onBroadcast?: (payload: {
    text: string;
    buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }>;
    onProgress?: (progress: { sent: number; failed: number; total: number }) => Promise<void>;
  }) => Promise<{ sent: number; failed: number; total: number }>;

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
    this.pendingBroadcasts = new Map();
    this.onBroadcast = onBroadcast;

    this.loadAdmins();
    setInterval(() => this.loadAdmins(), AdminBot.ADMIN_RELOAD_INTERVAL_MS);
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
    this.bot.onText(/\/start/, async (msg) => {
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

        const adminUrl = `${process.env.ADMIN_PANEL_URL || 'https://your-domain.com/admin'}`;

        await this.bot.sendMessage(
          chatId,
          '🔐 Админ-панель\n\n' +
            'Используйте ссылку ниже для входа в админ-панель:\n\n' +
            `${adminUrl}\n\n` +
            'Или используйте команду /admin для получения ссылки.',
          {
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
          }
        );
      } catch (error) {
        logger.error('Error handling /start command', { error, chatId: msg.chat.id });
      }
    });

    // Команда /admin - получение ссылки на админку
    this.bot.onText(/\/admin/, async (msg) => {
      try {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId || !this.isAdmin(telegramId)) {
          await this.bot.sendMessage(chatId, '❌ У вас нет доступа.');
          return;
        }

        const adminUrl = `${process.env.ADMIN_PANEL_URL || 'https://your-domain.com/admin'}`;

        await this.bot.sendMessage(chatId, `🔗 Ссылка на админ-панель:\n\n${adminUrl}`, {
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
        });
      } catch (error) {
        logger.error('Error handling /admin command', { error, chatId: msg.chat.id });
      }
    });

    // Команда /stats - статистика
    this.bot.onText(/\/stats/, async (msg) => {
      try {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId || !this.isAdmin(telegramId)) {
          await this.bot.sendMessage(chatId, '❌ У вас нет доступа.');
          return;
        }

        // Получаем статистику
        const stats = await this.bookingRepository.getStats();

        const message =
          '📊 Статистика бронирований:\n\n' +
          `Всего: ${stats.total}\n` +
          `✅ Подтверждено: ${stats.confirmed}\n` +
          `⏳ Ожидает: ${stats.pending}\n` +
          `❌ Отменено: ${stats.cancelled}\n` +
          `💰 Общий доход: ${stats.totalIncome.toFixed(2)} руб.\n` +
          `📈 Конверсия: ${stats.conversionRate.toFixed(1)}%`;

        await this.bot.sendMessage(chatId, message);
      } catch (error) {
        logger.error('Error handling /stats command', { error, chatId: msg.chat.id });
      }
    });

    this.bot.onText(/\/broadcast$/, async (msg) => {
      try {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;

        if (!telegramId || !this.isAdmin(telegramId)) {
          await this.bot.sendMessage(chatId, '❌ У вас нет доступа.');
          return;
        }

        this.awaitingBroadcastText.add(telegramId);
        this.awaitingBroadcastButtons.delete(telegramId);
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
      } catch (error) {
        logger.error('Error handling /broadcast command', { error, chatId: msg.chat.id });
      }
    });

    this.bot.onText(/\/broadcast_cancel$/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id;
      if (!telegramId) return;
      this.awaitingBroadcastText.delete(telegramId);
      this.pendingBroadcasts.delete(telegramId);
      await this.bot.sendMessage(chatId, 'Рассылка отменена.');
    });

    this.bot.on('message', async (msg) => {
      try {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId || !this.isAdmin(telegramId)) return;
        if (!msg.text || msg.text.startsWith('/')) return;

        if (this.awaitingBroadcastText.has(telegramId)) {
          const text = msg.text.trim();
          if (!text) return;

          const existing = this.pendingBroadcasts.get(telegramId);
          this.awaitingBroadcastText.delete(telegramId);
          this.pendingBroadcasts.set(telegramId, { text, buttons: existing?.buttons ?? [] });

          await this.bot.sendMessage(
            chatId,
            `Текст рассылки принят.\n\n${text}\n\nДобавить кнопки?`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '➕ Добавить кнопки', callback_data: 'broadcast_buttons_yes' },
                    { text: '⏭️ Без кнопок', callback_data: 'broadcast_buttons_skip' },
                  ],
                  [{ text: '❌ Отмена', callback_data: 'broadcast_cancel' }],
                ],
              },
            }
          );
          return;
        }

        if (this.awaitingBroadcastButtons.has(telegramId)) {
          const draft = this.pendingBroadcasts.get(telegramId);
          if (!draft) return;

          const parsed = this.parseBroadcastButtons(msg.text);
          if (parsed.buttons.length === 0) {
            await this.bot.sendMessage(
              chatId,
              'Не получилось распознать кнопки. Формат: Текст | ссылка'
            );
            return;
          }

          this.awaitingBroadcastButtons.delete(telegramId);
          this.pendingBroadcasts.set(telegramId, { text: draft.text, buttons: parsed.buttons });

          await this.bot.sendMessage(
            chatId,
            this.buildBroadcastPreview(draft.text, parsed.buttons),
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🚀 Отправить', callback_data: 'broadcast_send' }],
                  [
                    { text: '✏️ Изменить текст', callback_data: 'broadcast_edit_text' },
                    { text: '🔁 Изменить кнопки', callback_data: 'broadcast_edit_buttons' },
                  ],
                  [{ text: '❌ Отмена', callback_data: 'broadcast_cancel' }],
                ],
              },
            }
          );
        }
      } catch (error) {
        logger.error('Error handling broadcast draft message', { error, chatId: msg.chat.id });
      }
    });

    // Команда /help
    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(
        chatId,
        '🔐 Админ-команды:\n\n' +
          '/start - Получить ссылку на админ-панель\n' +
          '/admin - Открыть админ-панель\n' +
          '/stats - Статистика бронирований\n' +
          '/broadcast - Рассылка всем пользователям\n' +
          '/help - Показать это сообщение'
      );
    });
  }

  /**
   * Настройка callback обработчиков
   */
  private setupCallbacks(): void {
    this.bot.on('callback_query', async (query) => {
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
          const adminUrl = `${process.env.ADMIN_PANEL_URL || 'https://your-domain.com/admin'}`;
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

        if (data === 'broadcast_buttons_skip') {
          const draft = this.pendingBroadcasts.get(telegramId);
          if (!draft) {
            await this.bot.answerCallbackQuery(query.id, { text: 'Нет текста рассылки.' });
            return;
          }
          this.awaitingBroadcastButtons.delete(telegramId);
          await this.bot.answerCallbackQuery(query.id);
          await this.bot.sendMessage(
            chatId,
            this.buildBroadcastPreview(draft.text, draft.buttons),
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🚀 Отправить', callback_data: 'broadcast_send' }],
                  [
                    { text: '✏️ Изменить текст', callback_data: 'broadcast_edit_text' },
                    { text: '🔁 Изменить кнопки', callback_data: 'broadcast_edit_buttons' },
                  ],
                  [{ text: '❌ Отмена', callback_data: 'broadcast_cancel' }],
                ],
              },
            }
          );
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
          await this.bot.sendMessage(chatId, 'Отправьте новый текст для рассылки одним сообщением.');
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

          await this.bot.answerCallbackQuery(query.id, { text: 'Запускаю рассылку...' });
          this.pendingBroadcasts.delete(telegramId);

          const statusMessage = await this.bot.sendMessage(chatId, 'Рассылка запускается...');
          const spinner = ['|', '/', '-', '\\'];
          let spinnerIndex = 0;
          let lastProgress = { sent: 0, failed: 0, total: 0 };

          const updateStatus = async (force = false) => {
            if (!force && lastProgress.total === 0) return;
            const frame = spinner[spinnerIndex % spinner.length];
            spinnerIndex += 1;
            const text =
              `Рассылка ${frame}\n` +
              `Отправлено: ${lastProgress.sent} из ${lastProgress.total}\n` +
              `Ошибок: ${lastProgress.failed}`;
            await this.bot.editMessageText(text, {
              chat_id: chatId,
              message_id: statusMessage.message_id,
            });
          };

          const timer = setInterval(() => {
            updateStatus().catch(() => null);
          }, 1200);

          let result: { sent: number; failed: number; total: number };
          try {
            result = await this.onBroadcast({
              text: draft.text,
              buttons: draft.buttons,
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
            const statusLabel = booking.status === 'confirmed' ? '✅ Уже подтверждена' : '❌ Уже отменена';
            await this.bot.answerCallbackQuery(query.id, { text: statusLabel });
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
    });
  }

  private buildBroadcastPreview(
    text: string,
    buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }>
  ): string {
    const buttonLines = buttons.length
      ? buttons.map((button) => `• ${button.text} → ${button.url}${button.kind === 'web_app' ? ' (Mini App)' : ''}`)
      : ['• Открыть приложение (по умолчанию)'];
    return `Черновик рассылки:\n\n${text}\n\nКнопки:\n${buttonLines.join('\n')}`;
  }

  private parseBroadcastButtons(input: string): {
    buttons: Array<{ text: string; url: string; kind: 'url' | 'web_app' }>;
  } {
    const lines = input.split('\n').map((line) => line.trim()).filter(Boolean);
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

  private normalizeBroadcastButton(rawUrl: string): { url: string; kind: 'url' | 'web_app' } | null {
    const value = rawUrl.trim();
    if (!value) return null;

    const miniAppUrl = process.env.MINI_APP_URL || 'https://your-domain.com';

    if (value.startsWith('app:') || value.startsWith('webapp:')) {
      const suffix = value.replace(/^app:|^webapp:/, '').trim();
      const url = suffix ? `${miniAppUrl}${suffix.startsWith('/') || suffix.startsWith('?') ? '' : '/'}${suffix}` : miniAppUrl;
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
        } catch (error: any) {
          if (error.response?.error_code !== 403) {
            logger.error('Error sending new user notification', { error, adminId });
          }
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
                      url: `${process.env.ADMIN_PANEL_URL || 'https://your-domain.com/admin'}/bookings/${bookingData.id}`,
                    },
                  },
                ],
              ],
            },
          });
        } catch (err: unknown) {
          const code = err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { error_code?: number } }).response?.error_code
            : undefined;
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
   * Обновление списка админов
   */
  async refreshAdmins(): Promise<void> {
    await this.loadAdmins();
  }

  /**
   * Остановка polling (для graceful shutdown)
   */
  async stop(): Promise<void> {
    this.bot.stopPolling();
  }

  /**
   * Получение экземпляра бота (для внешнего использования)
   */
  getBot(): TelegramBot {
    return this.bot;
  }
}
