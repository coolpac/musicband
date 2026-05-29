import { Bot, Keyboard } from '@maxhub/max-bot-api';
import type {
  AnswerOnCallbackExtra,
  BotCommand,
  SendMessageExtra,
  UpdateType,
} from '@maxhub/max-bot-api/dist/core/network/api';
import { logger } from '../../../shared/utils/logger';

/**
 * Описание inline-кнопки в нейтральном виде (без привязки к SDK).
 * MaxClient транслирует это в кнопки Keyboard.button.* при сборке клавиатуры.
 */
export type MaxButton =
  | { kind: 'callback'; text: string; payload: string }
  | { kind: 'link'; text: string; url: string };

/** Список типов обновлений, на которые подписывается long-poll Max. */
const DEFAULT_ALLOWED_UPDATES: UpdateType[] = [
  'bot_started',
  'message_created',
  'message_callback',
];

/**
 * Тонкая обёртка над инстансом Bot из @maxhub/max-bot-api, предоставляющая
 * операции, нужные ботам (MaxUserBot/MaxAdminBot): отправка сообщений и клавиатур,
 * ответ на callback, регистрация команд, запуск/остановка long-poll.
 *
 * Bot инжектируется (а не создаётся внутри), чтобы:
 *  - регистрировать обработчики снаружи (bot.command/bot.on/...) через .bot;
 *  - тестировать обёртку на замоканном bot без реального поллинга.
 */
export class MaxClient {
  constructor(public readonly bot: Bot) {}

  /** Фабрика: создаёт MaxClient с реальным Bot по токену (поллинг НЕ стартует здесь). */
  static fromToken(token: string): MaxClient {
    return new MaxClient(new Bot(token));
  }

  /** Отправка простого текстового сообщения пользователю. */
  async sendMessage(userId: number, text: string, opts?: SendMessageExtra): Promise<void> {
    await this.bot.api.sendMessageToUser(userId, text, opts);
  }

  /**
   * Отправка сообщения с inline-клавиатурой.
   * Клавиатура строится через Keyboard.inlineKeyboard и кладётся в extra.attachments.
   */
  async sendMessageWithKeyboard(
    userId: number,
    text: string,
    buttonRows: MaxButton[][],
    opts?: SendMessageExtra
  ): Promise<void> {
    const keyboard = Keyboard.inlineKeyboard(
      buttonRows.map((row) =>
        row.map((b) =>
          b.kind === 'callback'
            ? Keyboard.button.callback(b.text, b.payload)
            : Keyboard.button.link(b.text, b.url)
        )
      )
    );
    await this.bot.api.sendMessageToUser(userId, text, {
      ...opts,
      attachments: [...(opts?.attachments ?? []), keyboard],
    });
  }

  /**
   * Загрузка видео и отправка его пользователю с подписью и (опционально) клавиатурой.
   * Используется для приветственного видео (опционально в Phase 4).
   */
  async uploadAndSendVideo(
    userId: number,
    source: string,
    caption: string,
    buttonRows?: MaxButton[][],
    opts?: SendMessageExtra
  ): Promise<void> {
    const video = await this.bot.api.uploadVideo({ source });
    const attachments = [video, ...(opts?.attachments ?? [])];
    if (buttonRows?.length) {
      attachments.push(
        Keyboard.inlineKeyboard(
          buttonRows.map((row) =>
            row.map((b) =>
              b.kind === 'callback'
                ? Keyboard.button.callback(b.text, b.payload)
                : Keyboard.button.link(b.text, b.url)
            )
          )
        )
      );
    }
    await this.bot.api.sendMessageToUser(userId, caption, { ...opts, attachments });
  }

  /** Ответ на callback (закрывает «часики» на кнопке). */
  async answerCallback(callbackId: string, opts?: AnswerOnCallbackExtra): Promise<void> {
    await this.bot.api.answerOnCallback(callbackId, opts);
  }

  /** Регистрация списка команд бота (меню). */
  async setMyCommands(commands: BotCommand[]): Promise<void> {
    await this.bot.api.setMyCommands(commands);
  }

  /** Информация о боте. */
  async getMe() {
    return this.bot.api.getMyInfo();
  }

  /**
   * Запуск long-poll. КРИТИЧНО: bot.start() — это бесконечный цикл, который резолвится
   * только при stop(). Поэтому запускаем его fire-and-forget (void + .catch) и резолвим
   * сразу, иначе вызывающий код (BotManager.initialize) завис бы навсегда.
   */
  async start(allowedUpdates: UpdateType[] = DEFAULT_ALLOWED_UPDATES): Promise<void> {
    void this.bot
      .start({ allowedUpdates })
      .catch((error: unknown) => {
        logger.error('Max bot polling loop terminated', { error });
      });
    logger.info('Max bot polling started');
  }

  /** Остановка long-poll (graceful shutdown). */
  stop(): void {
    this.bot.stop();
  }
}
