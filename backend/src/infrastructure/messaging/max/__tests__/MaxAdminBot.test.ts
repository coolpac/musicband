// Избегаем инстанцирования реального Prisma/Redis. MaxAdminBot транзитивно
// импортирует config/database (как AdminBot). Мокаем prisma.user.findMany,
// чтобы проверить platform-scoped загрузку списка админов.
const findManyMock = jest.fn().mockResolvedValue([]);
const countMock = jest.fn().mockResolvedValue(0);
const queryRawMock = jest.fn().mockResolvedValue([{ count: 0n }]);
jest.mock('../../../../config/database', () => ({
  prisma: {
    user: {
      findMany: (...a: unknown[]) => findManyMock(...a),
      count: (...a: unknown[]) => countMock(...a),
    },
    $queryRaw: (...a: unknown[]) => queryRawMock(...a),
  },
}));
jest.mock('../../../../config/redis', () => ({ redis: {} }));

import { MaxAdminBot } from '../MaxAdminBot';
import type { IUserRepository } from '../../../database/repositories/UserRepository';
import type { IBookingRepository } from '../../../database/repositories/BookingRepository';

function makeClient() {
  return {
    bot: { on: jest.fn(), command: jest.fn(), action: jest.fn(), catch: jest.fn() },
    sendMessage: jest.fn().mockResolvedValue(undefined),
    sendMessageWithKeyboard: jest.fn().mockResolvedValue(undefined),
    uploadAndSendVideo: jest.fn().mockResolvedValue(undefined),
    uploadAndSendImage: jest.fn().mockResolvedValue(undefined),
    answerCallback: jest.fn().mockResolvedValue(undefined),
    setMyCommands: jest.fn().mockResolvedValue(undefined),
    getMe: jest.fn().mockResolvedValue({ user_id: 1, name: 'bot' }),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
  };
}

function makeDeps() {
  const userRepository = {} as unknown as jest.Mocked<IUserRepository>;
  const bookingRepository = {
    findById: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockResolvedValue({
      total: 10,
      confirmed: 4,
      pending: 3,
      cancelled: 3,
      totalIncome: 1234.5,
      conversionRate: 40,
    }),
  } as unknown as jest.Mocked<IBookingRepository>;
  const onBookingConfirmed = jest.fn().mockResolvedValue(undefined);
  const onBroadcast = jest.fn().mockResolvedValue({ sent: 5, failed: 1, total: 6 });
  return { userRepository, bookingRepository, onBookingConfirmed, onBroadcast };
}

const ADMIN_ID = 100;
const NON_ADMIN_ID = 200;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  findManyMock.mockResolvedValue([{ platformId: BigInt(ADMIN_ID) }]);
  countMock.mockResolvedValue(7);
  queryRawMock.mockResolvedValue([{ count: 7n }]);
  process.env.ADMIN_PANEL_URL = 'https://admin.example';
  process.env.MINI_APP_URL = 'https://app.example';
});

afterEach(() => {
  jest.useRealTimers();
});

async function makeBot() {
  const client = makeClient();
  const deps = makeDeps();
  const bot = new MaxAdminBot(
    client as never,
    deps.userRepository,
    deps.bookingRepository,
    deps.onBookingConfirmed,
    deps.onBroadcast
  );
  // loadAdmins is fired in the constructor (async); flush it.
  await Promise.resolve();
  await Promise.resolve();
  return { bot, client, ...deps };
}

describe('MaxAdminBot', () => {
  it('registers handlers on the underlying bot', () => {
    const client = makeClient();
    const deps = makeDeps();
    new MaxAdminBot(
      client as never,
      deps.userRepository,
      deps.bookingRepository,
      deps.onBookingConfirmed,
      deps.onBroadcast
    );

    expect(client.bot.command).toHaveBeenCalledWith('start', expect.any(Function));
    expect(client.bot.command).toHaveBeenCalledWith('admin', expect.any(Function));
    expect(client.bot.command).toHaveBeenCalledWith('stats', expect.any(Function));
    expect(client.bot.command).toHaveBeenCalledWith('broadcast', expect.any(Function));
    expect(client.bot.command).toHaveBeenCalledWith('broadcast_cancel', expect.any(Function));
    expect(client.bot.on).toHaveBeenCalledWith('message_callback', expect.any(Function));
    expect(client.bot.on).toHaveBeenCalledWith('message_created', expect.any(Function));
  });

  it('loads admin allow-list scoped to platform="max"', async () => {
    await makeBot();

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'admin', platform: 'max' }),
      })
    );
  });

  describe('/start and /admin', () => {
    it('sends the admin-panel link to an admin', async () => {
      const { bot, client } = await makeBot();
      await bot.handleStart(ADMIN_ID);

      const sent = [
        ...client.sendMessage.mock.calls.map((c: unknown[]) => c[1]),
        ...client.sendMessageWithKeyboard.mock.calls.map((c: unknown[]) => c[1]),
      ].join('\n');
      expect(sent).toContain('https://admin.example');
    });

    it('ignores non-admins', async () => {
      const { bot, client } = await makeBot();
      await bot.handleStart(NON_ADMIN_ID);

      const sent = [
        ...client.sendMessage.mock.calls.map((c: unknown[]) => String(c[1])),
        ...client.sendMessageWithKeyboard.mock.calls.map((c: unknown[]) => String(c[1])),
      ].join('\n');
      expect(sent).not.toContain('https://admin.example');
    });
  });

  describe('/stats', () => {
    it('replies with booking stats for an admin', async () => {
      const { bot, client, bookingRepository } = await makeBot();
      await bot.handleStats(ADMIN_ID);

      expect(bookingRepository.getStats).toHaveBeenCalled();
      const text = client.sendMessage.mock.calls.map((c: unknown[]) => String(c[1])).join('\n');
      expect(text).toContain('Статистика');
      expect(text).toContain('10');
    });

    it('is ignored for non-admins', async () => {
      const { bot, bookingRepository } = await makeBot();
      await bot.handleStats(NON_ADMIN_ID);
      expect(bookingRepository.getStats).not.toHaveBeenCalled();
    });
  });

  describe('booking confirm/cancel callbacks', () => {
    it('booking_confirm:<id> updates status and invokes onBookingConfirmed', async () => {
      const { bot, bookingRepository, onBookingConfirmed } = await makeBot();
      bookingRepository.findById.mockResolvedValue({
        id: 'b-1',
        status: 'pending',
        bookingDate: new Date('2026-01-01T00:00:00Z'),
        fullName: 'Ann',
        contactValue: '+7',
        format: { name: 'Jazz' },
      } as never);

      await bot.handleCallback(ADMIN_ID, 'booking_confirm:b-1', 'cb-1');

      expect(bookingRepository.updateStatus).toHaveBeenCalledWith('b-1', 'confirmed');
      expect(onBookingConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: 'b-1', fullName: 'Ann' })
      );
    });

    it('booking_cancel:<id> updates status and does NOT invoke onBookingConfirmed', async () => {
      const { bot, bookingRepository, onBookingConfirmed } = await makeBot();
      bookingRepository.findById.mockResolvedValue({
        id: 'b-2',
        status: 'pending',
        bookingDate: new Date('2026-01-01T00:00:00Z'),
        fullName: 'Bob',
        contactValue: '+7',
        format: null,
      } as never);

      await bot.handleCallback(ADMIN_ID, 'booking_cancel:b-2', 'cb-2');

      expect(bookingRepository.updateStatus).toHaveBeenCalledWith('b-2', 'cancelled');
      expect(onBookingConfirmed).not.toHaveBeenCalled();
    });

    it('non-admin callback is ignored', async () => {
      const { bot, bookingRepository } = await makeBot();
      await bot.handleCallback(NON_ADMIN_ID, 'booking_confirm:b-1', 'cb-x');
      expect(bookingRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('broadcast wizard', () => {
    it('assembles a BroadcastPayload and hands it to onBroadcast', async () => {
      const { bot, onBroadcast } = await makeBot();

      // segment → text → preview → send
      await bot.handleCallback(ADMIN_ID, 'broadcast_segment:all', 'cb-seg');
      await bot.handleMessage(ADMIN_ID, 'Hello everyone');
      await bot.handleCallback(ADMIN_ID, 'broadcast_send', 'cb-send');

      expect(onBroadcast).toHaveBeenCalledTimes(1);
      const payload = onBroadcast.mock.calls[0][0];
      expect(payload.text).toBe('Hello everyone');
      expect(payload.segment).toBe('all');
      expect(Array.isArray(payload.buttons)).toBe(true);
    });

    it('includes parsed buttons in the payload', async () => {
      const { bot, onBroadcast } = await makeBot();

      await bot.handleCallback(ADMIN_ID, 'broadcast_segment:organizer', 'cb-seg');
      await bot.handleMessage(ADMIN_ID, 'Body text');
      await bot.handleCallback(ADMIN_ID, 'broadcast_buttons_yes', 'cb-btn');
      await bot.handleMessage(ADMIN_ID, 'Связаться | https://example.com');
      await bot.handleCallback(ADMIN_ID, 'broadcast_send', 'cb-send');

      const payload = onBroadcast.mock.calls[0][0];
      expect(payload.buttons).toEqual([
        expect.objectContaining({ text: 'Связаться', url: 'https://example.com' }),
      ]);
      expect(payload.segment).toBe('organizer');
    });

    it('/broadcast_cancel clears the pending draft', async () => {
      const { bot, onBroadcast } = await makeBot();

      await bot.handleCallback(ADMIN_ID, 'broadcast_segment:all', 'cb-seg');
      await bot.handleMessage(ADMIN_ID, 'Some text');
      await bot.handleBroadcastCancel(ADMIN_ID);
      // After cancel, a free-text message should not be treated as broadcast text.
      await bot.handleCallback(ADMIN_ID, 'broadcast_send', 'cb-send');

      expect(onBroadcast).not.toHaveBeenCalled();
    });

    it('ignores broadcast wizard for non-admins', async () => {
      const { bot, onBroadcast } = await makeBot();
      await bot.handleCallback(NON_ADMIN_ID, 'broadcast_segment:all', 'cb-seg');
      await bot.handleMessage(NON_ADMIN_ID, 'text');
      await bot.handleCallback(NON_ADMIN_ID, 'broadcast_send', 'cb-send');
      expect(onBroadcast).not.toHaveBeenCalled();
    });
  });

  describe('PlatformBots admin-facing methods', () => {
    it('notifyNewBooking DMs all admins with confirm/cancel buttons', async () => {
      const { bot, client } = await makeBot();
      await bot.notifyNewBooking({
        id: 'b-9',
        bookingDate: '2026-01-01',
        fullName: 'Ann',
        contactValue: '+7',
      });

      expect(client.sendMessageWithKeyboard).toHaveBeenCalledTimes(1);
      const [userId, , rows] = client.sendMessageWithKeyboard.mock.calls[0];
      expect(userId).toBe(ADMIN_ID);
      const payloads = rows
        .flat()
        .map((b: { payload?: string }) => b.payload)
        .filter(Boolean);
      expect(payloads).toContain('booking_confirm:b-9');
      expect(payloads).toContain('booking_cancel:b-9');
    });

    it('notifyNewUser DMs all admins', async () => {
      const { bot, client } = await makeBot();
      await bot.notifyNewUser({ platform: 'max', platformId: '555', username: 'pete' });

      expect(client.sendMessage).toHaveBeenCalledWith(ADMIN_ID, expect.stringContaining('555'));
    });

    it('sendCsvToAdmin sends a message to the admin', async () => {
      const { bot, client } = await makeBot();
      await bot.sendCsvToAdmin('100', Buffer.from('a,b'), 'export.csv');
      expect(client.sendMessage).toHaveBeenCalled();
    });

    it('notifyVotingQrToAdmins sends the QR image + max.ru link to all admins', async () => {
      const { bot, client } = await makeBot();
      const qr = Buffer.from('png');

      await bot.notifyVotingQrToAdmins({
        sessionId: 'sess1',
        deepLink: 'https://max.ru/id1_bot?start=vote_sess1',
        qrPngBuffer: qr,
        requestedByAdminId: 'admin-7',
      });

      expect(client.uploadAndSendImage).toHaveBeenCalledTimes(1);
      const [userId, buffer, caption, rows] = client.uploadAndSendImage.mock.calls[0];
      expect(userId).toBe(ADMIN_ID);
      expect(buffer).toBe(qr);
      expect(caption).toContain('sess1');
      expect(caption).toContain('https://max.ru/id1_bot?start=vote_sess1');
      const links = rows
        .flat()
        .map((b: { url?: string }) => b.url)
        .filter(Boolean);
      expect(links).toContain('https://max.ru/id1_bot?start=vote_sess1');
    });
  });

  it('stop() delegates to the client', async () => {
    const { bot, client } = await makeBot();
    bot.stop();
    expect(client.stop).toHaveBeenCalled();
  });
});
