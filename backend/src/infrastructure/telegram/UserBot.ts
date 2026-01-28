import TelegramBot, { Message, CallbackQuery } from 'node-telegram-bot-api';
import { logger } from '../../shared/utils/logger';
import { ReferralService } from '../../domain/services/ReferralService';

export class UserBot {
  private bot: TelegramBot;
  private referralService: ReferralService;

  constructor(
    token: string,
    referralService: ReferralService
  ) {
    this.bot = new TelegramBot(token, { polling: true });
    this.referralService = referralService;

    this.setupCommands();
    this.setupCallbacks();

    logger.info('User Bot initialized');
  }

  /**
   * Настройка команд
   */
  private setupCommands(): void {
    // Команда /start - обработка реферальных ссылок
    this.bot.onText(/\/start(.*)/, async (msg: Message, match: RegExpMatchArray | null) => {
      try {
        const chatId = msg.chat.id;
        const referralCode = match?.[1]?.trim();

        if (referralCode) {
          // Обрабатываем реферальную ссылку
          await this.handleReferralLink(chatId, referralCode, msg.from);
        } else {
          // Обычный старт - показываем приветствие
          await this.bot.sendMessage(chatId, 'Добро пожаловать! Откройте Mini App для продолжения.');
        }
      } catch (error) {
        logger.error('Error handling /start command', { error, chatId: msg.chat.id });
      }
    });

    // Команда /help
    this.bot.onText(/\/help/, async (msg: Message) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(
        chatId,
        '📱 Откройте Mini App для:\n\n' +
          '🎵 Голосования за песни\n' +
          '📅 Бронирования\n' +
          '⭐ Оставления отзывов\n\n' +
          'Для открытия Mini App нажмите на кнопку меню бота.'
      );
    });
  }

  /**
   * Обработка реферальной ссылки
   */
  private async handleReferralLink(
    chatId: number,
    referralCode: string,
    user: TelegramBot.User | undefined
  ): Promise<void> {
    try {
      // Обрабатываем клик по ссылке
      const result = await this.referralService.handleLinkClick(
        referralCode,
        undefined, // IP адрес недоступен в Telegram Bot API
        `Telegram:${user?.id}`
      );

      await this.bot.sendMessage(
        chatId,
        '✅ Спасибо за переход по реферальной ссылке!\n\n' +
          'Откройте Mini App для регистрации и получения бонусов.'
      );

      logger.info('Referral link clicked via User Bot', {
        chatId,
        referralCode,
        linkId: result.link.id,
      });
    } catch (error: any) {
      logger.error('Error handling referral link', { error, chatId, referralCode });

      if (error.message.includes('not found') || error.message.includes('not active')) {
        await this.bot.sendMessage(
          chatId,
          '⚠️ Реферальная ссылка недействительна или истекла.'
        );
      } else {
        await this.bot.sendMessage(chatId, '❌ Произошла ошибка при обработке ссылки.');
      }
    }
  }

  /**
   * Настройка callback обработчиков
   */
  private setupCallbacks(): void {
    this.bot.on('callback_query', async (query: CallbackQuery) => {
      try {
        const chatId = query.message?.chat.id;
        if (!chatId) return;

        const data = query.data;

        if (data === 'open_mini_app') {
          // Открытие Mini App
          await this.bot.answerCallbackQuery(query.id);
          const miniAppUrl = process.env.MINI_APP_URL || 'https://your-domain.com';
          await this.bot.sendMessage(
            chatId,
            'Откройте Mini App через меню бота или используйте кнопку ниже.',
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🚀 Открыть Mini App',
                      web_app: { url: miniAppUrl },
                    },
                  ],
                ],
              },
            }
          );
        }
      } catch (error) {
        logger.error('Error handling callback query', { error, queryId: query.id });
      }
    });
  }

  /**
   * Отправка уведомления о подтверждении бронирования
   */
  async sendBookingConfirmation(telegramId: string, bookingData: {
    bookingDate: string;
    formatName?: string;
    fullName: string;
  }): Promise<void> {
    try {
      const message =
        '✅ Ваше бронирование подтверждено!\n\n' +
        `📅 Дата: ${bookingData.bookingDate}\n` +
        (bookingData.formatName ? `🎤 Формат: ${bookingData.formatName}\n` : '') +
        `👤 Имя: ${bookingData.fullName}\n\n` +
        'С вами свяжутся в ближайшее время.';

      await this.bot.sendMessage(telegramId, message);
    } catch (error: any) {
      // Если пользователь заблокировал бота, игнорируем ошибку
      if (error.response?.error_code === 403) {
        logger.warn('User blocked the bot', { telegramId });
      } else {
        logger.error('Error sending booking confirmation', { error, telegramId });
      }
    }
  }

  /**
   * Отправка уведомления о новом сообщении от администратора
   */
  async sendAdminMessage(telegramId: number, message: string): Promise<void> {
    try {
      await this.bot.sendMessage(telegramId, `📩 Сообщение от администратора:\n\n${message}`);
    } catch (error: any) {
      if (error.response?.error_code === 403) {
        logger.warn('User blocked the bot', { telegramId });
      } else {
        logger.error('Error sending admin message', { error, telegramId });
      }
    }
  }

  /**
   * Получение экземпляра бота (для внешнего использования)
   */
  getBot(): TelegramBot {
    return this.bot;
  }
}
