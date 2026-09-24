import { TelegramAuthSchema, MaxAuthSchema } from '../auth.dto';

/**
 * Регрессия: фронтенд шлёт `startParam: getStartParam()`, который равен `null`,
 * когда deep-link отсутствует (обычный вход в админку). Схема обязана принимать
 * null (иначе validate() возвращает 400 и авторизация в Telegram/Max ломается).
 */
describe('Auth DTO startParam accepts null (deep-link absent)', () => {
  describe.each([
    ['TelegramAuthSchema', TelegramAuthSchema],
    ['MaxAuthSchema', MaxAuthSchema],
  ])('%s', (_name, schema) => {
    it('accepts startParam: null', () => {
      expect(schema.safeParse({ initData: 'x', startParam: null }).success).toBe(true);
    });

    it('accepts startParam absent', () => {
      expect(schema.safeParse({ initData: 'x' }).success).toBe(true);
    });

    it('accepts a real start param string', () => {
      expect(schema.safeParse({ initData: 'x', startParam: 'vote_42' }).success).toBe(true);
    });

    it('still rejects empty initData', () => {
      expect(schema.safeParse({ initData: '', startParam: null }).success).toBe(false);
    });
  });
});
