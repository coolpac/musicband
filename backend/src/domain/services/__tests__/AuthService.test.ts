import crypto from 'crypto';
import { AuthService, JWTPayload } from '../AuthService';
import type {
  IUserRepository,
  CreateUserData,
} from '../../../infrastructure/database/repositories/UserRepository';

const makeRepo = (): IUserRepository =>
  ({
    findByIdentity: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findOrCreateByIdentity: jest.fn(),
    update: jest.fn(),
    updateRole: jest.fn(),
    updateRoleByIdentity: jest.fn(),
  }) as unknown as IUserRepository;

describe('AuthService token round-trip', () => {
  it('generateToken/verifyToken preserves userId, platform, platformId, role (no telegramId)', () => {
    const service = new AuthService(makeRepo(), 'test-secret', '1h', 'admin-token');

    // generateToken is private; we exercise it through a tiny cast for the unit test.
    const token = (
      service as unknown as { generateToken(p: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): string }
    ).generateToken({
      userId: 'u1',
      platform: 'max',
      platformId: '123',
      role: 'user',
    });

    const decoded = service.verifyToken(token);

    expect(decoded.userId).toBe('u1');
    expect(decoded.platform).toBe('max');
    expect(decoded.platformId).toBe('123');
    expect(decoded.role).toBe('user');
    expect(decoded).not.toHaveProperty('telegramId');
    expect(typeof decoded.jti).toBe('string');
  });

  it('verifyToken normalizes a legacy token (telegramId, no platform) to telegram', () => {
    const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
    const service = new AuthService(makeRepo(), 'test-secret', '1h', 'admin-token');

    // Токен, выпущенный ДО перехода на (platform, platformId): только telegramId.
    const legacyToken = jwt.sign(
      { userId: 'u9', telegramId: '777', role: 'user', jti: 'legacy-jti' },
      'test-secret'
    );

    const decoded = service.verifyToken(legacyToken);

    expect(decoded.platform).toBe('telegram');
    expect(decoded.platformId).toBe('777');
    expect(decoded.userId).toBe('u9');
    expect(decoded.role).toBe('user');
  });
});

const MAX_USER_TOKEN = 'max-user-token';
const MAX_ADMIN_TOKEN = 'max-admin-token';

function signMaxInitData(fields: Record<string, string>, botToken: string): string {
  const sortedKeys = Object.keys(fields).sort((a, b) => a.localeCompare(b));
  const dataCheckString = sortedKeys.map((k) => `${k}=${fields[k]}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const params = new URLSearchParams();
  for (const k of Object.keys(fields)) params.set(k, fields[k]);
  params.set('hash', hash);
  return params.toString();
}

const makeMaxUser = () =>
  JSON.stringify({
    id: 555,
    first_name: 'Макс',
    last_name: 'Юзеров',
    username: 'maxuser',
    photo_url: 'https://example.com/p.jpg',
  });

describe('AuthService.authenticateWithMax', () => {
  const buildService = (repo: IUserRepository) =>
    new AuthService(
      repo,
      'test-secret',
      '1h',
      'tg-admin-token',
      'tg-user-token',
      undefined,
      MAX_ADMIN_TOKEN,
      MAX_USER_TOKEN
    );

  it('validates Max initData, creates user with platform=max + photoUrl, returns max token', async () => {
    const repo = makeRepo();
    let captured: CreateUserData | undefined;
    (repo.findOrCreateByIdentity as jest.Mock).mockImplementation(async (data: CreateUserData) => {
      captured = data;
      return {
        user: {
          id: 'u-max',
          platform: 'max',
          platformId: data.platformId,
          username: data.username ?? null,
          firstName: data.firstName ?? null,
          lastName: data.lastName ?? null,
          photoUrl: data.photoUrl ?? null,
          role: 'user',
        },
        created: true,
      };
    });
    const service = buildService(repo);

    const raw = signMaxInitData(
      {
        user: makeMaxUser(),
        auth_date: String(Math.floor(Date.now() / 1000)),
        start_param: 'vote_s1',
      },
      MAX_USER_TOKEN
    );

    const result = await service.authenticateWithMax(raw);

    expect(captured).toMatchObject({
      platform: 'max',
      platformId: BigInt(555),
      username: 'maxuser',
      firstName: 'Макс',
      lastName: 'Юзеров',
      photoUrl: 'https://example.com/p.jpg',
      role: 'user',
    });
    expect(result.user.platform).toBe('max');
    expect(result.user.platformId).toBe('555');
    expect(result.startParam).toBe('vote_s1');

    const decoded = service.verifyToken(result.token);
    expect(decoded.platform).toBe('max');
    expect(decoded.platformId).toBe('555');
  });

  it('accepts initData signed by the Max admin bot token', async () => {
    const repo = makeRepo();
    (repo.findOrCreateByIdentity as jest.Mock).mockResolvedValue({
      user: {
        id: 'u-max2',
        platform: 'max',
        platformId: BigInt(555),
        username: null,
        firstName: 'Макс',
        lastName: null,
        photoUrl: null,
        role: 'user',
      },
      created: false,
    });
    (repo.update as jest.Mock).mockImplementation(async (_id: string, data: Record<string, unknown>) => ({
      id: 'u-max2',
      platform: 'max',
      platformId: BigInt(555),
      username: data.username ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      photoUrl: data.photoUrl ?? null,
      role: 'user',
    }));
    const service = buildService(repo);

    const raw = signMaxInitData(
      { user: JSON.stringify({ id: 555, first_name: 'Макс' }), auth_date: String(Math.floor(Date.now() / 1000)) },
      MAX_ADMIN_TOKEN
    );

    const result = await service.authenticateWithMax(raw);
    expect(result.user.platform).toBe('max');
  });

  it('rejects invalid Max initData', async () => {
    const repo = makeRepo();
    const service = buildService(repo);
    await expect(service.authenticateWithMax('user=x&auth_date=1&hash=bad')).rejects.toThrow();
  });

  it('rejects when no Max bot tokens are configured', async () => {
    const repo = makeRepo();
    const service = new AuthService(repo, 'test-secret', '1h', 'tg-admin-token');
    const raw = signMaxInitData(
      { user: makeMaxUser(), auth_date: String(Math.floor(Date.now() / 1000)) },
      MAX_USER_TOKEN
    );
    await expect(service.authenticateWithMax(raw)).rejects.toThrow();
  });
});
