// Phase 5: маршрутизация уведомлений по платформе получателя + фан-аут рассылок/
// follow-up/победителя по обеим платформам. Мокаем prisma (БД-оркестрация в BotManager)
// и адаптеры платформ.

// prisma-мок с управляемыми из тестов реализациями.
const userFindMany = jest.fn();
const queryRaw = jest.fn();
const followUpFindMany = jest.fn();
const followUpUpdate = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../config/database', () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => userFindMany(...a) },
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
    votingFollowUp: {
      findMany: (...a: unknown[]) => followUpFindMany(...a),
      update: (...a: unknown[]) => followUpUpdate(...a),
    },
  },
}));
jest.mock('../../../config/redis', () => ({ redis: {} }));

import { BotManager } from '../BotManager';
import type { PlatformBots } from '../types';
import type { Platform } from '@prisma/client';

function makeFakeBots(platform: Platform): jest.Mocked<PlatformBots> {
  return {
    platform,
    start: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    sendBookingReceived: jest.fn().mockResolvedValue(undefined),
    sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    sendReviewRequest: jest.fn().mockResolvedValue({ sent: true }),
    sendVotingFollowUp: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    sendVotingWinner: jest.fn().mockResolvedValue(undefined),
    notifyNewBooking: jest.fn().mockResolvedValue(undefined),
    notifyNewUser: jest.fn().mockResolvedValue(undefined),
    broadcast: jest.fn().mockResolvedValue({ sent: 0, failed: 0, total: 0 }),
    resolveMediaBuffer: jest
      .fn()
      .mockResolvedValue({ buffer: Buffer.from('img-bytes'), filename: 'file_51.jpg' }),
    sendCsvToAdmin: jest.fn().mockResolvedValue(undefined),
    sendVotingQrToAdmins: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<PlatformBots>;
}

const makeManager = () => {
  const noop = {} as never;
  return new BotManager(noop, noop, noop, noop, noop);
};

describe('BotManager Phase 5 fan-out', () => {
  let telegramBots: jest.Mocked<PlatformBots>;
  let maxBots: jest.Mocked<PlatformBots>;
  let manager: BotManager;

  beforeEach(async () => {
    jest.clearAllMocks();
    userFindMany.mockResolvedValue([]);
    queryRaw.mockResolvedValue([]);
    followUpFindMany.mockResolvedValue([]);
    followUpUpdate.mockResolvedValue(undefined);

    telegramBots = makeFakeBots('telegram');
    maxBots = makeFakeBots('max');
    manager = makeManager();
    await manager.registerPlatform(telegramBots);
    await manager.registerPlatform(maxBots);
  });

  describe('(a) booking-received routes by user platform', () => {
    it('a Max-platform user gets booking-received on the Max adapter only', async () => {
      const booking = { bookingDate: '2026-01-01', fullName: 'Maxine' };
      await manager.sendBookingReceived({ platform: 'max', platformId: '999' }, booking);

      expect(maxBots.sendBookingReceived).toHaveBeenCalledWith('999', booking);
      expect(telegramBots.sendBookingReceived).not.toHaveBeenCalled();
    });
  });

  describe('(b) broadcast fan-out across platforms', () => {
    it('calls BOTH adapters broadcast with each platform audience ids (segment=all)', async () => {
      // 'all' сегмент читается через prisma.user.findMany({ where: { platform } }).
      userFindMany.mockImplementation(async (args: { where: { platform: Platform } }) => {
        if (args.where.platform === 'telegram') return [{ platformId: 111n }, { platformId: 222n }];
        if (args.where.platform === 'max') return [{ platformId: 333n }];
        return [];
      });

      const result = await manager.broadcastToUsers({
        text: 'hi',
        buttons: [],
        segment: 'all',
      });

      expect(telegramBots.broadcast).toHaveBeenCalledWith(
        ['111', '222'],
        expect.objectContaining({ text: 'hi' })
      );
      expect(maxBots.broadcast).toHaveBeenCalledWith(
        ['333'],
        expect.objectContaining({ text: 'hi' })
      );
      // aggregate over both platforms (each fake returns total 0 by default — assert shape)
      expect(result).toEqual({ sent: 0, failed: 0, total: 0 });
    });

    it('aggregates progress across platforms', async () => {
      userFindMany.mockResolvedValue([{ platformId: 1n }]);
      telegramBots.broadcast.mockResolvedValue({ sent: 5, failed: 1, total: 6 });
      maxBots.broadcast.mockResolvedValue({ sent: 2, failed: 0, total: 2 });

      const result = await manager.broadcastToUsers({ text: 'x', buttons: [] });

      expect(result).toEqual({ sent: 7, failed: 1, total: 8 });
    });

    it('platform:"telegram" broadcasts only to the telegram adapter', async () => {
      userFindMany.mockResolvedValue([{ platformId: 111n }]);

      await manager.broadcastToUsers({
        text: 'hi',
        buttons: [],
        segment: 'all',
        platform: 'telegram',
      });

      expect(telegramBots.broadcast).toHaveBeenCalledWith(['111'], expect.anything());
      expect(maxBots.broadcast).not.toHaveBeenCalled();
    });

    it('platform:"max" broadcasts only to the max adapter', async () => {
      userFindMany.mockResolvedValue([{ platformId: 333n }]);

      await manager.broadcastToUsers({
        text: 'hi',
        buttons: [],
        segment: 'all',
        platform: 'max',
      });

      expect(maxBots.broadcast).toHaveBeenCalledWith(['333'], expect.anything());
      expect(telegramBots.broadcast).not.toHaveBeenCalled();
    });

    it('platform:"both" broadcasts to both adapters', async () => {
      userFindMany.mockResolvedValue([{ platformId: 1n }]);

      await manager.broadcastToUsers({
        text: 'hi',
        buttons: [],
        segment: 'all',
        platform: 'both',
      });

      expect(telegramBots.broadcast).toHaveBeenCalled();
      expect(maxBots.broadcast).toHaveBeenCalled();
    });

    it('downloads media bytes ONCE (via telegram) and passes the buffer to both adapters', async () => {
      userFindMany.mockResolvedValue([{ platformId: 1n }]);

      await manager.broadcastToUsers({
        text: 'poster',
        buttons: [],
        segment: 'all',
        platform: 'both',
        media: { type: 'photo', fileId: 'tg-file-id' },
      });

      // Скачиваем один раз, именно через telegram-адаптер, по исходному file_id.
      expect(telegramBots.resolveMediaBuffer).toHaveBeenCalledTimes(1);
      expect(telegramBots.resolveMediaBuffer).toHaveBeenCalledWith('tg-file-id');
      expect(maxBots.resolveMediaBuffer).not.toHaveBeenCalled();

      // Скачанный буфер уходит в payload обоих адаптеров.
      for (const adapter of [telegramBots, maxBots]) {
        expect(adapter.broadcast).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            mediaBuffer: Buffer.from('img-bytes'),
            mediaFilename: 'file_51.jpg',
          })
        );
      }
    });
  });

  describe('(c) voting winner + follow-up grouping by platform', () => {
    it('notifyVotingWinner routes telegram voters to telegram and max voters to max', async () => {
      await manager.notifyVotingWinner(
        [
          { platform: 'telegram', platformId: '111' },
          { platform: 'max', platformId: '222' },
          { platform: 'telegram', platformId: '333' },
        ],
        { id: 's1', title: 'T', artist: 'A', coverUrl: null },
        'sess1'
      );

      expect(telegramBots.sendVotingWinner).toHaveBeenCalledTimes(2);
      expect(telegramBots.sendVotingWinner).toHaveBeenCalledWith('111', expect.anything(), 'sess1');
      expect(telegramBots.sendVotingWinner).toHaveBeenCalledWith('333', expect.anything(), 'sess1');
      expect(maxBots.sendVotingWinner).toHaveBeenCalledTimes(1);
      expect(maxBots.sendVotingWinner).toHaveBeenCalledWith('222', expect.anything(), 'sess1');
    });

    it('follow-up groups recipients by platform and dispatches per adapter', async () => {
      followUpFindMany.mockResolvedValue([
        {
          id: 'fu1',
          sessionId: 'sess1',
          campaignDay: 1,
          telegramIds: [
            { platform: 'telegram', platformId: '111' },
            { platform: 'max', platformId: '222' },
          ],
        },
      ]);

      await manager.processScheduledVotingFollowUps();

      expect(telegramBots.sendVotingFollowUp).toHaveBeenCalledWith(['111'], 1);
      expect(maxBots.sendVotingFollowUp).toHaveBeenCalledWith(['222'], 1);
      expect(followUpUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'fu1' } })
      );
    });
  });

  describe('(d) backward-compat: bare-string follow-up ids read as telegram', () => {
    it('old row with bare-string ids dispatches only to telegram', async () => {
      followUpFindMany.mockResolvedValue([
        {
          id: 'fuOld',
          sessionId: 'sessOld',
          campaignDay: 2,
          telegramIds: ['111', '222'], // старый формат (голые строки)
        },
      ]);

      await manager.processScheduledVotingFollowUps();

      expect(telegramBots.sendVotingFollowUp).toHaveBeenCalledWith(['111', '222'], 2);
      expect(maxBots.sendVotingFollowUp).not.toHaveBeenCalled();
    });
  });

  describe('admin fan-out', () => {
    it('notifyNewBookingToAllAdmins notifies admins on every registered platform', async () => {
      const booking = { id: 'b1', bookingDate: '2026-01-01', fullName: 'Ann', contactValue: '+7' };
      await manager.notifyNewBookingToAllAdmins(booking);

      expect(telegramBots.notifyNewBooking).toHaveBeenCalledWith(booking);
      expect(maxBots.notifyNewBooking).toHaveBeenCalledWith(booking);
    });

    it('notifyNewUserToAllAdmins notifies admins on every registered platform', async () => {
      const notice = { platform: 'max' as const, platformId: '555' };
      await manager.notifyNewUserToAllAdmins(notice);

      expect(telegramBots.notifyNewUser).toHaveBeenCalledWith(notice);
      expect(maxBots.notifyNewUser).toHaveBeenCalledWith(notice);
    });
  });

  describe('voting QR per-platform fan-out', () => {
    const ORIG_TG = process.env.TELEGRAM_USER_BOT_USERNAME;
    const ORIG_MAX = process.env.MAX_USER_BOT_USERNAME;

    beforeEach(() => {
      process.env.TELEGRAM_USER_BOT_USERNAME = 'vgulbot';
      process.env.MAX_USER_BOT_USERNAME = 'id1_bot';
    });

    afterEach(() => {
      if (ORIG_TG === undefined) delete process.env.TELEGRAM_USER_BOT_USERNAME;
      else process.env.TELEGRAM_USER_BOT_USERNAME = ORIG_TG;
      if (ORIG_MAX === undefined) delete process.env.MAX_USER_BOT_USERNAME;
      else process.env.MAX_USER_BOT_USERNAME = ORIG_MAX;
    });

    it('sends each platform a QR encoding its own platform deep link', async () => {
      await manager.notifyVotingQrToAdmins('sess1', 'admin-7');

      expect(telegramBots.sendVotingQrToAdmins).toHaveBeenCalledTimes(1);
      const tgNotice = telegramBots.sendVotingQrToAdmins.mock.calls[0][0];
      expect(tgNotice.sessionId).toBe('sess1');
      expect(tgNotice.deepLink).toBe('https://t.me/vgulbot?start=vote_sess1');
      expect(tgNotice.qrPngBuffer).toBeInstanceOf(Buffer);
      expect(tgNotice.requestedByAdminId).toBe('admin-7');

      expect(maxBots.sendVotingQrToAdmins).toHaveBeenCalledTimes(1);
      const maxNotice = maxBots.sendVotingQrToAdmins.mock.calls[0][0];
      expect(maxNotice.deepLink).toBe('https://max.ru/id1_bot?start=vote_sess1');
      expect(maxNotice.qrPngBuffer).toBeInstanceOf(Buffer);
    });

    it('isolates platform failures (one platform throwing does not block the other)', async () => {
      telegramBots.sendVotingQrToAdmins.mockRejectedValueOnce(new Error('tg down'));

      await expect(manager.notifyVotingQrToAdmins('sess1')).resolves.toBeUndefined();
      expect(maxBots.sendVotingQrToAdmins).toHaveBeenCalledTimes(1);
    });
  });

  describe('Telegram-only parity (no Max registered)', () => {
    it('broadcast reaches only telegram when Max is not registered', async () => {
      const tgOnly = makeManager();
      await tgOnly.registerPlatform(telegramBots);
      userFindMany.mockResolvedValue([{ platformId: 111n }]);

      await tgOnly.broadcastToUsers({ text: 'hi', buttons: [], segment: 'all' });

      expect(telegramBots.broadcast).toHaveBeenCalledWith(['111'], expect.anything());
      expect(maxBots.broadcast).not.toHaveBeenCalled();
    });
  });
});
