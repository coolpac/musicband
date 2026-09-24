import { createHash, randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { SiteContentService } from '../../domain/services/SiteContentService';
import { SiteBookingService } from '../../domain/services/SiteBookingService';
import { SiteBookingSchema } from '../../application/dto/site.dto';
import { getTodayDateString } from '../../shared/utils/timezone';
import { logger } from '../../shared/utils/logger';

/** Сколько браузер/CDN может держать ответ, не переспрашивая (ETag закрывает остальное). */
const PUBLIC_MAX_AGE_SECONDS = 30;

/**
 * Минимальное время заполнения формы. Всё, что быстрее, — бот:
 * человек не успевает прочитать три шага и ввести телефон за 2.5 секунды.
 */
const MIN_FILL_MS = 2500;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class PublicSiteController {
  constructor(
    private siteContentService: SiteContentService,
    private siteBookingService: SiteBookingService
  ) {}

  /**
   * GET /api/public/site
   * Весь контент лендинга одним запросом: секции + афиша + форматы + партнёры.
   */
  async getSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = await this.siteContentService.getPublicPayload();
      const body = { success: true, data: payload };
      const etag = weakEtag(JSON.stringify(body));

      res.setHeader('Cache-Control', `public, max-age=${PUBLIC_MAX_AGE_SECONDS}`);
      res.setHeader('ETag', etag);
      // Именно vary(), а не setHeader(): cors() уже записал сюда Origin, и затирать его нельзя.
      // Ответ помечен как public — общий кеш иначе отдал бы чужой Access-Control-Allow-Origin.
      res.vary('Accept-Encoding');

      if (etagMatches(req.headers['if-none-match'], etag)) {
        res.status(304).end();
        return;
      }

      res.json(body);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/public/site/bookings
   * Заявка с сайта: без авторизации, с honeypot и минимальным временем заполнения.
   */
  async createBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const raw: Record<string, unknown> =
        typeof req.body === 'object' && req.body !== null
          ? (req.body as Record<string, unknown>)
          : {};

      // Ловушки проверяются ДО схемы: иначе бот с заполненным honeypot получал бы 422
      // за какое-нибудь другое поле и сразу понимал бы, что его ловят.
      const honeypot = raw.website !== undefined && raw.website !== null && raw.website !== '';
      const tooFast = typeof raw.elapsedMs === 'number' && raw.elapsedMs < MIN_FILL_MS;

      if (honeypot || tooFast) {
        logger.warn('Website booking rejected by spam trap', {
          ip: req.ip,
          honeypot,
          // Только число: иначе бот залил бы в лог строку на несколько мегабайт
          elapsedMs: typeof raw.elapsedMs === 'number' ? raw.elapsedMs : null,
        });
        res.status(201).json({
          success: true,
          data: {
            id: randomUUID(),
            bookingDate: echoDate(raw.bookingDate),
            bookingTime: echoTime(raw.bookingTime),
          },
        });
        return;
      }

      const parsed = SiteBookingSchema.safeParse(raw);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.errors) {
          const key = issue.path.join('.') || 'form';
          if (!(key in fields)) fields[key] = issue.message;
        }
        sendValidationError(res, fields);
        return;
      }

      const result = await this.siteBookingService.createBooking(parsed.data);

      if (result.status === 'invalid') {
        sendValidationError(res, result.fields);
        return;
      }

      if (result.status === 'unavailable') {
        res.status(409).json({
          success: false,
          error: {
            message: 'Эта дата уже занята. Выберите другую.',
            code: 'DATE_UNAVAILABLE',
          },
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          id: result.id,
          bookingDate: result.bookingDate,
          bookingTime: result.bookingTime,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

/**
 * Ответ-обманка для бота повторяет присланные значения, если они похожи на настоящие,
 * — иначе она отличалась бы от настоящего 201 и снова выдала бы ловушку.
 */
function echoDate(value: unknown): string {
  return typeof value === 'string' && DATE_PATTERN.test(value) ? value : getTodayDateString();
}

function echoTime(value: unknown): string | null {
  return typeof value === 'string' && TIME_PATTERN.test(value) ? value : null;
}

function sendValidationError(res: Response, fields: Record<string, string>): void {
  res.status(422).json({
    success: false,
    error: {
      message: 'Проверьте заполнение формы',
      code: 'VALIDATION',
      /** Карта «поле → сообщение» для подсветки инпутов */
      fields,
      /** Тот же список массивом — формат, который отдаёт validate()-middleware */
      errors: Object.entries(fields).map(([path, message]) => ({ path, message })),
    },
  });
}

/** Слабый ETag: тело собирается заново на каждый запрос, побайтовое равенство не гарантируем. */
function weakEtag(body: string): string {
  return `W/"${createHash('sha1').update(body).digest('base64url')}"`;
}

/** If-None-Match может прийти списком и с префиксом W/ — сравниваем по «слабому» правилу. */
function etagMatches(header: string | string[] | undefined, etag: string): boolean {
  if (!header) return false;
  const raw = Array.isArray(header) ? header.join(',') : header;
  const normalize = (value: string) => value.trim().replace(/^W\//, '');
  const target = normalize(etag);
  return raw.split(',').some((candidate) => {
    const normalized = normalize(candidate);
    return normalized === '*' || normalized === target;
  });
}
