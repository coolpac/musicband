import { MaxError } from '@maxhub/max-bot-api';
import { classifyMaxError } from '../maxErrors';

/**
 * maxErrors — классификация ошибок Max API в типизированный результат.
 * Зеркалит дух TelegramBots.broadcast: 403 «пользователь заблокировал бота» глотаем,
 * rate-limit (429) — помечаем как retryable.
 */
describe('classifyMaxError', () => {
  it('marks a forbidden (403) error as user-unreachable', () => {
    const err = new MaxError(403, { code: 'forbidden', message: 'user blocked the bot' });

    const result = classifyMaxError(err);

    expect(result.isUserUnreachable).toBe(true);
    expect(result.shouldRetry).toBe(false);
    expect(result.status).toBe(403);
    expect(result.code).toBe('forbidden');
  });

  it('marks a 404 chat-not-found error as user-unreachable', () => {
    const err = new MaxError(404, { code: 'not.found', message: 'chat not found' });

    const result = classifyMaxError(err);

    expect(result.isUserUnreachable).toBe(true);
    expect(result.shouldRetry).toBe(false);
  });

  it('marks a rate-limit (429) error as retryable', () => {
    const err = new MaxError(429, { code: 'too.many.requests', message: 'rate limited' });

    const result = classifyMaxError(err);

    expect(result.shouldRetry).toBe(true);
    expect(result.isUserUnreachable).toBe(false);
    expect(result.status).toBe(429);
  });

  it('treats a 500 server error as retryable but reachable', () => {
    const err = new MaxError(503, { code: 'service.unavailable', message: 'try later' });

    const result = classifyMaxError(err);

    expect(result.shouldRetry).toBe(true);
    expect(result.isUserUnreachable).toBe(false);
  });

  it('classifies an unknown (non-MaxError) error as neither retryable nor unreachable', () => {
    const result = classifyMaxError(new Error('boom'));

    expect(result.isUserUnreachable).toBe(false);
    expect(result.shouldRetry).toBe(false);
    expect(result.status).toBeUndefined();
    expect(result.message).toBe('boom');
  });

  it('exposes a helper isUserUnreachable for swallow-on-send sites', async () => {
    const { isUserUnreachable } = await import('../maxErrors');
    expect(isUserUnreachable(new MaxError(403, { code: 'forbidden', message: 'blocked' }))).toBe(
      true
    );
    expect(isUserUnreachable(new Error('other'))).toBe(false);
  });
});
