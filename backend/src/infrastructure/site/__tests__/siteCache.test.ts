const redisMock = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
};

jest.mock('../../../config/redis', () => ({ redis: redisMock }));

import { invalidatePublicSiteCache, purgeSiteSsr } from '../siteCache';
import { CACHE_KEYS } from '../../../shared/utils/cache';

const originalFetch = global.fetch;

describe('purgeSiteSsr', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SITE_SSR_URL;
    delete process.env.SITE_PURGE_TOKEN;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('does nothing when SITE_SSR_URL is not configured', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(purgeSiteSsr()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts to /__purge with the bearer token and no trailing slash', async () => {
    process.env.SITE_SSR_URL = 'http://site:4000/';
    process.env.SITE_PURGE_TOKEN = 's3cret';

    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    await purgeSiteSsr();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://site:4000/__purge');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer s3cret');
    expect(init.signal).toBeDefined();
  });

  it('omits the Authorization header when no token is configured', async () => {
    process.env.SITE_SSR_URL = 'http://site:4000';

    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    await purgeSiteSsr();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('never throws when the site server is down', async () => {
    process.env.SITE_SSR_URL = 'http://site:4000';

    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    await expect(purgeSiteSsr()).resolves.toBeUndefined();

    global.fetch = jest
      .fn()
      .mockRejectedValue(new DOMException('aborted', 'TimeoutError')) as unknown as typeof fetch;
    await expect(purgeSiteSsr()).resolves.toBeUndefined();
  });

  it('never throws when the site server answers with an error status', async () => {
    process.env.SITE_SSR_URL = 'http://site:4000';
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(purgeSiteSsr()).resolves.toBeUndefined();
  });
});

describe('invalidatePublicSiteCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SITE_SSR_URL;
  });

  it('drops the redis key and resolves even if the purge fails', async () => {
    process.env.SITE_SSR_URL = 'http://site:4000';
    global.fetch = jest.fn().mockRejectedValue(new Error('nope')) as unknown as typeof fetch;

    await expect(invalidatePublicSiteCache()).resolves.toBeUndefined();
    expect(redisMock.del).toHaveBeenCalledWith(CACHE_KEYS.SITE_PUBLIC);
  });

  it('resolves even if redis itself is down', async () => {
    redisMock.del.mockRejectedValueOnce(new Error('redis down'));

    await expect(invalidatePublicSiteCache()).resolves.toBeUndefined();
  });
});
