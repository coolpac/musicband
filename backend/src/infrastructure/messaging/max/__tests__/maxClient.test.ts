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
      uploadVideo: jest.fn().mockResolvedValue({ type: 'video', payload: { token: 't' } }),
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

  it('answerCallback delegates to bot.api.answerOnCallback', async () => {
    const bot = makeFakeBot();
    const client = new MaxClient(bot as never);

    await client.answerCallback('cb-1');

    expect(bot.api.answerOnCallback).toHaveBeenCalledWith('cb-1', undefined);
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
