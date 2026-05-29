import { TelegramBots } from '../TelegramBots';
import type { UserBot } from '../../../telegram/UserBot';
import type { AdminBot } from '../../../telegram/AdminBot';

/**
 * TelegramBots — адаптер, оборачивающий существующие UserBot/AdminBot под интерфейс PlatformBots.
 * Здесь проверяем, что platform === 'telegram' и что вызовы делегируются нужному боту
 * с корректным преобразованием аргументов.
 */
describe('TelegramBots adapter', () => {
  const makeUserBot = () =>
    ({
      sendBookingReceived: jest.fn().mockResolvedValue(undefined),
      sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
      sendReviewRequest: jest.fn().mockResolvedValue({ sent: true }),
      sendVotingFollowUp: jest.fn().mockResolvedValue({ sent: 2, failed: 0 }),
      sendVotingWinnerNotification: jest.fn().mockResolvedValue(undefined),
      getBot: jest.fn(),
      stop: jest.fn().mockResolvedValue(undefined),
    }) as unknown as jest.Mocked<UserBot>;

  const makeAdminBot = () =>
    ({
      notifyNewBooking: jest.fn().mockResolvedValue(undefined),
      notifyNewUser: jest.fn().mockResolvedValue(undefined),
      sendCsvToAdmin: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    }) as unknown as jest.Mocked<AdminBot>;

  it('exposes platform === "telegram"', () => {
    const adapter = new TelegramBots(makeUserBot(), makeAdminBot());
    expect(adapter.platform).toBe('telegram');
  });

  it('forwards sendBookingReceived to userBot.sendBookingReceived', async () => {
    const userBot = makeUserBot();
    const adapter = new TelegramBots(userBot, makeAdminBot());
    const booking = { bookingDate: '2026-01-01', formatName: 'Jazz', fullName: 'Ann' };

    await adapter.sendBookingReceived('12345', booking);

    expect(userBot.sendBookingReceived).toHaveBeenCalledWith('12345', booking);
  });

  it('forwards sendBookingConfirmation to userBot.sendBookingConfirmation', async () => {
    const userBot = makeUserBot();
    const adapter = new TelegramBots(userBot, makeAdminBot());
    const booking = { bookingDate: '2026-02-02', fullName: 'Bob' };

    await adapter.sendBookingConfirmation('999', booking);

    expect(userBot.sendBookingConfirmation).toHaveBeenCalledWith('999', booking);
  });

  it('forwards sendReviewRequest to userBot.sendReviewRequest and returns its result', async () => {
    const userBot = makeUserBot();
    const adapter = new TelegramBots(userBot, makeAdminBot());
    const review = { bookingId: 'b1', bookingDate: '2026-03-03' };

    const result = await adapter.sendReviewRequest('555', review);

    expect(userBot.sendReviewRequest).toHaveBeenCalledWith('555', review);
    expect(result).toEqual({ sent: true });
  });

  it('forwards sendVotingFollowUp to userBot.sendVotingFollowUp', async () => {
    const userBot = makeUserBot();
    const adapter = new TelegramBots(userBot, makeAdminBot());

    const result = await adapter.sendVotingFollowUp(['1', '2'], 1);

    expect(userBot.sendVotingFollowUp).toHaveBeenCalledWith(['1', '2'], 1);
    expect(result).toEqual({ sent: 2, failed: 0 });
  });

  it('forwards sendVotingWinner to userBot.sendVotingWinnerNotification (id as bigint)', async () => {
    const userBot = makeUserBot();
    const adapter = new TelegramBots(userBot, makeAdminBot());
    const song = { id: 's1', title: 'T', artist: 'A', coverUrl: null };

    await adapter.sendVotingWinner('42', song, 'sess-1');

    expect(userBot.sendVotingWinnerNotification).toHaveBeenCalledWith(42n, song, 'sess-1');
  });

  it('forwards notifyNewBooking to adminBot.notifyNewBooking', async () => {
    const adminBot = makeAdminBot();
    const adapter = new TelegramBots(makeUserBot(), adminBot);
    const booking = {
      id: 'b1',
      bookingDate: '2026-01-01',
      fullName: 'Ann',
      contactValue: '+7',
    };

    await adapter.notifyNewBooking(booking);

    expect(adminBot.notifyNewBooking).toHaveBeenCalledWith(booking);
  });

  it('forwards notifyNewUser to adminBot.notifyNewUser', async () => {
    const adminBot = makeAdminBot();
    const adapter = new TelegramBots(makeUserBot(), adminBot);
    const user = { platform: 'telegram' as const, platformId: '7' };

    await adapter.notifyNewUser(user);

    expect(adminBot.notifyNewUser).toHaveBeenCalledWith(user);
  });

  it('forwards sendCsvToAdmin to adminBot.sendCsvToAdmin (id as number)', async () => {
    const adminBot = makeAdminBot();
    const adapter = new TelegramBots(makeUserBot(), adminBot);
    const buffer = Buffer.from('a,b,c');

    await adapter.sendCsvToAdmin('100', buffer, 'export.csv');

    expect(adminBot.sendCsvToAdmin).toHaveBeenCalledWith(100, buffer, 'export.csv');
  });

  it('stop() stops both bots', async () => {
    const userBot = makeUserBot();
    const adminBot = makeAdminBot();
    const adapter = new TelegramBots(userBot, adminBot);

    await adapter.stop();

    expect(userBot.stop).toHaveBeenCalled();
    expect(adminBot.stop).toHaveBeenCalled();
  });
});
