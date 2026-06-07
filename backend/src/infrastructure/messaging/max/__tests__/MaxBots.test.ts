// MaxBots транзитивно импортирует MaxAdminBot -> config/database и MaxUserBot ->
// config/redis. Мокаем их, как в MaxAdminBot.test.ts / MaxUserBot.test.ts, чтобы не
// инстанцировать реальный Prisma/Redis.
const findManyMock = jest.fn().mockResolvedValue([]);
jest.mock('../../../../config/database', () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => findManyMock(...a) },
  },
}));
jest.mock('../../../../config/redis', () => ({ redis: {} }));

import { MaxBots, type MaxBotsDeps } from '../MaxBots';
import type { ReferralService } from '../../../../domain/services/ReferralService';
import type { IUserRepository } from '../../../database/repositories/UserRepository';
import type { IBookingRepository } from '../../../database/repositories/BookingRepository';
import type { IOnboardingRepository } from '../../../database/repositories/OnboardingRepository';

function makeClient() {
  return {
    bot: { on: jest.fn(), command: jest.fn(), action: jest.fn(), catch: jest.fn() },
    sendMessage: jest.fn().mockResolvedValue(undefined),
    sendMessageWithKeyboard: jest.fn().mockResolvedValue(undefined),
    sendMessageWithAttachments: jest.fn().mockResolvedValue(undefined),
    uploadMediaAttachment: jest.fn().mockResolvedValue({ type: 'image', payload: { token: 'max-att' } }),
    answerCallback: jest.fn().mockResolvedValue(undefined),
    setMyCommands: jest.fn().mockResolvedValue(undefined),
    getMe: jest.fn().mockResolvedValue({ user_id: 1, name: 'bot' }),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
  };
}

function makeDeps(): MaxBotsDeps {
  return {
    referralService: { handleLinkClick: jest.fn() } as unknown as ReferralService,
    userRepository: {} as unknown as IUserRepository,
    bookingRepository: {
      findById: jest.fn(),
      updateStatus: jest.fn(),
      getStats: jest.fn(),
    } as unknown as IBookingRepository,
    onboardingRepository: {
      findByIdentity: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    } as unknown as IOnboardingRepository,
    onBookingConfirmed: jest.fn().mockResolvedValue(undefined),
    onBroadcast: jest.fn().mockResolvedValue({ sent: 0, failed: 0, total: 0 }),
  };
}

function makeBots() {
  const userClient = makeClient();
  const adminClient = makeClient();
  const deps = makeDeps();
  const bots = new MaxBots(userClient as never, adminClient as never, deps);
  return { bots, userClient, adminClient, deps };
}

describe('MaxBots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findManyMock.mockResolvedValue([]);
    process.env.MINI_APP_URL = 'https://app.example';
  });

  it('reports platform "max"', () => {
    const { bots } = makeBots();
    expect(bots.platform).toBe('max');
  });

  describe('start()', () => {
    it('sets both command menus and starts both clients', async () => {
      const { bots, userClient, adminClient } = makeBots();

      await bots.start();

      expect(userClient.setMyCommands).toHaveBeenCalledTimes(1);
      expect(adminClient.setMyCommands).toHaveBeenCalledTimes(1);
      // user menu contains start/help; admin menu contains stats/broadcast
      const userMenu = (userClient.setMyCommands.mock.calls[0][0] as Array<{ name: string }>).map(
        (c) => c.name
      );
      const adminMenu = (adminClient.setMyCommands.mock.calls[0][0] as Array<{ name: string }>).map(
        (c) => c.name
      );
      expect(userMenu).toEqual(expect.arrayContaining(['start', 'help']));
      expect(adminMenu).toEqual(expect.arrayContaining(['stats', 'broadcast']));
      expect(userClient.start).toHaveBeenCalledTimes(1);
      expect(adminClient.start).toHaveBeenCalledTimes(1);
    });

    it('resolves even if the inner poll-loop never resolves (non-blocking)', async () => {
      const { bots, userClient, adminClient } = makeBots();
      // Симулируем MaxClient.start() как бесконечный poll-loop: НИКОГДА не резолвится.
      // MaxBots.start() запускает клиентов fire-and-forget, поэтому не должен зависнуть.
      userClient.start.mockReturnValue(new Promise(() => {}));
      adminClient.start.mockReturnValue(new Promise(() => {}));

      // Если бы start() ждал бесконечный poll, этот await завис бы навсегда.
      await expect(
        Promise.race([
          bots.start(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('start() hung')), 1000)),
        ])
      ).resolves.toBeUndefined();

      expect(userClient.start).toHaveBeenCalled();
      expect(adminClient.start).toHaveBeenCalled();
    });
  });

  describe('stop()', () => {
    it('stops both clients', async () => {
      const { bots, userClient, adminClient } = makeBots();
      await bots.stop();
      expect(userClient.stop).toHaveBeenCalledTimes(1);
      expect(adminClient.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('delegation', () => {
    it('user-facing sendBookingReceived goes through the user client', async () => {
      const { bots, userClient, adminClient } = makeBots();
      await bots.sendBookingReceived('555', { bookingDate: '2026-01-01', fullName: 'Ann' });

      expect(userClient.sendMessage).toHaveBeenCalledTimes(1);
      const [userId, text] = userClient.sendMessage.mock.calls[0];
      expect(userId).toBe(555);
      expect(text).toContain('Заявка получена');
      // admin client untouched for user-facing messages
      expect(adminClient.sendMessage).not.toHaveBeenCalled();
    });

    it('admin-facing notifyNewBooking goes through the admin client', async () => {
      // Admin allow-list is loaded in MaxAdminBot's constructor, so set the mock FIRST.
      findManyMock.mockResolvedValue([{ platformId: 100n }]);
      const userClient = makeClient();
      const adminClient = makeClient();
      const bots = new MaxBots(userClient as never, adminClient as never, makeDeps());
      // loadAdmins fired (async) in MaxAdminBot constructor; flush microtasks.
      await Promise.resolve();
      await Promise.resolve();

      await bots.notifyNewBooking({
        id: 'b-9',
        bookingDate: '2026-01-01',
        fullName: 'Ann',
        contactValue: '+7',
      });

      // notifyNewBooking DMs admins through the ADMIN client, not the user client.
      expect(adminClient.sendMessageWithKeyboard).toHaveBeenCalled();
      const adminTargets = adminClient.sendMessageWithKeyboard.mock.calls.map(
        (c: unknown[]) => c[0]
      );
      expect(adminTargets).toContain(100);
      expect(userClient.sendMessageWithKeyboard).not.toHaveBeenCalled();
    });

    it('sendVotingFollowUp routes through the user client', async () => {
      const { bots, userClient } = makeBots();
      const result = await bots.sendVotingFollowUp(['111', '222'], 1);
      expect(result).toEqual({ sent: 2, failed: 0 });
      expect(userClient.sendMessageWithKeyboard).toHaveBeenCalledTimes(2);
    });
  });

  describe('broadcast', () => {
    it('sends text + buttons to each recipient via the user client', async () => {
      const { bots, userClient } = makeBots();
      const result = await bots.broadcast(['1', '2', '3'], {
        text: 'Hello',
        buttons: [{ text: 'Open', url: 'https://example.com', kind: 'url' }],
      });

      expect(result).toEqual({ sent: 3, failed: 0, total: 3 });
      expect(userClient.sendMessageWithKeyboard).toHaveBeenCalledTimes(3);
      const [userId, text, rows] = userClient.sendMessageWithKeyboard.mock.calls[0];
      expect(userId).toBe(1);
      expect(text).toBe('Hello');
      expect(rows.flat()[0]).toMatchObject({ kind: 'link', text: 'Open', url: 'https://example.com' });
    });

    it('uses plain sendMessage when there are no buttons', async () => {
      const { bots, userClient } = makeBots();
      await bots.broadcast(['1'], { text: 'No buttons', buttons: [] });

      expect(userClient.sendMessage).toHaveBeenCalledWith(1, 'No buttons');
      expect(userClient.sendMessageWithKeyboard).not.toHaveBeenCalled();
    });

    it('falls back to text when media has no resolved URL (no upload attempted)', async () => {
      const { bots, userClient } = makeBots();
      const result = await bots.broadcast(['1'], {
        text: 'With media',
        buttons: [],
        media: { type: 'photo', fileId: 'tg-file-id' }, // no mediaUrl
      });

      expect(result).toEqual({ sent: 1, failed: 0, total: 1 });
      expect(userClient.uploadMediaAttachment).not.toHaveBeenCalled();
      expect(userClient.sendMessage).toHaveBeenCalledWith(1, 'With media');
    });

    it('uploads photo ONCE and sends it (with caption) to every recipient', async () => {
      const { bots, userClient } = makeBots();
      const result = await bots.broadcast(['1', '2', '3'], {
        text: 'Poster!',
        buttons: [{ text: 'Open', url: 'https://example.com', kind: 'url' }],
        media: { type: 'photo', fileId: 'tg-file-id' },
        mediaUrl: 'https://api.telegram.org/file/bot/photo.jpg',
      });

      expect(result).toEqual({ sent: 3, failed: 0, total: 3 });
      // загрузили один раз, переиспользовали для всех
      expect(userClient.uploadMediaAttachment).toHaveBeenCalledTimes(1);
      expect(userClient.uploadMediaAttachment).toHaveBeenCalledWith(
        'image',
        'https://api.telegram.org/file/bot/photo.jpg'
      );
      expect(userClient.sendMessageWithAttachments).toHaveBeenCalledTimes(3);
      const [userId, text, attachments, rows] =
        userClient.sendMessageWithAttachments.mock.calls[0];
      expect(userId).toBe(1);
      expect(text).toBe('Poster!');
      expect(attachments).toHaveLength(1);
      expect(rows.flat()[0]).toMatchObject({ kind: 'link', url: 'https://example.com' });
    });

    it('maps video media to the "video" upload kind', async () => {
      const { bots, userClient } = makeBots();
      await bots.broadcast(['1'], {
        text: 'clip',
        buttons: [],
        media: { type: 'video', fileId: 'tg-vid' },
        mediaUrl: 'https://api.telegram.org/file/bot/clip.mp4',
      });
      expect(userClient.uploadMediaAttachment).toHaveBeenCalledWith('video', expect.any(String));
    });

    it('falls back to text when media upload fails (does not abort broadcast)', async () => {
      const { bots, userClient } = makeBots();
      userClient.uploadMediaAttachment.mockRejectedValueOnce(new Error('upload boom'));
      const result = await bots.broadcast(['1', '2'], {
        text: 'still send',
        buttons: [],
        media: { type: 'photo', fileId: 'f' },
        mediaUrl: 'https://example.com/x.jpg',
      });
      expect(result).toEqual({ sent: 2, failed: 0, total: 2 });
      expect(userClient.sendMessageWithAttachments).not.toHaveBeenCalled();
      expect(userClient.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('reports progress and counts unreachable recipients as failed', async () => {
      const { bots, userClient } = makeBots();
      const { MaxError } = await import('@maxhub/max-bot-api');
      userClient.sendMessage
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new MaxError(403, { code: 'forbidden', message: 'blocked' }));
      const onProgress = jest.fn().mockResolvedValue(undefined);

      const result = await bots.broadcast(['1', '2'], { text: 'x', buttons: [], onProgress });

      expect(result).toEqual({ sent: 1, failed: 1, total: 2 });
      expect(onProgress).toHaveBeenCalled();
    });
  });
});
