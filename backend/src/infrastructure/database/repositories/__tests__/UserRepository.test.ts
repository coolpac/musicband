// Avoid instantiating the real PrismaClient singleton (needs DATABASE_URL).
jest.mock('../../../../config/database', () => ({ prisma: {} }));

import { PrismaUserRepository } from '../UserRepository';
import type { PrismaClient, User } from '@prisma/client';

type MockUserDelegate = {
  findUnique: jest.Mock;
  findUniqueOrThrow: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

function makeClient(): { client: PrismaClient; user: MockUserDelegate } {
  const user: MockUserDelegate = {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  return { client: { user } as unknown as PrismaClient, user };
}

const fakeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'u1',
    platform: 'max',
    platformId: 123n,
    photoUrl: null,
    username: null,
    firstName: null,
    lastName: null,
    role: 'user',
    referrerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('PrismaUserRepository.findByIdentity', () => {
  it('queries by the composite (platform, platformId) key', async () => {
    const { client, user } = makeClient();
    const repo = new PrismaUserRepository(client);
    const expected = fakeUser();
    user.findUnique.mockResolvedValue(expected);

    const result = await repo.findByIdentity('max', 123n);

    expect(user.findUnique).toHaveBeenCalledWith({
      where: { platform_platformId: { platform: 'max', platformId: 123n } },
    });
    expect(result).toBe(expected);
  });
});

describe('PrismaUserRepository.findOrCreateByIdentity', () => {
  it('returns the existing user without creating when found', async () => {
    const { client, user } = makeClient();
    const repo = new PrismaUserRepository(client);
    const existing = fakeUser();
    user.findUnique.mockResolvedValue(existing);

    const result = await repo.findOrCreateByIdentity({ platform: 'max', platformId: 123n });

    expect(user.findUnique).toHaveBeenCalledWith({
      where: { platform_platformId: { platform: 'max', platformId: 123n } },
    });
    expect(user.create).not.toHaveBeenCalled();
    expect(result).toEqual({ user: existing, created: false });
  });

  it('creates a new user with platform + platformId when none exists', async () => {
    const { client, user } = makeClient();
    const repo = new PrismaUserRepository(client);
    const created = fakeUser();
    user.findUnique.mockResolvedValue(null);
    user.create.mockResolvedValue(created);

    const result = await repo.findOrCreateByIdentity({
      platform: 'max',
      platformId: 123n,
      username: 'maxuser',
    });

    expect(user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ platform: 'max', platformId: 123n, username: 'maxuser' }),
    });
    expect(result).toEqual({ user: created, created: true });
  });

  it('recovers from a P2002 race by re-reading via the composite key', async () => {
    const { client, user } = makeClient();
    const repo = new PrismaUserRepository(client);
    const raced = fakeUser();
    user.findUnique.mockResolvedValue(null);
    user.create.mockRejectedValue({ code: 'P2002' });
    user.findUniqueOrThrow.mockResolvedValue(raced);

    const result = await repo.findOrCreateByIdentity({ platform: 'max', platformId: 123n });

    expect(user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { platform_platformId: { platform: 'max', platformId: 123n } },
    });
    expect(result).toEqual({ user: raced, created: false });
  });
});
