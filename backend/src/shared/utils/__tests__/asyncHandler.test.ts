import { asyncHandler, runAsync } from '../asyncHandler';

describe('asyncHandler', () => {
  it('передаёт результат успешного handler в res', async () => {
    const mockReq = {};
    const mockJson = jest.fn();
    const mockRes = { json: mockJson, status: jest.fn().mockReturnThis() };
    const mockNext = jest.fn();

    const handler = asyncHandler((_req, res) => {
      res.json({ ok: true });
    });

    handler(mockReq as never, mockRes as never, mockNext as never);

    await new Promise((r) => setTimeout(r, 0));

    expect(mockJson).toHaveBeenCalledWith({ ok: true });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('вызывает next() при ошибке в handler', async () => {
    const mockReq = {};
    const mockRes = {};
    const mockNext = jest.fn();
    const error = new Error('test error');

    const handler = asyncHandler(async () => {
      await Promise.resolve();
      throw error;
    });

    handler(mockReq as never, mockRes as never, mockNext as never);

    await new Promise((r) => setTimeout(r, 0));

    expect(mockNext).toHaveBeenCalledWith(error);
  });
});

describe('runAsync', () => {
  it('запускает async функцию без возврата Promise', () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const wrapped = runAsync(fn);

    const result = wrapped();

    expect(result).toBeUndefined();
    expect(fn).toHaveBeenCalled();
  });
});
