const notifyNewBookingToAllAdmins = jest.fn().mockResolvedValue(undefined);
const getBotManager = jest.fn();

jest.mock('../../../infrastructure/telegram/botManager', () => ({
  getBotManager: () => getBotManager() as unknown,
}));

import { Format } from '@prisma/client';
import { SiteBookingService } from '../SiteBookingService';
import { BookingService, CreateBookingOutcome } from '../BookingService';
import {
  BookingWithUserAndFormat,
  CreateBookingData,
} from '../../../infrastructure/database/repositories/BookingRepository';
import { IFormatRepository } from '../../../infrastructure/database/repositories/FormatRepository';
import { SiteBookingDto } from '../../../application/dto/site.dto';

const FORMAT_ID = '11111111-2222-3333-4444-555555555555';

function baseInput(overrides: Partial<SiteBookingDto> = {}): SiteBookingDto {
  return {
    bookingDate: '2026-12-31',
    fullName: 'Иван Петров',
    phone: '+7 (922) 750-12-34',
    consent: true,
    elapsedMs: 9000,
    ...overrides,
  };
}

interface Harness {
  service: SiteBookingService;
  tryCreateBooking: jest.Mock<Promise<CreateBookingOutcome>, [CreateBookingData]>;
  findFormatById: jest.Mock;
}

function build(options: { outcome?: CreateBookingOutcome; format?: Format | null } = {}): Harness {
  const created: CreateBookingOutcome = {
    status: 'created',
    booking: {
      id: 'booking-1',
      bookingDate: new Date('2026-12-31T00:00:00.000Z'),
      bookingTime: null,
      fullName: 'Иван Петров',
      contactValue: '+79227501234',
      email: null,
      comment: null,
      city: null,
      user: null,
      format: null,
    } as unknown as BookingWithUserAndFormat,
  };

  const tryCreateBooking = jest
    .fn<Promise<CreateBookingOutcome>, [CreateBookingData]>()
    .mockResolvedValue(options.outcome ?? created);

  const findFormatById = jest.fn().mockResolvedValue(options.format ?? null);

  const bookingService = { tryCreateBooking } as unknown as BookingService;
  const formatRepository = { findById: findFormatById } as unknown as IFormatRepository;

  return {
    service: new SiteBookingService(bookingService, formatRepository),
    tryCreateBooking,
    findFormatById,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getBotManager.mockReturnValue({ notifyNewBookingToAllAdmins });
});

describe('SiteBookingService — phone normalisation', () => {
  it.each([
    ['+7 (922) 750-12-34', '+79227501234'],
    ['8 922 750 12 34', '+79227501234'],
    ['79227501234', '+79227501234'],
    ['9227501234', '+79227501234'],
    ['+7-351-700-00-00', '+73517000000'],
  ])('normalises %s to %s', async (input, expected) => {
    const { service, tryCreateBooking } = build();

    const result = await service.createBooking(baseInput({ phone: input }));

    expect(result.status).toBe('created');
    expect(tryCreateBooking).toHaveBeenCalledWith(
      expect.objectContaining({ contactValue: expected, contactType: 'phone' })
    );
  });

  it.each(['12345', '+1 202 555 0143', '922750123', 'телефон', '+7 122 750 12 34'])(
    'rejects %s with a field error',
    async (phone) => {
      const { service, tryCreateBooking } = build();

      const result = await service.createBooking(baseInput({ phone }));

      expect(result).toEqual({ status: 'invalid', fields: { phone: expect.any(String) } });
      expect(tryCreateBooking).not.toHaveBeenCalled();
    }
  );
});

describe('SiteBookingService — field validation', () => {
  it('rejects a calendar date that does not exist', async () => {
    const { service, tryCreateBooking } = build();

    const result = await service.createBooking(baseInput({ bookingDate: '2026-02-31' }));

    expect(result).toMatchObject({ status: 'invalid' });
    expect(tryCreateBooking).not.toHaveBeenCalled();
  });

  it('rejects an unknown formatId and reports the field', async () => {
    const { service, tryCreateBooking, findFormatById } = build({ format: null });

    const result = await service.createBooking(baseInput({ formatId: FORMAT_ID }));

    expect(findFormatById).toHaveBeenCalledWith(FORMAT_ID);
    expect(result).toEqual({ status: 'invalid', fields: { formatId: expect.any(String) } });
    expect(tryCreateBooking).not.toHaveBeenCalled();
  });

  it('accepts a known formatId', async () => {
    const { service, tryCreateBooking } = build({ format: { id: FORMAT_ID } as Format });

    const result = await service.createBooking(baseInput({ formatId: FORMAT_ID }));

    expect(result.status).toBe('created');
    expect(tryCreateBooking).toHaveBeenCalledWith(expect.objectContaining({ formatId: FORMAT_ID }));
  });

  it('collects every bad field at once', async () => {
    const { service } = build();

    const result = await service.createBooking(
      baseInput({ phone: 'нет', bookingDate: '2026-13-01', fullName: ' я ' })
    );

    expect(result).toMatchObject({ status: 'invalid' });
    if (result.status === 'invalid') {
      expect(Object.keys(result.fields).sort()).toEqual(['bookingDate', 'fullName', 'phone']);
    }
  });
});

describe('SiteBookingService — sanitising and persistence', () => {
  it('stores the booking as an anonymous website lead', async () => {
    const { service, tryCreateBooking } = build();

    await service.createBooking(
      baseInput({
        bookingTime: '19:30',
        email: '  IVAN@Example.COM ',
        city: ' Челябинск ',
        comment: 'Первая строка\n\n\n\nВторая',
      })
    );

    expect(tryCreateBooking).toHaveBeenCalledWith({
      userId: null,
      formatId: undefined,
      bookingDate: new Date('2026-12-31T00:00:00.000Z'),
      bookingTime: '19:30',
      fullName: 'Иван Петров',
      contactType: 'phone',
      contactValue: '+79227501234',
      email: 'ivan@example.com',
      comment: 'Первая строка\n\nВторая',
      city: 'Челябинск',
      origin: 'website',
    });
  });

  it('strips control characters from free text', async () => {
    const { service, tryCreateBooking } = build();

    const NUL = String.fromCharCode(0);
    const BEL = String.fromCharCode(7);
    const SOH = String.fromCharCode(1);

    await service.createBooking(
      baseInput({ fullName: `Иван${NUL}${BEL} Петров`, comment: `а${SOH}б` })
    );

    const data = tryCreateBooking.mock.calls[0][0];
    expect(data.fullName).toBe('Иван Петров');
    expect(data.comment).toBe('аб');
  });

  it('turns blank optional fields into undefined', async () => {
    const { service, tryCreateBooking } = build();

    await service.createBooking(baseInput({ bookingTime: '', email: '', city: '', comment: '' }));

    const data = tryCreateBooking.mock.calls[0][0];
    expect(data.bookingTime).toBeUndefined();
    expect(data.email).toBeUndefined();
    expect(data.city).toBeUndefined();
    expect(data.comment).toBeUndefined();
  });

  it.each<CreateBookingOutcome>([{ status: 'blocked' }, { status: 'full' }])(
    'maps %p to "unavailable"',
    async (outcome) => {
      const { service } = build({ outcome });

      await expect(service.createBooking(baseInput())).resolves.toEqual({ status: 'unavailable' });
    }
  );
});

describe('SiteBookingService — admin notification', () => {
  it('marks the message as coming from the website', async () => {
    const { service } = build();

    await service.createBooking(baseInput());
    await Promise.resolve();

    expect(notifyNewBookingToAllAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'website', id: 'booking-1', bookingDate: '2026-12-31' })
    );
  });

  it('still succeeds when telegram fails', async () => {
    notifyNewBookingToAllAdmins.mockRejectedValueOnce(new Error('telegram is down'));
    const { service } = build();

    await expect(service.createBooking(baseInput())).resolves.toMatchObject({ status: 'created' });
  });

  it('still succeeds when the bot manager is not initialised', async () => {
    getBotManager.mockReturnValue(undefined);
    const { service } = build();

    await expect(service.createBooking(baseInput())).resolves.toMatchObject({ status: 'created' });
    expect(notifyNewBookingToAllAdmins).not.toHaveBeenCalled();
  });
});
