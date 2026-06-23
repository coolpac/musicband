import { PosterService } from '../PosterService';
import type { IPosterRepository } from '../../../infrastructure/database/repositories/PosterRepository';
import type { Poster } from '@prisma/client';

const makeRepo = (): jest.Mocked<IPosterRepository> =>
  ({
    findAll: jest.fn(),
    findActive: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }) as unknown as jest.Mocked<IPosterRepository>;

const poster = (over: Partial<Poster> = {}): Poster =>
  ({
    id: 'p1',
    title: 'Афиша',
    description: null,
    imageUrl: null,
    link: null,
    order: 0,
    isActive: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...over,
  }) as Poster;

describe('PosterService visibility', () => {
  it('getActivePosters returns only active (public path)', async () => {
    const repo = makeRepo();
    repo.findActive.mockResolvedValue([poster({ id: 'a' })]);
    const service = new PosterService(repo);

    const res = await service.getActivePosters();

    expect(repo.findActive).toHaveBeenCalledTimes(1);
    expect(repo.findAll).not.toHaveBeenCalled();
    expect(res).toHaveLength(1);
  });

  it('getAllPosters returns everything incl. hidden (admin path)', async () => {
    const repo = makeRepo();
    repo.findAll.mockResolvedValue([poster({ isActive: true }), poster({ id: 'h', isActive: false })]);
    const service = new PosterService(repo);

    const res = await service.getAllPosters();

    expect(repo.findAll).toHaveBeenCalledTimes(1);
    expect(repo.findActive).not.toHaveBeenCalled();
    expect(res).toHaveLength(2);
  });

  it('togglePosterActive flips visible -> hidden', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(poster({ isActive: true }));
    repo.update.mockResolvedValue(poster({ isActive: false }));
    const service = new PosterService(repo);

    const res = await service.togglePosterActive('p1');

    expect(repo.update).toHaveBeenCalledWith('p1', { isActive: false });
    expect(res.isActive).toBe(false);
  });

  it('togglePosterActive flips hidden -> visible', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(poster({ isActive: false }));
    repo.update.mockResolvedValue(poster({ isActive: true }));
    const service = new PosterService(repo);

    const res = await service.togglePosterActive('p1');

    expect(repo.update).toHaveBeenCalledWith('p1', { isActive: true });
    expect(res.isActive).toBe(true);
  });

  it('togglePosterActive throws NotFound for unknown id', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null);
    const service = new PosterService(repo);

    await expect(service.togglePosterActive('nope')).rejects.toThrow();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
