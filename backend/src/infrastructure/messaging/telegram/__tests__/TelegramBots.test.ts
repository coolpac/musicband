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

  // adminRaw.getFileLink резолвит admin-овый file_id в URL (как реальный admin-бот).
  const makeAdminBot = () => {
    const adminRaw = {
      getFileLink: jest.fn().mockResolvedValue('https://api.telegram.org/file/botADMIN/x.jpg'),
    };
    const adminBot = {
      notifyNewBooking: jest.fn().mockResolvedValue(undefined),
      notifyNewUser: jest.fn().mockResolvedValue(undefined),
      sendCsvToAdmin: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      getBot: jest.fn(() => adminRaw),
    } as unknown as jest.Mocked<AdminBot>;
    return adminBot;
  };

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

  // Покрываем перенесённую из BotManager логику broadcast (единственный нетривиальный
  // код, который реально переехал). <25 получателей — без 1s-троттла.
  describe('broadcast', () => {
    const makeRawBot = () =>
      ({
        sendMessage: jest.fn().mockResolvedValue(undefined),
        sendPhoto: jest.fn().mockResolvedValue(undefined),
        sendVideo: jest.fn().mockResolvedValue(undefined),
        sendDocument: jest.fn().mockResolvedValue(undefined),
      }) as unknown as ReturnType<UserBot['getBot']> & {
        sendMessage: jest.Mock;
        sendPhoto: jest.Mock;
        sendVideo: jest.Mock;
        sendDocument: jest.Mock;
      };

    // Адаптер скачивает байты медиа (getFileLink → fetch). Мокаем глобальный fetch,
    // чтобы вернуть валидный буфер без сетевого запроса.
    let fetchSpy: jest.SpyInstance;
    beforeEach(() => {
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        headers: { get: () => null }, // адаптер читает content-length
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as unknown as Response);
    });
    afterEach(() => fetchSpy.mockRestore());

    it('sends text to every recipient, chunks buttons 2-per-row, and reports progress', async () => {
      const userBot = makeUserBot();
      const rawBot = makeRawBot();
      (userBot.getBot as jest.Mock).mockReturnValue(rawBot);
      const adapter = new TelegramBots(userBot, makeAdminBot());
      const onProgress = jest.fn().mockResolvedValue(undefined);

      const result = await adapter.broadcast(['1', '2', '3'], {
        text: 'hi',
        buttons: [
          { text: 'A', url: 'https://a', kind: 'url' },
          { text: 'B', url: 'https://b', kind: 'web_app' },
          { text: 'C', url: 'https://c', kind: 'url' },
        ],
        onProgress,
      });

      expect(rawBot.sendMessage).toHaveBeenCalledTimes(3);
      const replyMarkup = (rawBot.sendMessage as jest.Mock).mock.calls[0][2].reply_markup;
      // 3 кнопки -> 2 ряда: [A,B], [C]; web_app vs url сохраняются
      expect(replyMarkup.inline_keyboard).toEqual([
        [
          { text: 'A', url: 'https://a' },
          { text: 'B', web_app: { url: 'https://b' } },
        ],
        [{ text: 'C', url: 'https://c' }],
      ]);
      expect(result).toEqual({ sent: 3, failed: 0, total: 3 });
      // initial + final как минимум
      expect(onProgress).toHaveBeenCalledWith({ sent: 0, failed: 0, total: 3 });
      expect(onProgress).toHaveBeenCalledWith({ sent: 3, failed: 0, total: 3 });
    });

    it('downloads admin media bytes and sends a Buffer (user bot cannot use admin file_id/URL)', async () => {
      const userBot = makeUserBot();
      const rawBot = makeRawBot();
      (userBot.getBot as jest.Mock).mockReturnValue(rawBot);
      const adminBot = makeAdminBot();
      const adapter = new TelegramBots(userBot, adminBot);

      await adapter.broadcast(['1'], {
        text: 'caption',
        buttons: [],
        media: { type: 'photo', fileId: 'admin-file-123' },
      });

      // file_id → URL через admin-бота, затем скачиваем байты этого URL.
      expect((adminBot.getBot() as unknown as { getFileLink: jest.Mock }).getFileLink).toHaveBeenCalledWith(
        'admin-file-123'
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.telegram.org/file/botADMIN/x.jpg',
        expect.objectContaining({ signal: expect.anything() })
      );
      // user-бот шлёт БУФЕР (не URL/файл-id) + fileOptions с именем из URL.
      const [chatId, photo, , fopts] = (rawBot.sendPhoto as jest.Mock).mock.calls[0];
      expect(chatId).toBe('1');
      expect(Buffer.isBuffer(photo)).toBe(true);
      expect(fopts).toEqual({ filename: 'x.jpg', contentType: 'image/jpeg' });
      expect(rawBot.sendMessage).not.toHaveBeenCalled();
    });

    it('uses a pre-resolved payload.mediaBuffer without re-downloading', async () => {
      const userBot = makeUserBot();
      const rawBot = makeRawBot();
      (userBot.getBot as jest.Mock).mockReturnValue(rawBot);
      const adminBot = makeAdminBot();
      const adapter = new TelegramBots(userBot, adminBot);
      const buf = Buffer.from('poster-bytes');

      await adapter.broadcast(['1'], {
        text: 'caption',
        buttons: [],
        media: { type: 'photo', fileId: 'admin-file-123' },
        mediaBuffer: buf,
        mediaFilename: 'poster.jpg',
      });

      // BotManager уже скачал байты — адаптер не дёргает ни getFileLink, ни fetch.
      expect(
        (adminBot.getBot() as unknown as { getFileLink: jest.Mock }).getFileLink
      ).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      const [, photo, , fopts] = (rawBot.sendPhoto as jest.Mock).mock.calls[0];
      expect(photo).toBe(buf);
      expect(fopts).toEqual({ filename: 'poster.jpg', contentType: 'image/jpeg' });
    });

    it('reuses the user-bot file_id from the first send for subsequent recipients', async () => {
      const userBot = makeUserBot();
      const rawBot = makeRawBot();
      // sendPhoto возвращает Message с user-бот-овым file_id.
      (rawBot.sendPhoto as jest.Mock).mockResolvedValue({ photo: [{ file_id: 'user-fid' }] });
      (userBot.getBot as jest.Mock).mockReturnValue(rawBot);
      const adapter = new TelegramBots(userBot, makeAdminBot());

      await adapter.broadcast(['1', '2', '3'], {
        text: 'cap',
        buttons: [],
        media: { type: 'photo', fileId: 'admin-file-123' },
      });

      // первому — БУФЕР (байты), остальным — переиспользуем user-бот-овый file_id.
      expect(Buffer.isBuffer((rawBot.sendPhoto as jest.Mock).mock.calls[0][1])).toBe(true);
      expect((rawBot.sendPhoto as jest.Mock).mock.calls[1][1]).toBe('user-fid');
      expect((rawBot.sendPhoto as jest.Mock).mock.calls[2][1]).toBe('user-fid');
    });

    it('reuses the user-bot file_id for VIDEO too', async () => {
      const userBot = makeUserBot();
      const rawBot = makeRawBot();
      (rawBot.sendVideo as jest.Mock).mockResolvedValue({ video: { file_id: 'user-vid' } });
      (userBot.getBot as jest.Mock).mockReturnValue(rawBot);
      const adapter = new TelegramBots(userBot, makeAdminBot());

      await adapter.broadcast(['1', '2'], {
        text: 'clip',
        buttons: [],
        media: { type: 'video', fileId: 'admin-vid' },
      });

      expect(Buffer.isBuffer((rawBot.sendVideo as jest.Mock).mock.calls[0][1])).toBe(true);
      expect((rawBot.sendVideo as jest.Mock).mock.calls[1][1]).toBe('user-vid');
    });

    it('falls back to text for ALL recipients if the first media (buffer) send fails', async () => {
      const userBot = makeUserBot();
      const rawBot = makeRawBot();
      // Битый буфер: первая sendPhoto падает (как "Unsupported Buffer file-type"/400).
      (rawBot.sendPhoto as jest.Mock).mockRejectedValue(new Error('Unsupported Buffer file-type'));
      (userBot.getBot as jest.Mock).mockReturnValue(rawBot);
      const adapter = new TelegramBots(userBot, makeAdminBot());

      const result = await adapter.broadcast(['1', '2', '3'], {
        text: 'caption',
        buttons: [],
        media: { type: 'photo', fileId: 'admin-file-123' },
      });

      // Медиа не доставилось, но ВСЕ получили текст — рассылка не «0 из N».
      expect(result).toEqual({ sent: 3, failed: 0, total: 3 });
      // sendPhoto пробуется только один раз (первый получатель), дальше — текст.
      expect((rawBot.sendPhoto as jest.Mock)).toHaveBeenCalledTimes(1);
      expect((rawBot.sendMessage as jest.Mock)).toHaveBeenCalledTimes(3);
    });

    // Регрессия (реальный прод-баг): «chat not found» у ПЕРВОГО получателя не должен
    // лишать картинки всех остальных — это пер-юзерная ошибка, а не проблема медиа.
    it('does NOT disable media when an early recipient errors with chat-not-found/blocked', async () => {
      const userBot = makeUserBot();
      const rawBot = makeRawBot();
      (rawBot.sendPhoto as jest.Mock)
        .mockRejectedValueOnce({
          response: { error_code: 400, description: 'Bad Request: chat not found' },
        })
        .mockResolvedValueOnce({ photo: [{ file_id: 'user-fid' }] }) // 2-й — буфер ок, даёт file_id
        .mockResolvedValue({ photo: [{ file_id: 'user-fid' }] }); // 3-й — переиспользование
      (userBot.getBot as jest.Mock).mockReturnValue(rawBot);
      const adapter = new TelegramBots(userBot, makeAdminBot());

      const result = await adapter.broadcast(['1', '2', '3'], {
        text: 'caption',
        buttons: [],
        media: { type: 'photo', fileId: 'admin-file-123' },
      });

      // 1-й — сбой получателя; 2-й и 3-й получили ФОТО (а не текст).
      expect(result).toEqual({ sent: 2, failed: 1, total: 3 });
      expect((rawBot.sendPhoto as jest.Mock)).toHaveBeenCalledTimes(3); // медиа НЕ отключилось
      expect((rawBot.sendMessage as jest.Mock)).not.toHaveBeenCalled(); // текст-фолбэка нет
      expect(Buffer.isBuffer((rawBot.sendPhoto as jest.Mock).mock.calls[1][1])).toBe(true);
      expect((rawBot.sendPhoto as jest.Mock).mock.calls[2][1]).toBe('user-fid');
    });

    it('resolveMediaBuffer returns undefined on non-OK download (no retry on 404)', async () => {
      const adapter = new TelegramBots(makeUserBot(), makeAdminBot());
      fetchSpy.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);

      const out = await adapter.resolveMediaBuffer('admin-file-123');

      expect(out).toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(1); // 404 — постоянная ошибка, без ретраев
    });

    it('resolveMediaBuffer skips oversized media (content-length over limit)', async () => {
      const adapter = new TelegramBots(makeUserBot(), makeAdminBot());
      fetchSpy.mockResolvedValue({
        ok: true,
        headers: { get: () => String(60 * 1024 * 1024) },
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      } as unknown as Response);

      const out = await adapter.resolveMediaBuffer('admin-file-123');

      expect(out).toBeUndefined();
    });

    it('counts a 403 (user blocked bot) as failed without throwing', async () => {
      const userBot = makeUserBot();
      const rawBot = makeRawBot();
      (rawBot.sendMessage as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce({ response: { error_code: 403 } });
      (userBot.getBot as jest.Mock).mockReturnValue(rawBot);
      const adapter = new TelegramBots(userBot, makeAdminBot());

      const result = await adapter.broadcast(['1', '2'], { text: 'hi', buttons: [] });

      expect(result).toEqual({ sent: 1, failed: 1, total: 2 });
    });
  });
});
