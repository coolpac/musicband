// Избегаем инстанцирования реального Prisma/Redis: MaxUserBot транзитивно
// импортирует config/redis (как UserBot). Мокаем их, как в botManager.routing.test.ts.
jest.mock('../../../../config/database', () => ({ prisma: {} }));

const redisMock = {
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
};
jest.mock('../../../../config/redis', () => ({ redis: redisMock }));
// config паттерн config/* находится на src/config; из __tests__ это 4 уровня вверх.

// Сам BotManager: notifyNewUser вызывается через getBotManager() (как в UserBot).
const notifyNewUser = jest.fn().mockResolvedValue(undefined);
jest.mock('../../BotManager', () => ({
  getBotManager: () => ({ notifyNewUser }),
}));

import { MaxUserBot } from '../MaxUserBot';
import type { ReferralService } from '../../../../domain/services/ReferralService';
import type { IOnboardingRepository } from '../../../database/repositories/OnboardingRepository';

function makeClient() {
  return {
    bot: { on: jest.fn(), command: jest.fn(), action: jest.fn(), catch: jest.fn() },
    sendMessage: jest.fn().mockResolvedValue(undefined),
    sendMessageWithKeyboard: jest.fn().mockResolvedValue(undefined),
    answerCallback: jest.fn().mockResolvedValue(undefined),
    setMyCommands: jest.fn().mockResolvedValue(undefined),
    getMe: jest.fn().mockResolvedValue({ user_id: 1, name: 'bot' }),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
  };
}

function makeServices() {
  const referralService = {
    handleLinkClick: jest.fn().mockResolvedValue({ link: { id: 'link-1' } }),
  } as unknown as jest.Mocked<ReferralService>;
  const onboardingRepository = {
    findByIdentity: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 'o1',
      platform: 'max',
      platformId: 999n,
      role: 'just_person',
      createdAt: new Date(),
    }),
    countUsersByRole: jest.fn(),
    countAllUsers: jest.fn(),
  } as unknown as jest.Mocked<IOnboardingRepository>;
  return { referralService, onboardingRepository };
}

const MINI_APP_URL = 'https://app.example';

describe('MaxUserBot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisMock.get.mockResolvedValue(null);
    process.env.MINI_APP_URL = MINI_APP_URL;
  });

  it('registers handlers on the underlying bot', () => {
    const client = makeClient();
    const { referralService, onboardingRepository } = makeServices();
    new MaxUserBot(client as never, referralService, onboardingRepository);

    expect(client.bot.on).toHaveBeenCalledWith('bot_started', expect.any(Function));
    expect(client.bot.command).toHaveBeenCalledWith('start', expect.any(Function));
    expect(client.bot.command).toHaveBeenCalledWith('help', expect.any(Function));
    expect(client.bot.on).toHaveBeenCalledWith('message_callback', expect.any(Function));
  });

  describe('handleBotStarted', () => {
    it('with no payload sends the onboarding "who are you?" keyboard', async () => {
      const client = makeClient();
      const { referralService, onboardingRepository } = makeServices();
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      await bot.handleBotStarted(999, null);

      expect(client.sendMessageWithKeyboard).toHaveBeenCalledTimes(1);
      const [userId, text, rows] = client.sendMessageWithKeyboard.mock.calls[0];
      expect(userId).toBe(999);
      expect(text).toBe('Если не секрет, кто вы?');
      const payloads = rows.flat().map((b: { payload: string }) => b.payload);
      expect(payloads).toEqual(['onb:person', 'onb:organizer', 'onb:agent']);
    });

    it('with vote_<id> payload sends a link button to the voting URL and stores redis key', async () => {
      const client = makeClient();
      const { referralService, onboardingRepository } = makeServices();
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      await bot.handleBotStarted(999, 'vote_sess-42');

      expect(client.sendMessageWithKeyboard).toHaveBeenCalledTimes(1);
      const [userId, , rows] = client.sendMessageWithKeyboard.mock.calls[0];
      expect(userId).toBe(999);
      const button = rows.flat()[0];
      expect(button.kind).toBe('link');
      expect(button.url).toBe(`${MINI_APP_URL}?screen=voting&sessionId=sess-42`);
      // namespaced Max redis key (не пересекается с Telegram pending_vote:<chatId>)
      expect(redisMock.setex).toHaveBeenCalledWith('pending_vote:max:999', 3600, 'sess-42');
    });

    it('with a referral code calls referralService.handleLinkClick with Max:<userId>', async () => {
      const client = makeClient();
      const { referralService, onboardingRepository } = makeServices();
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      await bot.handleBotStarted(777, 'REFCODE123');

      expect(referralService.handleLinkClick).toHaveBeenCalledWith(
        'REFCODE123',
        undefined,
        'Max:777'
      );
    });
  });

  describe('onboarding callbacks', () => {
    it('role selection stores onb_pending:max:<userId> and shows confirm button', async () => {
      const client = makeClient();
      const { referralService, onboardingRepository } = makeServices();
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      await bot.handleCallback(999, 'onb:organizer', 'cb-1', {
        user_id: 999,
        name: 'Org',
        username: 'org',
      } as never);

      expect(redisMock.setex).toHaveBeenCalledWith(
        'onb_pending:max:999',
        expect.any(Number),
        'organizer'
      );
      const [, , rows] = client.sendMessageWithKeyboard.mock.calls[0];
      expect(rows.flat()[0].payload).toBe('onb:confirm');
    });

    it('onb:confirm persists via onboardingRepository.create({platform max}) and notifies new user', async () => {
      const client = makeClient();
      const { referralService, onboardingRepository } = makeServices();
      redisMock.get.mockResolvedValue('just_person');
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      await bot.handleCallback(999, 'onb:confirm', 'cb-2', {
        user_id: 999,
        name: 'Pete',
        username: 'pete',
      } as never);

      expect(onboardingRepository.create).toHaveBeenCalledWith('max', 999n, 'just_person');
      expect(redisMock.del).toHaveBeenCalledWith('onb_pending:max:999');
      expect(notifyNewUser).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'max', platformId: '999' })
      );
      // приветствие после подтверждения
      expect(
        client.sendMessage.mock.calls.length + client.sendMessageWithKeyboard.mock.calls.length
      ).toBeGreaterThan(0);
    });

    it('onb:confirm with expired redis selection asks user to /start again', async () => {
      const client = makeClient();
      const { referralService, onboardingRepository } = makeServices();
      redisMock.get.mockResolvedValue(null);
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      await bot.handleCallback(999, 'onb:confirm', 'cb-3', { user_id: 999, name: 'X' } as never);

      expect(onboardingRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('PlatformBots user-facing methods', () => {
    it('platform is "max"', () => {
      const client = makeClient();
      const { referralService, onboardingRepository } = makeServices();
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);
      expect(bot.platform).toBe('max');
    });

    it('sendBookingReceived sends the booking text via the client', async () => {
      const client = makeClient();
      const { referralService, onboardingRepository } = makeServices();
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      await bot.sendBookingReceived('555', {
        bookingDate: '2026-01-01',
        formatName: 'Jazz',
        fullName: 'Ann',
      });

      expect(client.sendMessage).toHaveBeenCalledTimes(1);
      const [userId, text] = client.sendMessage.mock.calls[0];
      expect(userId).toBe(555);
      expect(text).toContain('Заявка получена');
      expect(text).toContain('Ann');
    });

    it('sendBookingConfirmation sends the confirmation text via the client', async () => {
      const client = makeClient();
      const { referralService, onboardingRepository } = makeServices();
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      await bot.sendBookingConfirmation('555', { bookingDate: '2026-01-01', fullName: 'Bob' });

      const [, text] = client.sendMessage.mock.calls[0];
      expect(text).toContain('подтверждено');
    });

    it('sendReviewRequest sends a link button and returns {sent:true}', async () => {
      const client = makeClient();
      const { referralService, onboardingRepository } = makeServices();
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      const result = await bot.sendReviewRequest('555', {
        bookingId: 'b-1',
        bookingDate: '2026-01-01',
      });

      expect(result.sent).toBe(true);
      const [, , rows] = client.sendMessageWithKeyboard.mock.calls[0];
      expect(rows.flat()[0].url).toContain('screen=review-form');
      expect(rows.flat()[0].url).toContain('bookingId=b-1');
    });

    it('sendReviewRequest returns {sent:false} and swallows when user is unreachable', async () => {
      const client = makeClient();
      const { MaxError } = await import('@maxhub/max-bot-api');
      client.sendMessageWithKeyboard.mockRejectedValue(
        new MaxError(403, { code: 'forbidden', message: 'blocked' })
      );
      const { referralService, onboardingRepository } = makeServices();
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      const result = await bot.sendReviewRequest('555', { bookingId: 'b-1', bookingDate: 'x' });

      expect(result.sent).toBe(false);
      expect(result.errorCode).toBe(403);
    });

    it('sendVotingFollowUp sends to each recipient and returns counts', async () => {
      const client = makeClient();
      const { referralService, onboardingRepository } = makeServices();
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      const result = await bot.sendVotingFollowUp(['111', '222', '333'], 1);

      expect(result).toEqual({ sent: 3, failed: 0 });
      expect(client.sendMessageWithKeyboard).toHaveBeenCalledTimes(3);
      const [, text] = client.sendMessageWithKeyboard.mock.calls[0];
      expect(text).toContain('Салют');
    });

    it('sendVotingFollowUp counts unreachable recipients as failed and keeps going', async () => {
      const client = makeClient();
      const { MaxError } = await import('@maxhub/max-bot-api');
      client.sendMessageWithKeyboard
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new MaxError(403, { code: 'forbidden', message: 'blocked' }))
        .mockResolvedValueOnce(undefined);
      const { referralService, onboardingRepository } = makeServices();
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      const result = await bot.sendVotingFollowUp(['111', '222', '333'], 2);

      expect(result).toEqual({ sent: 2, failed: 1 });
    });

    it('sendVotingWinner sends a winner link button', async () => {
      const client = makeClient();
      const { referralService, onboardingRepository } = makeServices();
      const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

      await bot.sendVotingWinner(
        '555',
        { id: 'song-1', title: 'T', artist: 'A', coverUrl: null },
        'sess-9'
      );

      const [userId, text, rows] = client.sendMessageWithKeyboard.mock.calls[0];
      expect(userId).toBe(555);
      expect(text).toContain('Голосование завершено');
      expect(rows.flat()[0].url).toContain('screen=winning-song');
      expect(rows.flat()[0].url).toContain('songId=song-1');
    });
  });

  it('stop() delegates to the client', () => {
    const client = makeClient();
    const { referralService, onboardingRepository } = makeServices();
    const bot = new MaxUserBot(client as never, referralService, onboardingRepository);

    bot.stop();

    expect(client.stop).toHaveBeenCalled();
  });
});
