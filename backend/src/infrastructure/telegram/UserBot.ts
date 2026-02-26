import path from 'path';
import fs from 'fs';
import TelegramBot, { Message, CallbackQuery } from 'node-telegram-bot-api';
import { logger } from '../../shared/utils/logger';
import { runAsync } from '../../shared/utils/asyncHandler';
import {
  getTelegramErrorCode,
  getTelegramErrorDescription,
} from '../../shared/utils/telegramErrors';
import { ReferralService } from '../../domain/services/ReferralService';
import { IOnboardingRepository } from '../database/repositories/OnboardingRepository';
import { redis } from '../../config/redis';

const REDIS_ONBOARDING_PREFIX = 'onb_pending:';
const ONBOARDING_TTL = 600; // 10 мин на подтверждение

/** Путь к приветственному видео (при /start). Файл создаётся скриптом scripts/optimize-welcome-video.sh */
function getWelcomeVideoPath(): string | null {
  const videoPath = path.join(process.cwd(), 'assets', 'welcome-video', 'welcome.mp4');
  return fs.existsSync(videoPath) ? videoPath : null;
}

export class UserBot {
  private bot: TelegramBot;
  private referralService: ReferralService;
  private onboardingRepository: IOnboardingRepository;

  constructor(
    token: string,
    referralService: ReferralService,
    onboardingRepository: IOnboardingRepository
  ) {
    this.bot = new TelegramBot(token, { polling: true });
    this.referralService = referralService;
    this.onboardingRepository = onboardingRepository;

    this.setupCommands();
    this.setupCallbacks();

    logger.info('User Bot initialized');
  }

  /**
   * Настройка команд
   */
  private setupCommands(): void {
    // Команда /start - обработка реферальных ссылок
    this.bot.onText(
      /\/start(.*)/,
      runAsync(async (msg: Message, match: RegExpMatchArray | null) => {
        try {
          const chatId = msg.chat.id;
          const referralCode = match?.[1]?.trim();

          if (referralCode && referralCode.startsWith('vote_')) {
            const sessionId = referralCode.substring(5);
            await this.handleVotingDeepLink(chatId, sessionId);
            return;
          }
          if (referralCode) {
            // Обрабатываем реферальную ссылку
            await this.handleReferralLink(chatId, referralCode, msg.from);
          } else {
            // Обычный старт: сначала онбординг «Кто вы?», затем приветствие
            const existing = await this.onboardingRepository.findByTelegramId(BigInt(chatId));
            if (existing) {
              await this.sendWelcome(chatId);
              return;
            }
            await this.sendOnboardingWhoAreYou(chatId);
          }
        } catch (error) {
          logger.error('Error handling /start command', { error, chatId: msg.chat.id });
        }
      })
    );

    // Команда /help
    this.bot.onText(
      /\/help/,
      runAsync(async (msg: Message) => {
        const chatId = msg.chat.id;
        await this.bot.sendMessage(
          chatId,
          '📱 Откройте Mini App для:\n\n' +
            '🎵 Голосования за песни\n' +
            '📅 Бронирования\n' +
            '⭐ Оставления отзывов\n\n' +
            'Для открытия Mini App нажмите на кнопку меню бота.'
        );
      })
    );
  }

  /**
   * Онбординг: вопрос «Если не секрет, кто вы?» с кнопками «Просто Человек» / «Организатор» / «Агент»
   */
  private async sendOnboardingWhoAreYou(chatId: number): Promise<void> {
    await this.bot.sendMessage(chatId, 'Если не секрет, кто вы?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Просто Человек', callback_data: 'onb:person' }],
          [{ text: 'Организатор', callback_data: 'onb:organizer' }],
          [{ text: 'Агент', callback_data: 'onb:agent' }],
        ],
      },
    });
  }

  /**
   * Приветственное сообщение (с видео, если есть) и кнопка «Открыть приложение»
   */
  private async sendWelcome(chatId: number): Promise<void> {
    const miniAppUrl = process.env.MINI_APP_URL || 'https://your-domain.com';
    const welcomeText =
      'Добро пожаловать! Теперь и ты — «В гостях у Лементалия». Располагайся и чувствуй себя как дома.\n' +
      'Cover-группа «ВГУЛ» в твоём распоряжении.\n\n' +
      'Здесь мы познакомимся поближе.\n\n' +
      'Ты узнаешь:\n' +
      '• о наших форматах\n' +
      '• увидишь наши выступления\n' +
      '• услышишь, как мы звучим.\n\n' +
      'А после ты с лёгкостью можешь пригласить нас на своё событие, где мы с огромным удовольствием сделаем его незабываемым, остросюжетным и грандиозным!';
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📱 Открыть приложение',
              web_app: { url: miniAppUrl },
            },
          ],
        ],
      },
    };
    const welcomeVideoPath = getWelcomeVideoPath();
    if (welcomeVideoPath) {
      await this.bot.sendVideo(chatId, welcomeVideoPath, {
        caption: welcomeText,
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } else {
      await this.bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    }
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
    } catch (error: unknown) {
      logger.error('Error handling referral link', { error, chatId, referralCode });

      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found') || msg.includes('not active')) {
        await this.bot.sendMessage(chatId, '⚠️ Реферальная ссылка недействительна или истекла.');
      } else {
        await this.bot.sendMessage(chatId, '❌ Произошла ошибка при обработке ссылки.');
      }
    }
  }

  /**
   * Обработка deep link голосования vote_{sessionId}
   *
   * URL в web_app кнопке открывается КАК ЕСТЬ в WebView.
   * Query параметры (?screen=voting&sessionId=xxx) доступны через window.location.search.
   *
   * Дополнительно сохраняем в Redis как fallback.
   */
  private async handleVotingDeepLink(chatId: number, sessionId: string): Promise<void> {
    try {
      const miniAppUrl = process.env.MINI_APP_URL || 'https://your-domain.com';

      // URL с параметрами — Mini App сразу откроется на экране голосования
      // Query параметры доступны через window.location.search на фронте
      const votingUrl = `${miniAppUrl}?screen=voting&sessionId=${sessionId}`;

      // Также сохраняем в Redis как fallback (если URL параметры не сработают)
      const redisKey = `pending_vote:${chatId}`;
      await redis.setex(redisKey, 3600, sessionId);

      logger.info('Sending voting web_app button', { chatId, sessionId, votingUrl });

      await this.bot.sendMessage(
        chatId,
        '🎵 Голосование за песню!\n\nНажмите кнопку ниже, чтобы проголосовать:',
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🎵 Голосовать',
                  web_app: { url: votingUrl },
                },
              ],
            ],
          },
        }
      );
    } catch (error) {
      logger.error('Error handling voting deep link', { error, chatId, sessionId });
      await this.bot.sendMessage(chatId, 'Не удалось открыть голосование. Попробуйте позже.');
    }
  }

  /**
   * Настройка callback обработчиков
   */
  private setupCallbacks(): void {
    this.bot.on(
      'callback_query',
      runAsync(async (query: CallbackQuery) => {
        try {
          const chatId = query.message?.chat.id;
          if (!chatId) return;

          const data = query.data;
          await this.bot.answerCallbackQuery(query.id);

          // Онбординг: выбор «Просто Человек» / «Организатор» / «Агент»
          if (data === 'onb:person' || data === 'onb:organizer' || data === 'onb:agent') {
            const role =
              data === 'onb:person'
                ? 'just_person'
                : data === 'onb:organizer'
                  ? 'organizer'
                  : 'agent';
            const key = `${REDIS_ONBOARDING_PREFIX}${chatId}`;
            await redis.setex(key, ONBOARDING_TTL, role);
            await this.bot.sendMessage(chatId, 'Точно?', {
              reply_markup: {
                inline_keyboard: [[{ text: 'Точно', callback_data: 'onb:confirm' }]],
              },
            });
            return;
          }

          // Онбординг: подтверждение → сохраняем в БД и отправляем приветствие
          if (data === 'onb:confirm') {
            const key = `${REDIS_ONBOARDING_PREFIX}${chatId}`;
            const role = await redis.get(key);
            if (!role) {
              await this.bot.sendMessage(chatId, 'Выбор устарел. Нажмите /start и выберите снова.');
              return;
            }
            await redis.del(key);
            await this.onboardingRepository.create(BigInt(chatId), role);
            await this.sendWelcome(chatId);
            return;
          }

          if (data === 'open_mini_app') {
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
      })
    );
  }

  /**
   * Отправка уведомления о подтверждении бронирования
   */
  async sendBookingConfirmation(
    telegramId: string,
    bookingData: {
      bookingDate: string;
      formatName?: string;
      fullName: string;
    }
  ): Promise<void> {
    try {
      const message =
        '✅ Ваше бронирование подтверждено!\n\n' +
        `📅 Дата: ${bookingData.bookingDate}\n` +
        (bookingData.formatName ? `🎤 Формат: ${bookingData.formatName}\n` : '') +
        `👤 Имя: ${bookingData.fullName}\n\n` +
        'С вами свяжутся в ближайшее время.';

      await this.bot.sendMessage(telegramId, message);
    } catch (err: unknown) {
      const code = getTelegramErrorCode(err);
      if (code === 403) {
        logger.warn('User blocked the bot', { telegramId });
      } else {
        logger.error('Error sending booking confirmation', { error: err, telegramId });
      }
    }
  }

  /**
   * Отправка уведомления о получении заявки (до подтверждения админом)
   */
  async sendBookingReceived(
    telegramId: string,
    bookingData: {
      bookingDate: string;
      formatName?: string;
      fullName: string;
    }
  ): Promise<void> {
    try {
      const message =
        '✅ Заявка получена!\n\n' +
        `📅 Дата: ${bookingData.bookingDate}\n` +
        (bookingData.formatName ? `🎤 Формат: ${bookingData.formatName}\n` : '') +
        `👤 Имя: ${bookingData.fullName}\n\n` +
        'С вами свяжется менеджер в ближайшее время.';

      await this.bot.sendMessage(telegramId, message);
    } catch (err: unknown) {
      const code = getTelegramErrorCode(err);
      if (code === 403) {
        logger.warn('User blocked the bot', { telegramId });
      } else {
        logger.error('Error sending booking received message', { error: err, telegramId });
      }
    }
  }

  /**
   * Попросить пользователя оставить отзыв после выполнения бронирования.
   * Отправляет сообщение с web_app кнопкой, открывающей Mini App на экране отзыва.
   */
  async sendReviewRequest(
    telegramId: string,
    payload: {
      bookingId: string;
      bookingDate: string;
      formatName?: string;
      fullName?: string;
    }
  ): Promise<{ sent: boolean; errorCode?: number; errorMessage?: string }> {
    try {
      const miniAppUrl = process.env.MINI_APP_URL || 'https://your-domain.com';
      const reviewUrl = `${miniAppUrl}?screen=review-form&bookingId=${encodeURIComponent(payload.bookingId)}`;

      const message =
        '⭐ Будем благодарны за отзыв!\n\n' +
        `📅 Дата: ${payload.bookingDate}\n` +
        (payload.formatName ? `🎤 Формат: ${payload.formatName}\n` : '') +
        (payload.fullName ? `👤 Имя: ${payload.fullName}\n` : '') +
        '\nНажмите кнопку ниже, чтобы открыть форму отзыва:';

      await this.bot.sendMessage(telegramId, message, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '⭐ Оставить отзыв',
                web_app: { url: reviewUrl },
              },
            ],
          ],
        },
      });
      return { sent: true };
    } catch (err: unknown) {
      const code = getTelegramErrorCode(err);
      const description = getTelegramErrorDescription(err);
      if (code === 403) {
        logger.warn('Review request forbidden (user blocked bot or no chat)', {
          telegramId,
          bookingId: payload.bookingId,
          errorCode: code,
          errorMessage: description,
        });
      } else {
        logger.error('Error sending review request', {
          error: err,
          telegramId,
          bookingId: payload.bookingId,
          errorCode: code,
        });
      }
      return { sent: false, errorCode: code, errorMessage: description };
    }
  }

  /**
   * Рассылка участникам голосования: День 1 (24ч) и День 3 (72ч) после выступления.
   * campaignDay: 1 = Рассылка №1, 2 = Рассылка №2
   */
  async sendVotingFollowUp(
    telegramIds: string[],
    campaignDay: number
  ): Promise<{ sent: number; failed: number }> {
    const miniAppUrl = process.env.MINI_APP_URL || 'https://your-domain.com';
    const replyMarkup = {
      inline_keyboard: [[{ text: '📱 Открыть приложение', web_app: { url: miniAppUrl } }]],
    };

    const messages: Record<number, string> = {
      1: // День 1. Рассылка №1 — на след день после выступления
        'Салют! 👋\n\n' +
        'Ох и вечерок у нас вчера прошел. Да-да, мы все видели, как вы подпевали и танцевали (даже ногой под столом)💃\n\n' +
        'Как ваше самочувствие после вчерашнего?\n\n' +
        'Спасибо, что в этот вечер были с нами! Ваша энергия нам просто необходима, чтобы мы вместе заряжали эту картечь на весь город🔥\n\n' +
        'Давай скорее восстанавливайся, нам нужно ещё поближе познакомиться😉\n\n' +
        'Хорошего дня и до новых встреч!',
      2: // День 3. Рассылка №2 — через день после первой
        'И снова здравствуйте! Мы гангстеры порядочные. Всё делаем с уважением🤘\n\n' +
        'Приглашаем к нам в гости!\n' +
        '«В гостях у Лементалия» — в прямом смысле🏠\n\n' +
        'Будем рады видеть тебя в нашем БОТЕ. Жми кнопку «Открыть приложение» и добро пожаловать!\n\n' +
        '🔴 С уважением «ВГУЛ»',
    };

    const message = messages[campaignDay] ?? messages[1];

    let sent = 0;
    let failed = 0;
    for (const telegramId of telegramIds) {
      try {
        await this.bot.sendMessage(telegramId, message, { reply_markup: replyMarkup });
        sent++;
      } catch (err: unknown) {
        failed++;
        const code = getTelegramErrorCode(err);
        if (code !== 403) {
          const id = typeof telegramId === 'string' ? telegramId : String(telegramId);
          logger.error('Voting follow-up send failed', { telegramId: id, error: err });
        }
      }
      if (sent % 25 === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    return { sent, failed };
  }

  /**
   * Уведомление проголосовавшего о победителе голосования
   */
  async sendVotingWinnerNotification(
    telegramId: bigint,
    winningSong: { id: string; title: string; artist: string; coverUrl: string | null },
    sessionId: string
  ): Promise<void> {
    try {
      const miniAppUrl = process.env.MINI_APP_URL || 'https://your-domain.com';
      const winnerUrl = `${miniAppUrl}?screen=winning-song&songId=${winningSong.id}&sessionId=${sessionId}`;

      await this.bot.sendMessage(
        telegramId.toString(),
        `🎉 Голосование завершено!\n\nПобедитель: ${winningSong.title} — ${winningSong.artist}\n\nОткройте приложение, чтобы увидеть результат:`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🏆 Смотреть победителя',
                  web_app: { url: winnerUrl },
                },
              ],
            ],
          },
        }
      );
    } catch (err: unknown) {
      const code = getTelegramErrorCode(err);
      if (code === 403) {
        logger.warn('User blocked the bot, skipping winner notification', {
          telegramId: telegramId.toString(),
        });
      } else {
        logger.error('Error sending voting winner notification', {
          error: err,
          telegramId: telegramId.toString(),
        });
      }
    }
  }

  /**
   * Отправка уведомления о новом сообщении от администратора
   */
  async sendAdminMessage(telegramId: number, message: string): Promise<void> {
    try {
      await this.bot.sendMessage(telegramId, `📩 Сообщение от администратора:\n\n${message}`);
    } catch (err: unknown) {
      const code = getTelegramErrorCode(err);
      if (code === 403) {
        logger.warn('User blocked the bot', { telegramId });
      } else {
        logger.error('Error sending admin message', { error: err, telegramId });
      }
    }
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
