import type { Request, Response, NextFunction } from 'express';
import { AuthController } from '../AuthController';
import type { AuthService } from '../../../domain/services/AuthService';
import type { IUserRepository } from '../../../infrastructure/database/repositories/UserRepository';

/**
 * Phase 7: platform-aware avatar resolution.
 * - telegram: existing bot-API proxy (мы НЕ перепроверяем весь proxy, лишь то, что
 *   ветка telegram идёт по fetch-пути и не трогает userRepository).
 * - max: serve stored User.photoUrl via 302 redirect; 404 if нет photoUrl.
 */

function makeRes() {
  const res: Partial<Response> & {
    statusCode?: number;
    redirectedTo?: string;
    body?: unknown;
  } = {};
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.send = jest.fn().mockImplementation((b?: unknown) => {
    res.body = b;
    return res as Response;
  });
  res.redirect = jest.fn().mockImplementation((url: string) => {
    res.redirectedTo = url;
    return res as Response;
  });
  res.setHeader = jest.fn();
  res.json = jest.fn();
  return res as Response & { statusCode?: number; redirectedTo?: string; body?: unknown };
}

function makeRepo(): jest.Mocked<IUserRepository> {
  return {
    findByIdentity: jest.fn(),
  } as unknown as jest.Mocked<IUserRepository>;
}

const next: NextFunction = jest.fn();
const authService = {} as unknown as AuthService;

describe('AuthController.getAvatar — platform-aware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Max user with stored photoUrl → 302 redirect to it', async () => {
    const repo = makeRepo();
    repo.findByIdentity.mockResolvedValue({
      photoUrl: 'https://cdn.max.ru/avatar/abc.jpg',
    } as never);
    const controller = new AuthController(authService, repo);

    const req = {
      user: { userId: 'u1', platform: 'max', platformId: '744719465529', role: 'user' },
    } as unknown as Request;
    const res = makeRes();

    await controller.getAvatar(req, res, next);

    expect(repo.findByIdentity).toHaveBeenCalledWith('max', BigInt('744719465529'));
    expect(res.redirect).toHaveBeenCalledWith('https://cdn.max.ru/avatar/abc.jpg');
    expect(res.redirectedTo).toBe('https://cdn.max.ru/avatar/abc.jpg');
  });

  it('Max user without photoUrl → 404', async () => {
    const repo = makeRepo();
    repo.findByIdentity.mockResolvedValue({ photoUrl: null } as never);
    const controller = new AuthController(authService, repo);

    const req = {
      user: { userId: 'u1', platform: 'max', platformId: '999', role: 'user' },
    } as unknown as Request;
    const res = makeRes();

    await controller.getAvatar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('Max user not found → 404', async () => {
    const repo = makeRepo();
    repo.findByIdentity.mockResolvedValue(null);
    const controller = new AuthController(authService, repo);

    const req = {
      user: { userId: 'u1', platform: 'max', platformId: '999', role: 'user' },
    } as unknown as Request;
    const res = makeRes();

    await controller.getAvatar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('no platformId → 404 (both platforms)', async () => {
    const repo = makeRepo();
    const controller = new AuthController(authService, repo);

    const req = { user: { userId: 'u1', platform: 'max', platformId: '', role: 'user' } } as unknown as Request;
    const res = makeRes();

    await controller.getAvatar(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(repo.findByIdentity).not.toHaveBeenCalled();
  });

  it('telegram path does not touch userRepository and returns 503 when no bot token', async () => {
    const repo = makeRepo();
    const controller = new AuthController(authService, repo);
    const prevToken = process.env.TELEGRAM_ADMIN_BOT_TOKEN;
    delete process.env.TELEGRAM_ADMIN_BOT_TOKEN;

    const req = {
      user: { userId: 'u1', platform: 'telegram', platformId: '111', role: 'user' },
    } as unknown as Request;
    const res = makeRes();

    await controller.getAvatar(req, res, next);

    // Telegram-ветка не зависит от userRepository.
    expect(repo.findByIdentity).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);

    if (prevToken === undefined) delete process.env.TELEGRAM_ADMIN_BOT_TOKEN;
    else process.env.TELEGRAM_ADMIN_BOT_TOKEN = prevToken;
  });
});
