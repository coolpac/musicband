import { MaxClient } from '../maxClient';

/**
 * MaxClient — тонкая обёртка над инстансом Bot из @maxhub/max-bot-api.
 * Тестируем на замоканном bot: вызовы делегируются в bot.api, клавиатуры строятся
 * через Keyboard.inlineKeyboard, а start() НЕ ждёт бесконечный poll-loop.
 */
function makeFakeBot() {
  return {
    api: {
      sendMessageToUser: jest.fn().mockResolvedValue({ message: {} }),
      answerOnCallback: jest.fn().mockResolvedValue({ success: true }),
      setMyCommands: jest.fn().mockResolvedValue({}),
      getMyInfo: jest.fn().mockResolvedValue({ user_id: 1, name: 'bot' }),
      // Реальный SDK возвращает ИНСТАНСЫ Image/VideoAttachment: «сырые» поля + метод
      // toJson() (НЕ toJSON). Зеркалим это, чтобы тест ловил регресс, если код положит
      // инстанс в attachments без toJson() (Max -> 400 "Can't deserialize body").
      uploadVideo: jest.fn().mockResolvedValue({
        token: 't',
        toJson: () => ({ type: 'video', payload: { token: 't' } }),
      }),
      uploadImage: jest.fn().mockResolvedValue({
        photos: { k: { token: 'img' } },
        toJson: () => ({ type: 'image', payload: { photos: { k: { token: 'img' } } } }),
      }),
    },
    start: jest.fn(),
    stop: jest.fn(),
    command: jest.fn(),
    on: jest.fn(),
    action: jest.fn(),
    catch: jest.fn(),
  };
}

describe('MaxClient', () => {
  it('sendMessage delegates to bot.api.sendMessageToUser', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);

    await client.sendMessage(123, 'hello');

    expect(bot.api.sendMessageToUser).toHaveBeenCalledWith(123, 'hello', undefined);
  });

  it('sendMessage forwards extra options', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);

    await client.sendMessage(123, 'hi', { format: 'markdown' });

    expect(bot.api.sendMessageToUser).toHaveBeenCalledWith(123, 'hi', { format: 'markdown' });
  });

  it('sendMessageWithKeyboard builds an inline keyboard attachment from button rows', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);

    await client.sendMessageWithKeyboard(123, 'pick', [
      [{ kind: 'callback', text: 'A', payload: 'onb:a' }],
      [{ kind: 'link', text: 'Open', url: 'https://app.example/x' }],
    ]);

    expect(bot.api.sendMessageToUser).toHaveBeenCalledTimes(1);
    const [userId, text, extra] = bot.api.sendMessageToUser.mock.calls[0];
    expect(userId).toBe(123);
    expect(text).toBe('pick');
    expect(extra.attachments).toHaveLength(1);
    const attachment = extra.attachments[0];
    expect(attachment.type).toBe('inline_keyboard');
    expect(attachment.payload.buttons).toEqual([
      [{ type: 'callback', text: 'A', payload: 'onb:a' }],
      [{ type: 'link', text: 'Open', url: 'https://app.example/x' }],
    ]);
  });

  it('uploadMediaAttachment("image", buffer) uploads via uploadImage and returns the attachment', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);
    const bytes = Buffer.from('img-bytes');

    const att = await client.uploadMediaAttachment('image', bytes);

    expect(bot.api.uploadImage).toHaveBeenCalledWith({ source: bytes });
    expect(bot.api.uploadVideo).not.toHaveBeenCalled();
    // Возвращаем именно ПЛОСКИЙ результат toJson() {type,payload}, а не инстанс —
    // иначе Max не десериализует тело.
    expect(att).toEqual({ type: 'image', payload: { photos: { k: { token: 'img' } } } });
  });

  it('uploadMediaAttachment("video", buffer) uploads via uploadVideo (Buffer, not string)', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);
    const bytes = Buffer.from('clip-bytes');

    await client.uploadMediaAttachment('video', bytes);

    // Передаём именно Buffer (не строку): строку Max-SDK трактует как путь в ФС.
    expect(bot.api.uploadVideo).toHaveBeenCalledWith({ source: bytes });
    expect(Buffer.isBuffer(bot.api.uploadVideo.mock.calls[0][0].source)).toBe(true);
    expect(bot.api.uploadImage).not.toHaveBeenCalled();
  });

  it('sendMessageWithAttachments sends pre-uploaded media + appends a keyboard', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);
    const media = { type: 'image', payload: { token: 'img' } } as never;

    await client.sendMessageWithAttachments(123, 'cap', [media], [
      [{ kind: 'link', text: 'Open', url: 'https://app/x' }],
    ]);

    expect(bot.api.uploadImage).not.toHaveBeenCalled(); // не грузим повторно
    const [userId, text, extra] = bot.api.sendMessageToUser.mock.calls[0];
    expect(userId).toBe(123);
    expect(text).toBe('cap');
    // media-вложение + клавиатура
    expect(extra.attachments).toHaveLength(2);
    expect(extra.attachments[0]).toMatchObject({ type: 'image' });
    expect(extra.attachments[1].type).toBe('inline_keyboard');
  });

  it('uploadAndSendImage uploads a buffer then attaches it with the caption', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);
    const png = Buffer.from('fake-png');

    await client.uploadAndSendImage(123, png, 'caption text');

    expect(bot.api.uploadImage).toHaveBeenCalledWith({ source: png });
    expect(bot.api.sendMessageToUser).toHaveBeenCalledTimes(1);
    const [userId, text, extra] = bot.api.sendMessageToUser.mock.calls[0];
    expect(userId).toBe(123);
    expect(text).toBe('caption text');
    expect(extra.attachments[0]).toEqual({ type: 'image', payload: { photos: { k: { token: 'img' } } } });
  });

  it('uploadAndSendImage appends an inline keyboard when button rows are given', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);

    await client.uploadAndSendImage(123, Buffer.from('x'), 'cap', [
      [{ kind: 'link', text: 'Open', url: 'https://max.ru/bot?start=vote_s' }],
    ]);

    const [, , extra] = bot.api.sendMessageToUser.mock.calls[0];
    expect(extra.attachments).toHaveLength(2);
    expect(extra.attachments[0]).toEqual({ type: 'image', payload: { photos: { k: { token: 'img' } } } });
    expect(extra.attachments[1].type).toBe('inline_keyboard');
  });

  // Max API требует `message` или `notification` в ответе на callback (Telegram
  // позволяет пустой ack, Max — нет: 400 proto.payload). Голый answerCallback должен
  // подставлять дефолтную notification, иначе ВСЕ кнопки молча умирают.
  it('answerCallback without opts sends a default notification (Max requires it)', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);

    await client.answerCallback('cb-1');

    expect(bot.api.answerOnCallback).toHaveBeenCalledWith('cb-1', { notification: '✓' });
  });

  it('answerCallback passes explicit opts through unchanged', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);

    await client.answerCallback('cb-2', { notification: 'Готово' });

    expect(bot.api.answerOnCallback).toHaveBeenCalledWith('cb-2', { notification: 'Готово' });
  });

  it('answerCallback does not throw when the API rejects the ack', async () => {
    const bot = makeFakeBot();
    bot.api.answerOnCallback.mockRejectedValueOnce(new Error('400 proto.payload'));
    const client = new MaxClient(bot as never);

    await expect(client.answerCallback('cb-3')).resolves.toBeUndefined();
  });

  it('setMyCommands delegates to bot.api.setMyCommands', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);

    await client.setMyCommands([{ name: 'start', description: 'Начать' }]);

    expect(bot.api.setMyCommands).toHaveBeenCalledWith([{ name: 'start', description: 'Начать' }]);
  });

  it('getMe delegates to bot.api.getMyInfo', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);

    await client.getMe();

    expect(bot.api.getMyInfo).toHaveBeenCalled();
  });

  it('exposes the underlying bot for handler registration', () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);

    expect(client.bot).toBe(bot);
  });

  it('start() kicks off bot.start fire-and-forget and resolves immediately', async () => {
    const bot = makeFakeBot();
    // Симулируем бесконечный poll-loop: start() никогда не резолвится.
    let resolveStart: (() => void) | undefined;
    bot.start.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveStart = resolve;
      })
    );
    const client = new MaxClient(bot as never);

    // Если бы start() ждал bot.start(), этот await завис бы навсегда.
    await client.start();

    expect(bot.start).toHaveBeenCalled();
    // poll-loop всё ещё «крутится» — start() не дожидался его.
    expect(resolveStart).toBeDefined();
  });

  it('start() swallows poll-loop rejection without throwing', async () => {
    const bot = makeFakeBot();
    bot.start.mockRejectedValue(new Error('poll crashed'));
    const client = new MaxClient(bot as never);

    await expect(client.start()).resolves.toBeUndefined();
  });

  it('stop() delegates to bot.stop', () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);

    client.stop();

    expect(bot.stop).toHaveBeenCalled();
  });
});
