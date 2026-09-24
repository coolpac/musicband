import { SiteApiError, siteFetch } from '../content/api';
import { daysInMonth, makeDateKey, parseMonthKey, todayKey, type DateKey, type MonthKey } from './dates';
import type { SubmittedBooking } from './state';

/**
 * Availability + submit for the booking flow.
 *
 * `GET /api/bookings/available-dates?month=YYYY-MM` (BookingService.getAvailableDates) answers
 * `{ dates, blockedDates }` where:
 *   • `dates`        — days of that month that are >= today in the band's timezone AND not blocked,
 *                      i.e. exactly the bookable set. A past month therefore comes back empty.
 *   • `blockedDates` — every blocked day of the month, past ones included.
 * So a day is selectable iff it is in `dates`; anything else is either already past or taken, and
 * `blockedDates` only decides which of the two we tell the visitor.
 */

/** Same origin rule as content/api.ts: a public page never sends credentials or admin tokens. */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const SUBMIT_TIMEOUT_MS = 15000;
/**
 * Mirrors `MIN_FILL_MS` in backend/src/presentation/controllers/PublicSiteController.ts, plus a
 * small margin. The server treats a faster submit as a bot and answers a fabricated 201 without
 * saving anything, so the form must not let a genuine visitor cross that line — see submitBooking.
 */
const MIN_FILL_MS = 2600;

interface EnvelopeBody {
  success?: boolean;
  data?: unknown;
  message?: string;
  error?: { message?: unknown; code?: unknown; fields?: unknown } | string;
}

export interface MonthAvailability {
  available: ReadonlySet<DateKey>;
  blocked: ReadonlySet<DateKey>;
  /** true only for the dev-mode fallback below. Always false in a production bundle. */
  mock: boolean;
}

interface AvailableDatesResponse {
  dates?: unknown;
  blockedDates?: unknown;
}

/**
 * The backend keeps `available-dates` in Redis for 5 minutes, so anything older than that is
 * guesswork: a tab left open on the calendar for an hour would otherwise keep offering days the
 * admin has since blocked, and the visitor would only find out from a 409 after filling the form.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  value: MonthAvailability;
  at: number;
}

const cache = new Map<MonthKey, CacheEntry>();
const inFlight = new Map<MonthKey, Promise<MonthAvailability>>();

/** Never called during render — only from effects and event handlers. */
function readCache(month: MonthKey): MonthAvailability | undefined {
  const entry = cache.get(month);
  if (!entry) return undefined;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(month);
    return undefined;
  }
  return entry.value;
}

function writeCache(month: MonthKey, value: MonthAvailability): void {
  cache.set(month, { value, at: Date.now() });
}

function toKeySet(value: unknown): Set<DateKey> {
  if (!Array.isArray(value)) return new Set();
  const out = new Set<DateKey>();
  for (const item of value) {
    if (typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item)) out.add(item);
  }
  return out;
}

/**
 * Deterministic stand-in so the flow is demonstrable with no backend running.
 * Guarded by `import.meta.env.DEV` at every call site, so the bundler drops it from production.
 */
function mockAvailability(month: MonthKey): MonthAvailability {
  const parsed = parseMonthKey(month);
  const available = new Set<DateKey>();
  const blocked = new Set<DateKey>();
  if (parsed) {
    const today = todayKey();
    const total = daysInMonth(parsed.year, parsed.month0);
    for (let day = 1; day <= total; day += 1) {
      const key = makeDateKey(parsed.year, parsed.month0, day);
      if (key < today) continue;
      // No randomness: the same month always yields the same picture across reloads.
      if ((day * 3 + parsed.month0 * 5) % 11 < 2) blocked.add(key);
      else available.add(key);
    }
  }
  return { available, blocked, mock: true };
}

/** A failure the dev fallback is allowed to paper over: no server, or a broken one. */
function isServerDown(error: unknown): boolean {
  return error instanceof SiteApiError && (error.status === 0 || error.status >= 500);
}

export function getCachedAvailability(month: MonthKey): MonthAvailability | undefined {
  return readCache(month);
}

export function loadAvailability(month: MonthKey): Promise<MonthAvailability> {
  const cached = readCache(month);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(month);
  if (pending) return pending;

  const request = siteFetch<AvailableDatesResponse>(`/api/bookings/available-dates?month=${month}`)
    .then((payload): MonthAvailability => {
      const result: MonthAvailability = {
        available: toKeySet(payload?.dates),
        blocked: toKeySet(payload?.blockedDates),
        mock: false,
      };
      writeCache(month, result);
      return result;
    })
    .catch((error: unknown) => {
      if (import.meta.env.DEV && isServerDown(error)) {
        const result = mockAvailability(month);
        writeCache(month, result);
        return result;
      }
      throw error;
    })
    .finally(() => {
      inFlight.delete(month);
    });

  inFlight.set(month, request);
  return request;
}

/** Drop one month (after a 409) or the whole cache, so the next view refetches. */
export function invalidateAvailability(month?: MonthKey): void {
  if (month) cache.delete(month);
  else cache.clear();
}

/** Warm the next month while the visitor looks at this one. Failures are irrelevant here. */
export function prefetchAvailability(month: MonthKey): void {
  if (readCache(month) || inFlight.has(month)) return;
  void loadAvailability(month).catch(() => undefined);
}

/* ── submit ──────────────────────────────────────────────────── */

export interface BookingSubmission {
  bookingDate: DateKey;
  bookingTime?: string;
  fullName: string;
  phone: string;
  email?: string;
  city?: string;
  formatId?: string;
  comment?: string;
  consent: true;
  /** Honeypot: a real visitor never sees the input, so anything but '' is a bot. */
  website: string;
  /** How long the anketa was open before the submit — bots fill forms instantly. */
  elapsedMs: number;
}

interface CreatedBooking {
  id?: unknown;
  bookingDate?: unknown;
  bookingTime?: unknown;
}

export type SubmitFailureKind = 'dateUnavailable' | 'validation' | 'rateLimited' | 'network' | 'generic';

export class BookingSubmitError extends Error {
  constructor(
    readonly kind: SubmitFailureKind,
    message: string,
    /** 422 only: «field name → message», ready to hang under the matching input. */
    readonly fields: Readonly<Record<string, string>> = {}
  ) {
    super(message);
    this.name = 'BookingSubmitError';
  }
}

/** Tolerate a full ISO timestamp coming back where a calendar day was sent. */
function toDayString(value: unknown, fallback: DateKey): DateKey {
  if (typeof value !== 'string') return fallback;
  const head = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : fallback;
}

function classifyStatus(status: number): SubmitFailureKind {
  if (status === 409) return 'dateUnavailable';
  if (status === 429) return 'rateLimited';
  // PublicSiteController answers 422 with a field map; the shared handler answers 400 for a
  // ValidationError raised deeper in the stack. Both mean «the form is wrong».
  if (status === 400 || status === 422) return 'validation';
  if (status === 0 || status >= 500) return 'network';
  return 'generic';
}

function readFields(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {};
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(value as Record<string, unknown>)) {
    if (typeof message === 'string' && message.length > 0) out[key] = message;
  }
  return out;
}

/**
 * POST /api/public/site/bookings.
 *
 * Written against `fetch` rather than `siteFetch` for one reason: a 422 from this endpoint
 * carries `error.fields` («поле → сообщение»), and the shared helper throws that body away.
 * See the change request for `content/api.ts` — once SiteApiError exposes the details, this
 * collapses back into a `siteFetch` call.
 */
export async function submitBooking(payload: BookingSubmission): Promise<SubmittedBooking> {
  // PublicSiteController drops anything with elapsedMs < 2500 and answers a fabricated 201, so a
  // genuinely quick visitor would be told «Заявка принята!» while nothing reaches the admin. Hold
  // the request back until the trap is cleared instead — the button is already showing its spinner.
  const shortBy = Math.min(MIN_FILL_MS - payload.elapsedMs, MIN_FILL_MS);
  const wireBody = shortBy > 0 ? { ...payload, elapsedMs: payload.elapsedMs + shortBy } : payload;
  if (shortBy > 0) await new Promise<void>((resolve) => setTimeout(resolve, shortBy));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

  let status = 0;
  let body: EnvelopeBody | null = null;
  try {
    const response = await fetch(`${API_BASE}/api/public/site/bookings`, {
      method: 'POST',
      credentials: 'omit',
      signal: controller.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(wireBody),
    });
    status = response.status;
    body = (await response.json().catch(() => null)) as EnvelopeBody | null;
  } catch {
    status = 0;
  } finally {
    clearTimeout(timer);
  }

  const failed = status === 0 || status >= 400 || body?.success === false;
  if (!failed) {
    const created = (body && 'data' in body ? body.data : body) as CreatedBooking | null;
    return {
      id: typeof created?.id === 'string' ? created.id : payload.bookingDate,
      bookingDate: toDayString(created?.bookingDate, payload.bookingDate),
      bookingTime: typeof created?.bookingTime === 'string' ? created.bookingTime : (payload.bookingTime ?? null),
    };
  }

  const kind = classifyStatus(status);

  if (import.meta.env.DEV && kind === 'network') {
    return {
      id: `dev-${payload.bookingDate}`,
      bookingDate: payload.bookingDate,
      bookingTime: payload.bookingTime ?? null,
      mock: true,
    };
  }

  const error = typeof body?.error === 'object' && body.error !== null ? body.error : null;
  const message =
    (typeof error?.message === 'string' ? error.message : undefined) ??
    (typeof body?.message === 'string' ? body.message : undefined) ??
    (status === 0 ? 'Нет соединения с сервером.' : `HTTP ${status}`);

  if (kind === 'dateUnavailable') invalidateAvailability(payload.bookingDate.slice(0, 7));
  throw new BookingSubmitError(kind, message, readFields(error?.fields));
}
