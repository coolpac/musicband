import type { Platform } from '@prisma/client';
import { logger } from '../../../shared/utils/logger';
import { ReferralService } from '../../../domain/services/ReferralService';
import { IOnboardingRepository } from '../../database/repositories/OnboardingRepository';
import { redis } from '../../../config/redis';
import type {
  BookingNotice,
  ReviewNotice,
  ReviewRequestResult,
  SongNotice,
  BatchSendResult,
} from '../types';
import { MaxClient, type MaxButton } from './maxClient';
import { classifyMaxError } from './maxErrors';

/** Префикс Redis для онбординга в Max (отдельно от Telegram onb_pending:<chatId>). */
const REDIS_ONBOARDING_PREFIX = 'onb_pending:max:';
/** Префикс Redis для отложенного голосования в Max (отдельно от Telegram pending_vote:<chatId>). */
const REDIS_PENDING_VOTE_PREFIX = 'pending_vote:max:';
const ONBOARDING_TTL = 600; // 10 мин на подтверждение

function miniAppUrl(): string {
  return process.env.MINI_APP_URL || process.env.FRONTEND_URL || 'https://your-domain.com';
}

/**
 * Пользовательский бот Max. Зеркалит src/infrastructure/telegram/UserBot.ts:
 * онбординг «Кто вы?», deep-link голосования/рефералов, приветствие, и user-facing
 * методы PlatformBots (booking/review/voting).
 *
 * Логика обработчиков вынесена в публичные методы (handleBotStarted/handleStart/
 * handleHelp/handleCallback), а в конструкторе они только привязываются к bot.on/
 * bot.command. Это позволяет тестировать поведение без реального long-poll.
 *
 * Текст сообщений скопирован из UserBot, чтобы формулировки совпадали между платформами.
 * Кнопка открытия Mini App — link-кнопка на URL (в Max нет open_app-хелпера; полноценный
 * startapp deep-link — Phase 6).
 */
export class MaxUserBot {
  readonly platform: Platform = 'max';

  constructor(
    private readonly client: MaxClient,
    private readonly referralService: ReferralService,
    private readonly onboardingRepository: IOnboardingRepository
  ) {
    this.registerHandlers();
    logger.info('Max User Bot initialized');
  }

  private registerHandlers(): void {
    const bot = this.client.bot;

    // Deep-link вход: ?start=<payload>
    bot.on('bot_started', async (ctx) => {
      try {
        await this.handleBotStarted(ctx.user.user_id, ctx.startPayload ?? null);
      } catch (error) {
        logger.error('Max: error handling bot_started', { error });
      }
    });

    // /start без payload → онбординг
    bot.command('start', async (ctx) => {
      try {
        const userId = ctx.message?.sender?.user_id ?? ctx.chatId;
        if (userId) await this.handleStart(userId);
      } catch (error) {
        logger.error('Max: error handling /start', { error });
      }
    });

    // /help
    bot.command('help', async (ctx) => {
      try {
        const userId = ctx.message?.sender?.user_id ?? ctx.chatId;
        if (userId) await this.handleHelp(userId);
      } catch (error) {
        logger.error('Max: error handling /help', { error });
      }
    });

    // Callback-кнопки (онбординг)
    bot.on('message_callback', async (ctx) => {
      try {
        const cb = ctx.callback;
        if (!cb) return;
        const userId = cb.user.user_id;
        await this.handleCallback(userId, cb.payload ?? '', cb.callback_id, cb.user);
      } catch (error) {
        logger.error('Max: error handling message_callback', { error });
      }
    });

    bot.catch((error) => {
      logger.error('Max bot error', { error });
    });
  }

  // --- handlers (тестируемы напрямую) ---

  /** Обработка deep-link входа bot_started. */
  async handleBotStarted(userId: number, payload: string | null): Promise<void> {
    const trimmed = payload?.trim();

    if (trimmed && trimmed.startsWith('vote_')) {
      await this.handleVotingDeepLink(userId, trimmed.substring(5));
      return;
    }
    if (trimmed) {
      await this.handleReferralLink(userId, trimmed);
      return;
    }
    await this.handleStart(userId);
  }

  /** Обычный старт: онбординг «Кто вы?» (или приветствие, если уже отвечал). */
  async handleStart(userId: number): Promise<void> {
    const existing = await this.onboardingRepository.findByIdentity('max', BigInt(userId));
    if (existing) {
      await this.sendWelcome(userId);
      return;
    }
    await this.sendOnboardingWhoAreYou(userId);
  }

  /** /help — то же содержимое, что и в UserBot. */
  async handleHelp(userId: number): Promise<void> {
    await this.client.sendMessage(
      userId,
      '📱 Откройте Mini App для:\n\n' +
        '🎵 Голосования за песни\n' +
        '📅 Бронирования\n' +
        '⭐ Оставления отзывов\n\n' +
        'Для открытия Mini App нажмите на кнопку меню бота.'
    );
  }

  /** Онбординг: вопрос «Если не секрет, кто вы?» с тремя кнопками. */
  private async sendOnboardingWhoAreYou(userId: number): Promise<void> {
    await this.client.sendMessageWithKeyboard(userId, 'Если не секрет, кто вы?', [
      [{ kind: 'callback', text: 'Просто Человек', payload: 'onb:person' }],
      [{ kind: 'callback', text: 'Организатор', payload: 'onb:organizer' }],
      [{ kind: 'callback', text: 'Агент', payload: 'onb:agent' }],
    ]);
  }

  /** Приветственное сообщение с кнопкой «Открыть приложение» (link на Mini App). */
  private async sendWelcome(userId: number): Promise<void> {
    const welcomeText =
      'Добро пожаловать! Теперь и ты — «В гостях у Лементалия». Располагайся и чувствуй себя как дома.\n' +
      'Cover-группа «ВГУЛ» в твоём распоряжении.\n\n' +
      'Здесь мы познакомимся поближе.\n\n' +
      'Ты узнаешь:\n' +
      '• о наших форматах\n' +
      '• увидишь наши выступления\n' +
      '• услышишь, как мы звучим.\n\n' +
      'А после ты с лёгкостью можешь пригласить нас на своё событие, где мы с огромным удовольствием сделаем его незабываемым, остросюжетным и грандиозным!';

    await this.client.sendMessageWithKeyboard(userId, welcomeText, [
      [{ kind: 'link', text: '📱 Открыть приложение', url: miniAppUrl() }],
    ]);
  }

  /** Обработка реферальной ссылки (userAgent = Max:<userId>, IP недоступен). */
  private async handleReferralLink(userId: number, referralCode: string): Promise<void> {
    try {
      const result = await this.referralService.handleLinkClick(
        referralCode,
        undefined, // IP адрес недоступен в Max Bot API
        `Max:${userId}`
      );

      await this.client.sendMessage(
        userId,
        '✅ Спасибо за переход по реферальной ссылке!\n\n' +
          'Откройте Mini App для регистрации и получения бонусов.'
      );

      logger.info('Referral link clicked via Max User Bot', {
        userId,
        referralCode,
        linkId: result.link.id,
      });
    } catch (error: unknown) {
      logger.error('Max: error handling referral link', { error, userId, referralCode });
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found') || msg.includes('not active')) {
        await this.client.sendMessage(
          userId,
          '⚠️ Реферальная ссылка недействительна или истекла.'
        );
      } else {
        await this.client.sendMessage(userId, '❌ Произошла ошибка при обработке ссылки.');
      }
    }
  }

  /**
   * Deep link голосования vote_{sessionId}: отправляем link-кнопку на Mini App
   * (?screen=voting&sessionId=...) и сохраняем сессию в Redis как fallback.
   */
  private async handleVotingDeepLink(userId: number, sessionId: string): Promise<void> {
    try {
      const votingUrl = `${miniAppUrl()}?screen=voting&sessionId=${sessionId}`;

      await redis.setex(`${REDIS_PENDING_VOTE_PREFIX}${userId}`, 3600, sessionId);

      logger.info('Max: sending voting link button', { userId, sessionId, votingUrl });

      await this.client.sendMessageWithKeyboard(
        userId,
        '🎵 Голосование за песню!\n\nНажмите кнопку ниже, чтобы проголосовать:',
        [[{ kind: 'link', text: '🎵 Голосовать', url: votingUrl }]]
      );
    } catch (error) {
      logger.error('Max: error handling voting deep link', { error, userId, sessionId });
      await this.client.sendMessage(userId, 'Не удалось открыть голосование. Попробуйте позже.');
    }
  }

  /**
   * Обработка callback-кнопок онбординга.
   * cb.user передаётся для уведомления админов (имя/username).
   */
  async handleCallback(
    userId: number,
    data: string,
    callbackId: string,
    user: { user_id: number; name: string; username?: string | null }
  ): Promise<void> {
    await this.client.answerCallback(callbackId);

    if (data === 'onb:person' || data === 'onb:organizer' || data === 'onb:agent') {
      const role =
        data === 'onb:person' ? 'just_person' : data === 'onb:organizer' ? 'organizer' : 'agent';
      await redis.setex(`${REDIS_ONBOARDING_PREFIX}${userId}`, ONBOARDING_TTL, role);
      await this.client.sendMessageWithKeyboard(userId, 'Точно?', [
        [{ kind: 'callback', text: 'Точно', payload: 'onb:confirm' }],
      ]);
      return;
    }

    if (data === 'onb:confirm') {
      const key = `${REDIS_ONBOARDING_PREFIX}${userId}`;
      const role = await redis.get(key);
      if (!role) {
        await this.client.sendMessage(
          userId,
          'Выбор устарел. Нажмите /start и выберите снова.'
        );
        return;
      }
      await redis.del(key);
      await this.onboardingRepository.create('max', BigInt(userId), role);

      // Уведомляем админов о новом пользователе (через сам BotManager, как UserBot).
      try {
        const { getBotManager } = await import('../BotManager');
        const botManager = getBotManager();
        if (botManager) {
          await botManager.notifyNewUser({
            platform: 'max',
            platformId: userId.toString(),
            username: user.username ?? undefined,
            firstName: user.name,
          });
        }
      } catch (notifyError) {
        logger.warn('Max: failed to send new user notification from onboarding', {
          error: notifyError,
        });
      }

      await this.sendWelcome(userId);
    }
  }

  // --- PlatformBots user-facing methods ---

  async sendBookingReceived(platformId: string, booking: BookingNotice): Promise<void> {
    const message =
      '✅ Заявка получена!\n\n' +
      `📅 Дата: ${booking.bookingDate}\n` +
      (booking.formatName ? `🎤 Формат: ${booking.formatName}\n` : '') +
      `👤 Имя: ${booking.fullName}\n\n` +
      'С вами свяжется менеджер в ближайшее время.';
    await this.safeSend(platformId, () => this.client.sendMessage(Number(platformId), message));
  }

  async sendBookingConfirmation(platformId: string, booking: BookingNotice): Promise<void> {
    const message =
      '✅ Ваше бронирование подтверждено!\n\n' +
      `📅 Дата: ${booking.bookingDate}\n` +
      (booking.formatName ? `🎤 Формат: ${booking.formatName}\n` : '') +
      `👤 Имя: ${booking.fullName}\n\n` +
      'С вами свяжутся в ближайшее время.';
    await this.safeSend(platformId, () => this.client.sendMessage(Number(platformId), message));
  }

  async sendReviewRequest(platformId: string, review: ReviewNotice): Promise<ReviewRequestResult> {
    try {
      const reviewUrl = `${miniAppUrl()}?screen=review-form&bookingId=${encodeURIComponent(review.bookingId)}`;
      const message =
        '⭐ Будем благодарны за отзыв!\n\n' +
        `📅 Дата: ${review.bookingDate}\n` +
        (review.formatName ? `🎤 Формат: ${review.formatName}\n` : '') +
        (review.fullName ? `👤 Имя: ${review.fullName}\n` : '') +
        '\nНажмите кнопку ниже, чтобы открыть форму отзыва:';

      await this.client.sendMessageWithKeyboard(Number(platformId), message, [
        [{ kind: 'link', text: '⭐ Оставить отзыв', url: reviewUrl }],
      ]);
      return { sent: true };
    } catch (err: unknown) {
      const info = classifyMaxError(err);
      if (info.isUserUnreachable) {
        logger.warn('Max: review request forbidden (user blocked bot)', {
          platformId,
          bookingId: review.bookingId,
        });
      } else {
        logger.error('Max: error sending review request', {
          error: err,
          platformId,
          bookingId: review.bookingId,
        });
      }
      return { sent: false, errorCode: info.status, errorMessage: info.message };
    }
  }

  async sendVotingFollowUp(platformIds: string[], campaignDay: number): Promise<BatchSendResult> {
    const messages: Record<number, string> = {
      1: 'Салют! 👋\n\n' +
        'Ох и вечерок у нас вчера прошел. Да-да, мы все видели, как вы подпевали и танцевали (даже ногой под столом)💃\n\n' +
        'Как ваше самочувствие после вчерашнего?\n\n' +
        'Спасибо, что в этот вечер были с нами! Ваша энергия нам просто необходима, чтобы мы вместе заряжали эту картечь на весь город🔥\n\n' +
        'Давай скорее восстанавливайся, нам нужно ещё поближе познакомиться😉\n\n' +
        'Хорошего дня и до новых встреч!',
      2: 'И снова здравствуйте! Мы гангстеры порядочные. Всё делаем с уважением🤘\n\n' +
        'Приглашаем к нам в гости!\n' +
        '«В гостях у Лементалия» — в прямом смысле🏠\n\n' +
        'Будем рады видеть тебя в нашем БОТЕ. Жми кнопку «Открыть приложение» и добро пожаловать!\n\n' +
        '🔴 С уважением «ВГУЛ»',
    };
    const message = messages[campaignDay] ?? messages[1];
    const buttons: MaxButton[][] = [
      [{ kind: 'link', text: '📱 Открыть приложение', url: miniAppUrl() }],
    ];

    let sent = 0;
    let failed = 0;
    for (const platformId of platformIds) {
      try {
        await this.client.sendMessageWithKeyboard(Number(platformId), message, buttons);
        sent++;
      } catch (err: unknown) {
        failed++;
        const info = classifyMaxError(err);
        if (!info.isUserUnreachable) {
          logger.error('Max: voting follow-up send failed', { platformId, error: err });
        }
      }
      if (sent % 25 === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    return { sent, failed };
  }

  async sendVotingWinner(platformId: string, song: SongNotice, sessionId: string): Promise<void> {
    try {
      const winnerUrl = `${miniAppUrl()}?screen=winning-song&songId=${song.id}&sessionId=${sessionId}`;
      await this.client.sendMessageWithKeyboard(
        Number(platformId),
        `🎉 Голосование завершено!\n\nПобедитель: ${song.title} — ${song.artist}\n\nОткройте приложение, чтобы увидеть результат:`,
        [[{ kind: 'link', text: '🏆 Смотреть победителя', url: winnerUrl }]]
      );
    } catch (err: unknown) {
      const info = classifyMaxError(err);
      if (info.isUserUnreachable) {
        logger.warn('Max: user blocked the bot, skipping winner notification', { platformId });
      } else {
        logger.error('Max: error sending voting winner notification', { error: err, platformId });
      }
    }
  }

  /** Запуск long-poll (делегирует MaxClient). */
  async start(): Promise<void> {
    await this.client.start();
  }

  /** Остановка long-poll. */
  stop(): void {
    this.client.stop();
  }

  /**
   * Отправка с проглатыванием ошибки «пользователь недоступен» (заблокировал бота),
   * по аналогии с тем, как UserBot логирует "User blocked the bot" на 403.
   */
  private async safeSend(platformId: string, send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch (err: unknown) {
      const info = classifyMaxError(err);
      if (info.isUserUnreachable) {
        logger.warn('Max: user blocked the bot', { platformId });
      } else {
        logger.error('Max: error sending message', { error: err, platformId });
      }
    }
  }
}
