import { Bot, Keyboard } from '@maxhub/max-bot-api';
import { logger } from '../../../shared/utils/logger';

// Эти типы пакет не реэкспортирует из корня, а импорт из внутренних путей
// (dist/core/... или subpath ./types) хрупок и зависит от moduleResolution.
// Поэтому извлекаем их из публично экспортированного Bot через Parameters<>.
type SendMessageExtra = NonNullable<Parameters<Bot['api']['sendMessageToUser']>[2]>;
export type MessageAttachment = NonNullable<SendMessageExtra['attachments']>[number];
type AnswerOnCallbackExtra = NonNullable<Parameters<Bot['api']['answerOnCallback']>[1]>;
type BotCommand = Parameters<Bot['api']['setMyCommands']>[0][number];
type UpdateType = NonNullable<Parameters<Bot['start']>[0]>['allowedUpdates'][number];

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
    // .toJson() обязателен: uploadVideo возвращает ИНСТАНС VideoAttachment с методом
    // toJson() (НЕ toJSON), который JSON.stringify при отправке не вызывает — без этого
    // тело уходит без обёртки payload и Max отвечает 400 "Can't deserialize body".
    const video = (await this.bot.api.uploadVideo({ source })).toJson() as unknown as MessageAttachment;
    const attachments: MessageAttachment[] = [video, ...(opts?.attachments ?? [])];
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

  /**
   * Загрузка изображения (Buffer/URL/path) и отправка его пользователю с подписью
   * и (опционально) inline-клавиатурой. Зеркалит uploadAndSendVideo.
   * Используется для отправки QR-кода голосования админам Max.
   */
  async uploadAndSendImage(
    userId: number,
    source: Buffer | string,
    caption: string,
    buttonRows?: MaxButton[][],
    opts?: SendMessageExtra
  ): Promise<void> {
    // .toJson() обязателен: uploadImage возвращает ИНСТАНС ImageAttachment с методом
    // toJson() (НЕ toJSON) и payload-геттером, поэтому JSON.stringify сериализует его как
    // {photos:{...}} без обёртки payload → Max отвечает 400 "Can't deserialize body".
    // Берём готовый плоский объект {type,payload} (как Keyboard.inlineKeyboard).
    const image = (await this.bot.api.uploadImage({ source })).toJson() as unknown as MessageAttachment;
    const attachments: MessageAttachment[] = [image, ...(opts?.attachments ?? [])];
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

  /**
   * Загрузить изображение/видео в Max ОДИН раз и вернуть вложение для переиспользования
   * (рассылка отправляет одно и то же медиа многим получателям — грузим единожды).
   * source — именно БАЙТЫ (Buffer). Строку Max-SDK трактует как путь в ФС (fs.stat),
   * поэтому URL/file_id сюда передавать нельзя — только буфер.
   */
  async uploadMediaAttachment(
    kind: 'image' | 'video',
    source: Buffer
  ): Promise<MessageAttachment> {
    const uploaded =
      kind === 'video'
        ? await this.bot.api.uploadVideo({ source })
        : await this.bot.api.uploadImage({ source });
    // .toJson() обязателен: uploaded — ИНСТАНС (Image/VideoAttachment) с методом toJson()
    // (НЕ toJSON), который JSON.stringify при отправке не вызывает. Без него тело
    // сериализуется без обёртки payload → Max отвечает 400 "Can't deserialize body".
    return uploaded.toJson() as unknown as MessageAttachment;
  }

  /**
   * Отправить сообщение с уже загруженными вложениями и (опционально) inline-клавиатурой.
   * Не грузит медиа заново — принимает готовые attachments (см. uploadMediaAttachment).
   */
  async sendMessageWithAttachments(
    userId: number,
    text: string,
    attachments: MessageAttachment[],
    buttonRows?: MaxButton[][],
    opts?: SendMessageExtra
  ): Promise<void> {
    const all: MessageAttachment[] = [...attachments, ...(opts?.attachments ?? [])];
    if (buttonRows?.length) {
      all.push(
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
    await this.bot.api.sendMessageToUser(userId, text, { ...opts, attachments: all });
  }

  /**
   * Ответ на callback (закрывает «часики» на кнопке).
   * ВАЖНО: Max API требует `message` ИЛИ `notification` в ответе (Telegram позволяет
   * пустой ack, Max отвечает 400 proto.payload) — поэтому без opts шлём дефолтную
   * notification. Сбой ack-а не пробрасываем: он не должен убивать обработчик кнопки.
   */
  async answerCallback(callbackId: string, opts?: AnswerOnCallbackExtra): Promise<void> {
    try {
      await this.bot.api.answerOnCallback(callbackId, opts ?? { notification: '✓' });
    } catch (error) {
      logger.warn('Max: answerOnCallback failed (continuing)', { callbackId, error });
    }
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
