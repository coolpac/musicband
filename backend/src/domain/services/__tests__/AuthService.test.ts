import { AuthService, JWTPayload } from '../AuthService';
import type { IUserRepository } from '../../../infrastructure/database/repositories/UserRepository';

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
});
