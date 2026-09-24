const redisMock = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
};

jest.mock('../../../config/redis', () => ({ redis: redisMock }));

import { Format, Partner, Poster, SiteContent } from '@prisma/client';
import { SiteContentService } from '../SiteContentService';
import { ISiteContentRepository } from '../../../infrastructure/database/repositories/SiteContentRepository';
import { IPosterRepository } from '../../../infrastructure/database/repositories/PosterRepository';
import { IFormatRepository } from '../../../infrastructure/database/repositories/FormatRepository';
import { IPartnerRepository } from '../../../infrastructure/database/repositories/PartnerRepository';
import { ImageStorage } from '../../../infrastructure/storage/ImageStorage';
import { getTodayDateString } from '../../../shared/utils/timezone';
import { CACHE_KEYS } from '../../../shared/utils/cache';

/** YYYY-MM-DD со сдвигом в днях от «сегодня» в поясе приложения → Date в UTC-полночь. */
function dayOffset(days: number): { date: Date; iso: string } {
  const today = getTodayDateString();
  const base = new Date(`${today}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return { date: base, iso: base.toISOString().slice(0, 10) };
}

const UPDATED = new Date('2026-09-20T10:00:00.000Z');

function poster(overrides: Partial<Poster> & Pick<Poster, 'id' | 'title'>): Poster {
  return {
    description: null,
    imageUrl: null,
    link: null,
    order: 0,
    eventDate: null,
    venue: null,
    createdAt: UPDATED,
    updatedAt: UPDATED,
    ...overrides,
  } as Poster;
}

function format(overrides: Partial<Format> & Pick<Format, 'id' | 'name'>): Format {
  return {
    shortDescription: null,
    description: null,
    imageUrl: null,
    suitableFor: null,
    performers: null,
    status: 'available',
    order: 0,
    createdAt: UPDATED,
    updatedAt: UPDATED,
    ...overrides,
  } as Format;
}

function partner(overrides: Partial<Partner> & Pick<Partner, 'id' | 'name'>): Partner {
  return {
    logoUrl: null,
    link: null,
    order: 0,
    createdAt: UPDATED,
    updatedAt: UPDATED,
    ...overrides,
  } as Partner;
}

interface Fakes {
  siteContent: jest.Mocked<ISiteContentRepository>;
  imageStorage: { resolveResponsiveVariants: jest.Mock };
  service: SiteContentService;
  /** Те же jest.fn отдельно: обращение к ним через интерфейс ловит unbound-method */
  mocks: { postersFindAll: jest.Mock; siteContentUpsert: jest.Mock };
}

function build(options: {
  content?: SiteContent[];
  posters?: Poster[];
  formats?: Format[];
  partners?: Partner[];
  variants?: Record<string, { avifSrcSet?: string; webpSrcSet?: string }>;
}): Fakes {
  const siteContentUpsert = jest.fn();
  const siteContent = {
    findAll: jest.fn().mockResolvedValue(options.content ?? []),
    findBySection: jest.fn(),
    upsert: siteContentUpsert,
  } as unknown as jest.Mocked<ISiteContentRepository>;

  const postersFindAll = jest.fn().mockResolvedValue(options.posters ?? []);
  const posters = {
    findAll: postersFindAll,
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<IPosterRepository>;

  const formats = {
    findAll: jest.fn(),
    findAllForBooking: jest.fn().mockResolvedValue(options.formats ?? []),
    findById: jest.fn(),
    findByName: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<IFormatRepository>;

  const partners = {
    findAll: jest.fn().mockResolvedValue(options.partners ?? []),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateOrder: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<IPartnerRepository>;

  const imageStorage = {
    resolveResponsiveVariants: jest
      .fn()
      .mockImplementation((url: string) => Promise.resolve(options.variants?.[url] ?? {})),
  };

  const service = new SiteContentService(
    siteContent,
    posters,
    formats,
    partners,
    imageStorage as unknown as ImageStorage
  );

  return { siteContent, imageStorage, service, mocks: { postersFindAll, siteContentUpsert } };
}

beforeEach(() => {
  jest.clearAllMocks();
  redisMock.get.mockResolvedValue(null);
  redisMock.del.mockResolvedValue(1);
  delete process.env.SITE_SSR_URL;
});

describe('SiteContentService.getPublicPayload — content merge', () => {
  it('keys saved sections by id and ignores rows the frontend does not know', async () => {
    const { service } = build({
      content: [
        { section: 'hero', value: { title: 'ВГУЛ' }, updatedAt: UPDATED },
        { section: 'seo', value: { title: 'Кавер-группа' }, updatedAt: UPDATED },
        { section: 'legacyBlock', value: { x: 1 }, updatedAt: new Date('2030-01-01') },
      ] as SiteContent[],
    });

    const payload = await service.getPublicPayload();

    expect(payload.content).toEqual({
      hero: { title: 'ВГУЛ' },
      seo: { title: 'Кавер-группа' },
    });
    // неизвестная секция не влияет и на updatedAt
    expect(payload.updatedAt).toBe(UPDATED.toISOString());
  });

  it('returns an empty payload when nothing has been saved yet', async () => {
    const { service } = build({});
    const payload = await service.getPublicPayload();

    expect(payload).toEqual({
      content: {},
      events: [],
      formats: [],
      partners: [],
      updatedAt: null,
    });
  });

  it('reports the freshest updatedAt across content and collections', async () => {
    const newest = new Date('2026-09-21T23:00:00.000Z');
    const { service } = build({
      content: [{ section: 'hero', value: {}, updatedAt: UPDATED }] as SiteContent[],
      partners: [partner({ id: 'p1', name: 'Partner', updatedAt: newest })],
    });

    const payload = await service.getPublicPayload();
    expect(payload.updatedAt).toBe(newest.toISOString());
  });
});

describe('SiteContentService.getPublicPayload — events', () => {
  it('drops past events, keeps today and undated banners', async () => {
    const past = dayOffset(-1);
    const today = dayOffset(0);
    const future = dayOffset(30);

    const { service } = build({
      posters: [
        poster({ id: 'past', title: 'Вчера', eventDate: past.date }),
        poster({ id: 'future', title: 'Через месяц', eventDate: future.date }),
        poster({ id: 'undated', title: 'Бессрочный баннер' }),
        poster({ id: 'today', title: 'Сегодня', eventDate: today.date }),
      ],
    });

    const payload = await service.getPublicPayload();

    expect(payload.events.map((event) => event.id)).toEqual(['today', 'future', 'undated']);
    expect(payload.events[0].date).toBe(today.iso);
    expect(payload.events[2].date).toBeNull();
  });

  it('honours the admin order before the date', async () => {
    const soon = dayOffset(1);
    const later = dayOffset(10);

    const { service } = build({
      posters: [
        poster({ id: 'later-but-pinned', title: 'Закреплён', eventDate: later.date, order: 0 }),
        poster({ id: 'soon', title: 'Скоро', eventDate: soon.date, order: 1 }),
      ],
    });

    const payload = await service.getPublicPayload();
    expect(payload.events.map((event) => event.id)).toEqual(['later-but-pinned', 'soon']);
  });

  it('normalises empty strings to null', async () => {
    const { service } = build({
      posters: [poster({ id: 'e1', title: 'Событие', venue: '   ', description: '', link: '' })],
    });

    const [event] = (await service.getPublicPayload()).events;
    expect(event).toMatchObject({ venue: null, description: null, link: null, image: null });
  });
});

describe('SiteContentService.getPublicPayload — images', () => {
  it('drops data: URIs instead of shipping base64 blobs', async () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    const { service, imageStorage } = build({
      posters: [poster({ id: 'p', title: 'Афиша', imageUrl: dataUri })],
      formats: [format({ id: 'f', name: 'Свадьба', imageUrl: ' DATA:image/png;base64,AAAA ' })],
      partners: [partner({ id: 'pa', name: 'Партнёр', logoUrl: dataUri })],
    });

    const payload = await service.getPublicPayload();

    expect(payload.events[0].image).toBeNull();
    expect(payload.formats[0].image).toBeNull();
    expect(payload.partners[0].logo).toBeNull();
    expect(imageStorage.resolveResponsiveVariants).not.toHaveBeenCalled();
  });

  it('derives srcSets for uploads that have responsive variants', async () => {
    const url = '/uploads/original/1758000000000-ab12cd.jpg';
    const { service } = build({
      formats: [format({ id: 'f', name: 'Корпоратив', imageUrl: url })],
      variants: {
        [url]: {
          webpSrcSet: '/uploads/webp/1758000000000-ab12cd-480.webp 480w',
          avifSrcSet: '/uploads/avif/1758000000000-ab12cd-480.avif 480w',
        },
      },
    });

    const payload = await service.getPublicPayload();
    expect(payload.formats[0].image).toEqual({
      src: url,
      webpSrcSet: '/uploads/webp/1758000000000-ab12cd-480.webp 480w',
      avifSrcSet: '/uploads/avif/1758000000000-ab12cd-480.avif 480w',
    });
  });

  it('falls back to a bare src when no variant exists', async () => {
    const url = 'https://cdn.example.com/logo.png';
    const { service } = build({ partners: [partner({ id: 'pa', name: 'X', logoUrl: url })] });

    const payload = await service.getPublicPayload();
    expect(payload.partners[0].logo).toEqual({ src: url });
  });
});

describe('SiteContentService caching', () => {
  it('serves the cached copy without touching the database', async () => {
    const cached = {
      content: { hero: { title: 'из кеша' } },
      events: [],
      formats: [],
      partners: [],
      updatedAt: null,
    };
    redisMock.get.mockResolvedValueOnce(JSON.stringify(cached));

    const { service, mocks } = build({});
    await expect(service.getPublicPayload()).resolves.toEqual(cached);
    expect(mocks.postersFindAll).not.toHaveBeenCalled();
  });

  it('falls back to the database when redis is unavailable', async () => {
    redisMock.get.mockRejectedValue(new Error('redis down'));
    redisMock.setex.mockRejectedValue(new Error('redis down'));

    const { service } = build({
      content: [
        { section: 'hero', value: { title: 'из БД' }, updatedAt: UPDATED },
      ] as SiteContent[],
    });

    await expect(service.getPublicPayload()).resolves.toMatchObject({
      content: { hero: { title: 'из БД' } },
    });
  });
});

describe('SiteContentService admin operations', () => {
  it('returns only known sections with the freshest updatedAt', async () => {
    const newer = new Date('2026-09-21T12:00:00.000Z');
    const { service } = build({
      content: [
        { section: 'hero', value: { title: 'a' }, updatedAt: UPDATED },
        { section: 'footer', value: { title: 'b' }, updatedAt: newer },
        { section: 'nope', value: {}, updatedAt: new Date('2031-01-01') },
      ] as SiteContent[],
    });

    await expect(service.getAdminContent()).resolves.toEqual({
      content: { hero: { title: 'a' }, footer: { title: 'b' } },
      updatedAt: newer.toISOString(),
    });
  });

  it('upserts the section and invalidates the public cache', async () => {
    const { service, mocks } = build({});
    mocks.siteContentUpsert.mockResolvedValue({
      section: 'hero',
      value: { title: 'x' },
      updatedAt: UPDATED,
    } as SiteContent);

    const result = await service.saveSection('hero', { title: 'x' });

    expect(mocks.siteContentUpsert).toHaveBeenCalledWith('hero', { title: 'x' });
    expect(redisMock.del).toHaveBeenCalledWith(CACHE_KEYS.SITE_PUBLIC);
    expect(result).toEqual({ section: 'hero', updatedAt: UPDATED.toISOString() });
  });
});
