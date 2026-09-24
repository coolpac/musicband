import { Prisma } from '@prisma/client';
import { ISiteContentRepository } from '../../infrastructure/database/repositories/SiteContentRepository';
import { IPosterRepository } from '../../infrastructure/database/repositories/PosterRepository';
import { IFormatRepository } from '../../infrastructure/database/repositories/FormatRepository';
import { IPartnerRepository } from '../../infrastructure/database/repositories/PartnerRepository';
import { ImageStorage } from '../../infrastructure/storage/ImageStorage';
import { invalidatePublicSiteCache } from '../../infrastructure/site/siteCache';
import {
  RemoteImage,
  SiteApiPayload,
  SiteEvent,
  SiteFormat,
  SitePartner,
  SiteSectionId,
  isSiteSectionId,
} from '../../application/dto/site.dto';
import { CacheService, CACHE_KEYS } from '../../shared/utils/cache';
import { CACHE_TTL } from '../../shared/constants';
import { formatDateInTimezone, getTodayDateString } from '../../shared/utils/timezone';
import { logger } from '../../shared/utils/logger';

/** Что отдаёт админке GET /api/admin/site/content. */
export interface AdminSiteContent {
  content: Record<string, unknown>;
  updatedAt: string | null;
}

export class SiteContentService {
  constructor(
    private siteContentRepository: ISiteContentRepository,
    private posterRepository: IPosterRepository,
    private formatRepository: IFormatRepository,
    private partnerRepository: IPartnerRepository,
    private imageStorage: ImageStorage
  ) {}

  /**
   * Агрегированные данные публичного сайта: контент секций + общие коллекции.
   *
   * Кешируется в Redis на CACHE_TTL.SITE_PUBLIC под одним ключом.
   * CacheService глотает ошибки Redis и возвращает null, поэтому при недоступном
   * Redis запрос просто идёт в БД — ответ деградирует по скорости, но не по коду.
   */
  async getPublicPayload(): Promise<SiteApiPayload> {
    return CacheService.getOrSet(
      CACHE_KEYS.SITE_PUBLIC,
      () => this.buildPublicPayload(),
      CACHE_TTL.SITE_PUBLIC
    );
  }

  async getAdminContent(): Promise<AdminSiteContent> {
    const rows = await this.siteContentRepository.findAll();

    const content: Record<string, unknown> = {};
    let updatedAt: Date | null = null;

    for (const row of rows) {
      if (!isSiteSectionId(row.section)) {
        // Строка от старой/будущей версии схемы: не показываем, но и не роняем админку
        logger.warn('Unknown site content section in DB, skipped', { section: row.section });
        continue;
      }
      content[row.section] = row.value;
      if (!updatedAt || row.updatedAt > updatedAt) updatedAt = row.updatedAt;
    }

    return { content, updatedAt: updatedAt ? updatedAt.toISOString() : null };
  }

  /**
   * Сохранение одной секции. Значение уже проверено (`validateSectionBody`).
   * После записи — инвалидация публичного кеша и best-effort purge SSR-сервера.
   */
  async saveSection(
    section: SiteSectionId,
    value: Record<string, unknown>
  ): Promise<{ section: SiteSectionId; updatedAt: string }> {
    const saved = await this.siteContentRepository.upsert(section, value as Prisma.InputJsonValue);

    logger.info('Site content section saved', { section });
    await invalidatePublicSiteCache();

    return { section, updatedAt: saved.updatedAt.toISOString() };
  }

  /* ──────────────────────────────── внутреннее ──────────────────────────────── */

  private async buildPublicPayload(): Promise<SiteApiPayload> {
    const [contentRows, posters, formats, partners] = await Promise.all([
      this.siteContentRepository.findAll(),
      this.posterRepository.findAll(),
      this.formatRepository.findAllForBooking(),
      this.partnerRepository.findAll(),
    ]);

    // updatedAt ответа = самая свежая правка среди контента и коллекций
    const timestamps: number[] = [];

    const content: Record<string, unknown> = {};
    for (const row of contentRows) {
      if (!isSiteSectionId(row.section)) continue;
      content[row.section] = row.value;
      timestamps.push(row.updatedAt.getTime());
    }

    const today = getTodayDateString();

    // Афиша: прошедшие события не показываем, «бессрочные» баннеры (без даты) оставляем
    const upcoming = posters
      .map((poster, index) => ({
        poster,
        index,
        date: poster.eventDate ? formatDateInTimezone(poster.eventDate, 'UTC') : null,
      }))
      .filter((row) => row.date === null || row.date >= today)
      .sort((a, b) => {
        if (a.poster.order !== b.poster.order) return a.poster.order - b.poster.order;
        // Датированные — по возрастанию даты, «бессрочные» — в хвост
        if (a.date && b.date)
          return a.date === b.date ? a.index - b.index : a.date < b.date ? -1 : 1;
        if (a.date) return -1;
        if (b.date) return 1;
        return a.index - b.index;
      });

    for (const row of [...posters, ...formats, ...partners]) {
      timestamps.push(row.updatedAt.getTime());
    }

    const [events, siteFormats, sitePartners] = await Promise.all([
      Promise.all(
        upcoming.map(async ({ poster, date }): Promise<SiteEvent> => {
          return {
            id: poster.id,
            title: poster.title,
            date,
            venue: emptyToNull(poster.venue),
            description: emptyToNull(poster.description),
            image: await this.toRemoteImage(poster.imageUrl),
            link: emptyToNull(poster.link),
          };
        })
      ),
      Promise.all(
        formats.map(async (format): Promise<SiteFormat> => {
          return {
            id: format.id,
            name: format.name,
            shortDescription: emptyToNull(format.shortDescription),
            image: await this.toRemoteImage(format.imageUrl),
          };
        })
      ),
      Promise.all(
        partners.map(async (partner): Promise<SitePartner> => {
          return {
            id: partner.id,
            name: partner.name,
            logo: await this.toRemoteImage(partner.logoUrl),
            link: emptyToNull(partner.link),
          };
        })
      ),
    ]);

    return {
      content,
      events,
      formats: siteFormats,
      partners: sitePartners,
      updatedAt: timestamps.length
        ? new Date(timestamps.reduce((a, b) => (a > b ? a : b))).toISOString()
        : null,
    };
  }

  /**
   * URL из админки → RemoteImage для `<Picture>`.
   *
   * `data:`-URI обрезаются в null: это может быть мегабайт base64, который иначе
   * поехал бы в каждый ответ API и в каждый SSR-рендер. `null` для фронтенда
   * означает «покажи картинку, вшитую в бандл».
   */
  private async toRemoteImage(url: string | null): Promise<RemoteImage | null> {
    const src = url?.trim();
    if (!src) return null;
    if (/^data:/i.test(src)) return null;

    const variants = await this.imageStorage.resolveResponsiveVariants(src);
    return { src, ...variants };
  }
}

function emptyToNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
