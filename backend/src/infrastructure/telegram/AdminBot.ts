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

  constructor(
    token: string,
    _userRepository: IUserRepository,
    bookingRepository: IBookingRepository
  ) {
    this.bot = new TelegramBot(token, { polling: true });
    this.bookingRepository = bookingRepository;
    this.adminTelegramIds = new Set();

    this.loadAdmins();
    this.setupCommands();
    this.setupCallbacks();

    logger.info('Admin Bot initialized');
  }

  /**
   * Загрузка списка админов из БД
   */
  private async loadAdmins(): Promise<void> {
    try {
      // Получаем всех админов из БД через Prisma напрямую
      const admins = await prisma.user.findMany({
        where: { role: USER_ROLES.ADMIN },
        select: { telegramId: true },
      });

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

        const adminUrl = `${process.env.ADMIN_PANEL_URL || 'https://your-domain.com/admin'}?token=...`;

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
                    url: adminUrl,
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
                  url: adminUrl,
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

    // Команда /help
    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(
        chatId,
        '🔐 Админ-команды:\n\n' +
          '/start - Получить ссылку на админ-панель\n' +
          '/admin - Открыть админ-панель\n' +
          '/stats - Статистика бронирований\n' +
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
      } catch (error) {
        logger.error('Error handling callback query', { error, queryId: query.id });
      }
    });
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
                    text: '🔗 Открыть админ-панель',
                    url: `${process.env.ADMIN_PANEL_URL || 'https://your-domain.com/admin'}/bookings/${bookingData.id}`,
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
