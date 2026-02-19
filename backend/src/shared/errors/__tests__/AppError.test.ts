import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
} from '../AppError';

describe('AppError', () => {
  it('создаёт ошибку с message, statusCode, code', () => {
    const err = new AppError('Test', 418, 'CUSTOM');

    expect(err.message).toBe('Test');
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('CUSTOM');
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('NotFoundError', () => {
  it('создаёт 404 NOT_FOUND', () => {
    const err = new NotFoundError('User');

    expect(err.message).toBe('User not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('ValidationError', () => {
  it('создаёт 400 VALIDATION_ERROR', () => {
    const err = new ValidationError('Invalid input', [{ field: 'email' }]);

    expect(err.message).toBe('Invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.errors).toEqual([{ field: 'email' }]);
  });
});

describe('UnauthorizedError', () => {
  it('создаёт 401 UNAUTHORIZED с дефолтным сообщением', () => {
    const err = new UnauthorizedError();

    expect(err.message).toBe('Unauthorized');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });
});

describe('ForbiddenError', () => {
  it('создаёт 403 FORBIDDEN', () => {
    const err = new ForbiddenError('Access denied');

    expect(err.message).toBe('Access denied');
    expect(err.statusCode).toBe(403);
  });
});

describe('ConflictError', () => {
  it('создаёт 409 CONFLICT', () => {
    const err = new ConflictError('Duplicate entry');

    expect(err.message).toBe('Duplicate entry');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });
});

describe('RateLimitError', () => {
  it('создаёт 429 RATE_LIMIT_EXCEEDED', () => {
    const err = new RateLimitError();

    expect(err.message).toBe('Too many requests');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
