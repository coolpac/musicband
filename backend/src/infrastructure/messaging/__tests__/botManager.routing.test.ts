// Избегаем инстанцирования реального PrismaClient/Redis (нужен DATABASE_URL):
// BotManager транзитивно импортирует AdminBot -> config/database.
// Маршрутизируемые методы, проверяемые здесь, БД не используют.
jest.mock('../../../config/database', () => ({ prisma: {} }));
jest.mock('../../../config/redis', () => ({ redis: {} }));

import { BotManager } from '../BotManager';
import type { PlatformBots } from '../types';
import type { Platform } from '@prisma/client';

/**
 * Проверяем, что BotManager маршрутизирует уведомления только в адаптер,
 * соответствующий целевой платформе (telegram vs max).
 */
function makeFakeBots(platform: Platform): jest.Mocked<PlatformBots> {
  return {
    platform,
    start: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    sendBookingReceived: jest.fn().mockResolvedValue(undefined),
    sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    sendReviewRequest: jest.fn().mockResolvedValue({ sent: true }),
    sendVotingFollowUp: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    sendVotingWinner: jest.fn().mockResolvedValue(undefined),
    notifyNewBooking: jest.fn().mockResolvedValue(undefined),
    notifyNewUser: jest.fn().mockResolvedValue(undefined),
    broadcast: jest.fn().mockResolvedValue({ sent: 0, failed: 0, total: 0 }),
    sendCsvToAdmin: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<PlatformBots>;
}

describe('BotManager platform routing', () => {
  const makeManager = () => {
    // Репозитории/сервисы не используются в маршрутизируемых методах — передаём заглушки.
    const noop = {} as never;
    return new BotManager(noop, noop, noop, noop, noop);
  };

  let telegramBots: jest.Mocked<PlatformBots>;
  let maxBots: jest.Mocked<PlatformBots>;
  let manager: BotManager;

  beforeEach(() => {
    telegramBots = makeFakeBots('telegram');
    maxBots = makeFakeBots('max');
    manager = makeManager();
    manager.registerPlatform(telegramBots);
    manager.registerPlatform(maxBots);
  });

  it('sendBookingReceived routes only to the telegram adapter', async () => {
    const booking = { bookingDate: '2026-01-01', fullName: 'Ann' };
    await manager.sendBookingReceived({ platform: 'telegram', platformId: '111' }, booking);

    expect(telegramBots.sendBookingReceived).toHaveBeenCalledWith('111', booking);
    expect(maxBots.sendBookingReceived).not.toHaveBeenCalled();
  });

  it('sendBookingReceived routes only to the max adapter', async () => {
    const booking = { bookingDate: '2026-01-01', fullName: 'Bob' };
    await manager.sendBookingReceived({ platform: 'max', platformId: '222' }, booking);

    expect(maxBots.sendBookingReceived).toHaveBeenCalledWith('222', booking);
    expect(telegramBots.sendBookingReceived).not.toHaveBeenCalled();
  });

  it('notifyNewBooking routes only to the matching adapter', async () => {
    const booking = {
      id: 'b1',
      bookingDate: '2026-01-01',
      fullName: 'Ann',
      contactValue: '+7',
    };
    await manager.notifyNewBooking({ platform: 'telegram' }, booking);

    expect(telegramBots.notifyNewBooking).toHaveBeenCalledWith(booking);
    expect(maxBots.notifyNewBooking).not.toHaveBeenCalled();
  });

  it('notifyNewUser routes by the notice platform field', async () => {
    await manager.notifyNewUser({ platform: 'max', platformId: '333' });

    expect(maxBots.notifyNewUser).toHaveBeenCalled();
    expect(telegramBots.notifyNewUser).not.toHaveBeenCalled();
  });

  it('sendCsvToAdmin routes only to the matching adapter', async () => {
    const buf = Buffer.from('x');
    await manager.sendCsvToAdmin({ platform: 'telegram', platformId: '9' }, buf, 'f.csv');

    expect(telegramBots.sendCsvToAdmin).toHaveBeenCalledWith('9', buf, 'f.csv');
    expect(maxBots.sendCsvToAdmin).not.toHaveBeenCalled();
  });

  it('is a no-op when the target platform is not registered', async () => {
    const onlyTelegram = makeManager();
    onlyTelegram.registerPlatform(telegramBots);

    await expect(
      onlyTelegram.sendBookingReceived(
        { platform: 'max', platformId: '5' },
        {
          bookingDate: '2026-01-01',
          fullName: 'X',
        }
      )
    ).resolves.toBeUndefined();
    expect(telegramBots.sendBookingReceived).not.toHaveBeenCalled();
  });
});
