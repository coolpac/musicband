// Проверяем регистрацию Max-адаптера в BotManager.initialize():
// - Max регистрируется, когда заданы ОБА токена (MAX_USER_BOT_TOKEN + MAX_ADMIN_BOT_TOKEN);
// - Max НЕ регистрируется, если хотя бы один токен отсутствует (graceful skip),
//   при этом Telegram-регистрация остаётся неизменной.
//
// Мокаем тяжёлые зависимости (боты + Prisma/Redis), чтобы не было реального поллинга/БД.
jest.mock('../../../config/database', () => ({ prisma: {} }));
jest.mock('../../../config/redis', () => ({ redis: {} }));

// Telegram-боты: заглушки, чтобы конструкторы не лезли в Telegram SDK/сеть.
jest.mock('../../telegram/UserBot', () => ({
  UserBot: jest.fn().mockImplementation(() => ({ stop: jest.fn() })),
}));
jest.mock('../../telegram/AdminBot', () => ({
  AdminBot: jest.fn().mockImplementation(() => ({ stop: jest.fn() })),
}));

// TelegramBots / MaxBots: заглушки-адаптеры с нужным интерфейсом (platform + start/stop).
const telegramStart = jest.fn().mockResolvedValue(undefined);
jest.mock('../telegram/TelegramBots', () => ({
  TelegramBots: jest.fn().mockImplementation(() => ({
    platform: 'telegram',
    start: telegramStart,
    stop: jest.fn().mockResolvedValue(undefined),
  })),
}));

const maxStart = jest.fn().mockResolvedValue(undefined);
const maxFromTokens = jest.fn();
jest.mock('../max/MaxBots', () => ({
  MaxBots: { fromTokens: maxFromTokens },
}));

import { BotManager } from '../BotManager';
import { MaxBots } from '../max/MaxBots';

const TELEGRAM_USER = 'tg-user-token';
const TELEGRAM_ADMIN = 'tg-admin-token';

function makeManager() {
  const noop = {} as never;
  return new BotManager(noop, noop, noop, noop, noop);
}

function makeMaxAdapterStub() {
  return {
    platform: 'max' as const,
    start: maxStart,
    stop: jest.fn().mockResolvedValue(undefined),
  };
}

describe('BotManager Max registration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_USER_BOT_TOKEN = TELEGRAM_USER;
    process.env.TELEGRAM_ADMIN_BOT_TOKEN = TELEGRAM_ADMIN;
    delete process.env.MAX_USER_BOT_TOKEN;
    delete process.env.MAX_ADMIN_BOT_TOKEN;
    maxFromTokens.mockReturnValue(makeMaxAdapterStub());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('registers Max when BOTH Max tokens are set', async () => {
    process.env.MAX_USER_BOT_TOKEN = 'max-user-token';
    process.env.MAX_ADMIN_BOT_TOKEN = 'max-admin-token';

    const manager = makeManager();
    await manager.initialize();

    expect(MaxBots.fromTokens).toHaveBeenCalledTimes(1);
    expect(maxFromTokens).toHaveBeenCalledWith(
      'max-user-token',
      'max-admin-token',
      expect.objectContaining({
        onBookingConfirmed: expect.any(Function),
        onBroadcast: expect.any(Function),
      })
    );
    // Max adapter's start() was invoked through registerPlatform.
    expect(maxStart).toHaveBeenCalledTimes(1);
    // Telegram still registered unchanged.
    expect(telegramStart).toHaveBeenCalledTimes(1);
  });

  it('does NOT register Max when the user token is absent (Telegram-only, unchanged)', async () => {
    process.env.MAX_ADMIN_BOT_TOKEN = 'max-admin-token';
    // MAX_USER_BOT_TOKEN intentionally unset.

    const manager = makeManager();
    await manager.initialize();

    expect(MaxBots.fromTokens).not.toHaveBeenCalled();
    expect(maxStart).not.toHaveBeenCalled();
    // Telegram registration path unaffected.
    expect(telegramStart).toHaveBeenCalledTimes(1);
  });

  it('does NOT register Max when the admin token is absent', async () => {
    process.env.MAX_USER_BOT_TOKEN = 'max-user-token';
    // MAX_ADMIN_BOT_TOKEN intentionally unset.

    const manager = makeManager();
    await manager.initialize();

    expect(MaxBots.fromTokens).not.toHaveBeenCalled();
    expect(maxStart).not.toHaveBeenCalled();
    expect(telegramStart).toHaveBeenCalledTimes(1);
  });

  it('does NOT register Max when neither Max token is set (default test/CI env)', async () => {
    const manager = makeManager();
    await manager.initialize();

    expect(MaxBots.fromTokens).not.toHaveBeenCalled();
    expect(maxStart).not.toHaveBeenCalled();
    expect(telegramStart).toHaveBeenCalledTimes(1);
  });
});
