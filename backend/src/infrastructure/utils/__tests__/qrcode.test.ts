import {
  normalizeTelegramBotUsername,
  normalizeMaxBotUsername,
  generateTelegramBotDeepLink,
  generateTelegramMiniAppDirectLink,
  buildDeepLink,
  generateVotingSessionQR,
  generateVotingSessionQRForPlatforms,
} from '../qrcode';

describe('qrcode deep-link builders', () => {
  describe('normalizeTelegramBotUsername (unchanged)', () => {
    it('strips @ and t.me prefixes, falls back to default', () => {
      expect(normalizeTelegramBotUsername('@vgulbot')).toBe('vgulbot');
      expect(normalizeTelegramBotUsername('https://t.me/vgulbot')).toBe('vgulbot');
      expect(normalizeTelegramBotUsername('t.me/vgulbot/')).toBe('vgulbot');
      expect(normalizeTelegramBotUsername('')).toBe('vgulbot');
      expect(normalizeTelegramBotUsername(undefined)).toBe('vgulbot');
    });
  });

  describe('normalizeMaxBotUsername', () => {
    const FALLBACK_ENV = 'MAX_USER_BOT_USERNAME';
    const original = process.env[FALLBACK_ENV];

    afterEach(() => {
      if (original === undefined) delete process.env[FALLBACK_ENV];
      else process.env[FALLBACK_ENV] = original;
    });

    it('strips @ and max.ru prefixes', () => {
      expect(normalizeMaxBotUsername('@id744719465529_bot')).toBe('id744719465529_bot');
      expect(normalizeMaxBotUsername('https://max.ru/id744719465529_bot')).toBe(
        'id744719465529_bot'
      );
      expect(normalizeMaxBotUsername('max.ru/id744719465529_bot/')).toBe('id744719465529_bot');
    });

    it('falls back to configured MAX_USER_BOT_USERNAME when empty', () => {
      process.env[FALLBACK_ENV] = 'id111_bot';
      expect(normalizeMaxBotUsername('')).toBe('id111_bot');
      expect(normalizeMaxBotUsername(undefined)).toBe('id111_bot');
    });

    it('accepts an explicit fallback argument', () => {
      expect(normalizeMaxBotUsername('', 'explicit_bot')).toBe('explicit_bot');
    });
  });

  describe('buildDeepLink — telegram parity', () => {
    it('telegram bot deep link is byte-identical to generateTelegramBotDeepLink', () => {
      const payload = 'vote_abc';
      expect(buildDeepLink('telegram', 'vgulbot', payload)).toBe(
        generateTelegramBotDeepLink('vgulbot', payload)
      );
      expect(buildDeepLink('telegram', 'vgulbot', payload)).toBe(
        'https://t.me/vgulbot?start=vote_abc'
      );
    });

    it('telegram mini-app variant is byte-identical to generateTelegramMiniAppDirectLink', () => {
      const payload = 'vote_abc';
      expect(buildDeepLink('telegram', 'vgulbot', payload, { miniAppName: 'app' })).toBe(
        generateTelegramMiniAppDirectLink('vgulbot', 'app', payload)
      );
      expect(buildDeepLink('telegram', 'vgulbot', payload, { miniAppName: 'app' })).toBe(
        'https://t.me/vgulbot/app?startapp=vote_abc'
      );
    });
  });

  describe('buildDeepLink — max', () => {
    it('max bot deep link uses max.ru/<bot>?start=', () => {
      expect(buildDeepLink('max', 'id744719465529_bot', 'vote_abc')).toBe(
        'https://max.ru/id744719465529_bot?start=vote_abc'
      );
    });

    it('max mini-app variant uses ?startapp=', () => {
      expect(buildDeepLink('max', 'id744719465529_bot', 'vote_abc', { miniApp: true })).toBe(
        'https://max.ru/id744719465529_bot?startapp=vote_abc'
      );
    });

    it('normalizes max bot username inside buildDeepLink', () => {
      expect(buildDeepLink('max', '@id744719465529_bot', 'vote_abc')).toBe(
        'https://max.ru/id744719465529_bot?start=vote_abc'
      );
    });
  });

  describe('generateVotingSessionQR (existing telegram callers unchanged)', () => {
    it('returns telegram bot deep link + dataURL + buffer', async () => {
      const result = await generateVotingSessionQR('sess1', 'vgulbot');
      expect(result.deepLink).toBe('https://t.me/vgulbot?start=vote_sess1');
      expect(result.qrCodeDataURL).toMatch(/^data:image\/png;base64,/);
      expect(result.qrCodeBuffer).toBeInstanceOf(Buffer);
    });

    it('uses mini-app direct link when miniAppName is provided', async () => {
      const result = await generateVotingSessionQR('sess1', 'vgulbot', {}, 'app');
      expect(result.deepLink).toBe('https://t.me/vgulbot/app?startapp=vote_sess1');
    });
  });

  describe('generateVotingSessionQRForPlatforms', () => {
    it('builds a telegram QR encoding the t.me deep link', async () => {
      const result = await generateVotingSessionQRForPlatforms('sess1', 'telegram', 'vgulbot');
      expect(result.deepLink).toBe('https://t.me/vgulbot?start=vote_sess1');
      expect(result.qrCodeBuffer).toBeInstanceOf(Buffer);
    });

    it('builds a max QR encoding the max.ru deep link', async () => {
      const result = await generateVotingSessionQRForPlatforms(
        'sess1',
        'max',
        'id744719465529_bot'
      );
      expect(result.deepLink).toBe('https://max.ru/id744719465529_bot?start=vote_sess1');
      expect(result.qrCodeBuffer).toBeInstanceOf(Buffer);
    });
  });
});
