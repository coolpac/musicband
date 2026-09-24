import crypto from 'crypto';
import { validateMaxInitData } from '../max';

const FAKE_BOT_TOKEN = '123456:FAKE-max-bot-token';

/**
 * Подписывает initData тем же алгоритмом, что использует Max (== Telegram):
 * secret = HMAC_SHA256(key="WebAppData", msg=botToken)
 * hash   = HMAC_SHA256(key=secret, msg=data_check_string)
 */
function signInitData(
  fields: Record<string, string>,
  botToken: string
): { raw: string; hash: string } {
  const sortedKeys = Object.keys(fields).sort((a, b) => a.localeCompare(b));
  const dataCheckString = sortedKeys.map((key) => `${key}=${fields[key]}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const params = new URLSearchParams();
  for (const key of Object.keys(fields)) {
    params.set(key, fields[key]);
  }
  params.set('hash', hash);
  return { raw: params.toString(), hash };
}

const makeUser = () =>
  JSON.stringify({
    id: 987654321,
    first_name: 'Макс',
    last_name: 'Тестов',
    username: 'maxtest',
    photo_url: 'https://example.com/max.jpg',
    language_code: 'ru',
  });

const nowSec = () => Math.floor(Date.now() / 1000);

describe('validateMaxInitData', () => {
  it('(a) returns parsed user/auth_date/start_param for a valid signed payload', () => {
    const authDate = nowSec();
    const { raw } = signInitData(
      {
        user: makeUser(),
        auth_date: String(authDate),
        start_param: 'vote_session42',
        query_id: 'q-1',
      },
      FAKE_BOT_TOKEN
    );

    const result = validateMaxInitData(raw, FAKE_BOT_TOKEN);

    expect(result).not.toBeNull();
    expect(result?.auth_date).toBe(authDate);
    expect(result?.start_param).toBe('vote_session42');
    expect(result?.query_id).toBe('q-1');
    expect(result?.user).toEqual({
      id: 987654321,
      first_name: 'Макс',
      last_name: 'Тестов',
      username: 'maxtest',
      photo_url: 'https://example.com/max.jpg',
      language_code: 'ru',
    });
  });

  it('(b) returns null when the hash is tampered', () => {
    const { raw } = signInitData(
      { user: makeUser(), auth_date: String(nowSec()) },
      FAKE_BOT_TOKEN
    );
    const tampered = raw.replace(/hash=[0-9a-f]+/, 'hash=deadbeef');

    expect(validateMaxInitData(tampered, FAKE_BOT_TOKEN)).toBeNull();
  });

  it('(c) returns null when auth_date is expired (older than maxAge)', () => {
    const { raw } = signInitData(
      { user: makeUser(), auth_date: String(nowSec() - 7200) },
      FAKE_BOT_TOKEN
    );

    expect(validateMaxInitData(raw, FAKE_BOT_TOKEN, 3600)).toBeNull();
  });

  it('(d) returns null when auth_date is in the future', () => {
    const { raw } = signInitData(
      { user: makeUser(), auth_date: String(nowSec() + 7200) },
      FAKE_BOT_TOKEN
    );

    expect(validateMaxInitData(raw, FAKE_BOT_TOKEN)).toBeNull();
  });

  it('(e) returns null when hash is missing', () => {
    const params = new URLSearchParams();
    params.set('user', makeUser());
    params.set('auth_date', String(nowSec()));

    expect(validateMaxInitData(params.toString(), FAKE_BOT_TOKEN)).toBeNull();
  });

  it('(f) returns null for a wrong bot token', () => {
    const { raw } = signInitData(
      { user: makeUser(), auth_date: String(nowSec()) },
      FAKE_BOT_TOKEN
    );

    expect(validateMaxInitData(raw, 'some-other-token')).toBeNull();
  });

  it('accepts a payload whose hash was computed independently (guards against symmetric-only bugs)', () => {
    // Fixed input + independently-computed expected hash via raw crypto.
    const authDate = nowSec();
    const userJson = JSON.stringify({ id: 42, first_name: 'Fixed' });
    const dataCheckString = ['auth_date=' + authDate, 'user=' + userJson].join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(FAKE_BOT_TOKEN).digest();
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const params = new URLSearchParams();
    params.set('auth_date', String(authDate));
    params.set('user', userJson);
    params.set('hash', expectedHash);

    const result = validateMaxInitData(params.toString(), FAKE_BOT_TOKEN);
    expect(result).not.toBeNull();
    expect(result?.hash).toBe(expectedHash);
    expect(result?.user?.id).toBe(42);
    expect(result?.user?.first_name).toBe('Fixed');
  });
});
