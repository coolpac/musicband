import { Request, Response } from 'express';
import { PublicSiteController } from '../PublicSiteController';
import { SiteContentService } from '../../../domain/services/SiteContentService';
import { SiteBookingService, SiteBookingResult } from '../../../domain/services/SiteBookingService';
import { SiteApiPayload } from '../../../application/dto/site.dto';

interface FakeResponse {
  res: Response;
  status: jest.Mock;
  json: jest.Mock;
  end: jest.Mock;
  vary: jest.Mock;
  headers: Record<string, string>;
}

function fakeResponse(): FakeResponse {
  const headers: Record<string, string> = {};
  const json = jest.fn();
  const end = jest.fn();
  const status = jest.fn();
  // res.vary() у Express добавляет значение к уже существующему заголовку, не затирая его
  const vary = jest.fn((field: string) => {
    headers.Vary = headers.Vary ? `${headers.Vary}, ${field}` : field;
  });
  const res = {
    status,
    json,
    end,
    vary,
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  } as unknown as Response;
  status.mockReturnValue(res);
  return { res, status, json, end, vary, headers };
}

function fakeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return { body, headers, ip: '203.0.113.7' } as unknown as Request;
}

const EMPTY_PAYLOAD: SiteApiPayload = {
  content: { hero: { title: 'ВГУЛ' } },
  events: [],
  formats: [],
  partners: [],
  updatedAt: '2026-09-21T10:00:00.000Z',
};

function build(options: { payload?: SiteApiPayload; bookingResult?: SiteBookingResult } = {}) {
  const getPublicPayload = jest.fn().mockResolvedValue(options.payload ?? EMPTY_PAYLOAD);
  const createBooking = jest.fn().mockResolvedValue(
    options.bookingResult ?? {
      status: 'created',
      id: 'booking-1',
      bookingDate: '2026-12-31',
      bookingTime: '19:30',
    }
  );

  const controller = new PublicSiteController(
    { getPublicPayload } as unknown as SiteContentService,
    { createBooking } as unknown as SiteBookingService
  );

  return { controller, getPublicPayload, createBooking };
}

const next = jest.fn();

const validBody = {
  bookingDate: '2026-12-31',
  bookingTime: '19:30',
  fullName: 'Иван Петров',
  phone: '+79227501234',
  consent: true,
  website: '',
  elapsedMs: 9000,
};

beforeEach(() => jest.clearAllMocks());

describe('GET /api/public/site', () => {
  it('sets caching headers and a weak ETag', async () => {
    const { controller } = build();
    const { res, headers, json } = fakeResponse();

    await controller.getSite(fakeRequest(undefined), res, next);

    expect(headers['Cache-Control']).toBe('public, max-age=30');
    expect(headers.ETag).toMatch(/^W\/"[\w-]+"$/);
    expect(json).toHaveBeenCalledWith({ success: true, data: EMPTY_PAYLOAD });
    expect(next).not.toHaveBeenCalled();
  });

  it('appends to Vary instead of overwriting the Origin that cors() set', async () => {
    const { controller } = build();
    const { res, vary, headers } = fakeResponse();
    headers.Vary = 'Origin';

    await controller.getSite(fakeRequest(undefined), res, next);

    expect(vary).toHaveBeenCalledWith('Accept-Encoding');
    expect(headers.Vary).toBe('Origin, Accept-Encoding');
  });

  it('answers 304 when the client already has the same ETag', async () => {
    const { controller } = build();

    const first = fakeResponse();
    await controller.getSite(fakeRequest(undefined), first.res, next);
    const etag = first.headers.ETag;

    const second = fakeResponse();
    await controller.getSite(fakeRequest(undefined, { 'if-none-match': etag }), second.res, next);

    expect(second.status).toHaveBeenCalledWith(304);
    expect(second.end).toHaveBeenCalled();
    expect(second.json).not.toHaveBeenCalled();
  });

  it('matches an If-None-Match list and the strong form of the tag', async () => {
    const { controller } = build();
    const first = fakeResponse();
    await controller.getSite(fakeRequest(undefined), first.res, next);
    const strong = first.headers.ETag.replace('W/', '');

    const second = fakeResponse();
    await controller.getSite(
      fakeRequest(undefined, { 'if-none-match': `W/"other", ${strong}` }),
      second.res,
      next
    );

    expect(second.status).toHaveBeenCalledWith(304);
  });

  it('sends a fresh body when the ETag differs', async () => {
    const { controller } = build();
    const { res, status, json } = fakeResponse();

    await controller.getSite(fakeRequest(undefined, { 'if-none-match': 'W/"stale"' }), res, next);

    expect(status).not.toHaveBeenCalledWith(304);
    expect(json).toHaveBeenCalled();
  });

  it('forwards service failures to the error handler', async () => {
    const { controller, getPublicPayload } = build();
    getPublicPayload.mockRejectedValue(new Error('db down'));
    const { res } = fakeResponse();

    await controller.getSite(fakeRequest(undefined), res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('POST /api/public/site/bookings — spam traps', () => {
  it('pretends to succeed when the honeypot is filled', async () => {
    const { controller, createBooking } = build();
    const { res, status, json } = fakeResponse();

    await controller.createBooking(
      fakeRequest({ ...validBody, website: 'http://spam.example' }),
      res,
      next
    );

    expect(createBooking).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: { id: expect.any(String), bookingDate: '2026-12-31', bookingTime: '19:30' },
    });
  });

  it('pretends to succeed when the form was filled faster than a human could', async () => {
    const { controller, createBooking } = build();
    const { res, status } = fakeResponse();

    await controller.createBooking(fakeRequest({ ...validBody, elapsedMs: 800 }), res, next);

    expect(createBooking).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(201);
  });

  it('lets a submission through at exactly the threshold', async () => {
    const { controller, createBooking } = build();
    const { res } = fakeResponse();

    await controller.createBooking(fakeRequest({ ...validBody, elapsedMs: 2500 }), res, next);

    expect(createBooking).toHaveBeenCalled();
  });

  it('answers the honeypot before validation, so a bot never sees a 422', async () => {
    const { controller, createBooking } = build();
    const { res, status, json } = fakeResponse();

    // Тело бота: ловушка заполнена И согласия нет — но выдавать себя ответом нельзя
    await controller.createBooking(
      fakeRequest({ ...validBody, website: 'spam', consent: false, phone: '' }),
      res,
      next
    );

    expect(createBooking).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(201);
    expect(status).not.toHaveBeenCalledWith(422);
    expect(json.mock.calls[0][0]).toMatchObject({ success: true });
  });

  it('never echoes a bogus date back to a bot', async () => {
    const { controller } = build();
    const { res, json } = fakeResponse();

    await controller.createBooking(
      fakeRequest({ website: 'spam', bookingDate: '<script>', bookingTime: '99:99' }),
      res,
      next
    );

    const body = json.mock.calls[0][0] as { data: { bookingDate: string; bookingTime: null } };
    expect(body.data.bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.data.bookingTime).toBeNull();
  });
});

describe('POST /api/public/site/bookings — responses', () => {
  it('returns 422 with a field map when the body is malformed', async () => {
    const { controller, createBooking } = build();
    const { res, status, json } = fakeResponse();

    await controller.createBooking(
      fakeRequest({ ...validBody, consent: false, bookingDate: 'вчера' }),
      res,
      next
    );

    expect(createBooking).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(422);
    const body = json.mock.calls[0][0] as {
      error: { code: string; fields: Record<string, string> };
    };
    expect(body.error.code).toBe('VALIDATION');
    expect(Object.keys(body.error.fields).sort()).toEqual(['bookingDate', 'consent']);
  });

  it('returns 422 when the service reports bad fields', async () => {
    const { controller } = build({
      bookingResult: { status: 'invalid', fields: { phone: 'Введите российский номер телефона' } },
    });
    const { res, status, json } = fakeResponse();

    await controller.createBooking(fakeRequest(validBody), res, next);

    expect(status).toHaveBeenCalledWith(422);
    const body = json.mock.calls[0][0] as { error: { fields: Record<string, string> } };
    expect(body.error.fields.phone).toBeDefined();
  });

  it('returns 409 DATE_UNAVAILABLE when the date is taken', async () => {
    const { controller } = build({ bookingResult: { status: 'unavailable' } });
    const { res, status, json } = fakeResponse();

    await controller.createBooking(fakeRequest(validBody), res, next);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { message: expect.any(String), code: 'DATE_UNAVAILABLE' },
    });
  });

  it('returns 201 with the created booking', async () => {
    const { controller } = build();
    const { res, status, json } = fakeResponse();

    await controller.createBooking(fakeRequest(validBody), res, next);

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: { id: 'booking-1', bookingDate: '2026-12-31', bookingTime: '19:30' },
    });
  });
});
