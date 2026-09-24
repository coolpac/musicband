import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// useVoteSubmit — pure-logic hook. Тестируем без @testing-library: мокаем
// react.useCallback в identity, чтобы вызвать фабрику хука вне React и получить
// саму функцию submit. Проверяем, что голосование работает на Max (через
// платформенный фасад), а не только на Telegram.

vi.mock('react', () => ({
  // useCallback(fn, deps) → fn: возвращаем колбэк как есть.
  useCallback: (fn: unknown) => fn,
}));

vi.mock('../../services/voteService', () => ({
  castVote: vi.fn(),
  castVotePublic: vi.fn(),
  castVoteWithInitData: vi.fn(),
  getMyVote: vi.fn(),
}));

vi.mock('../../platform/platform', () => ({
  getPlatform: vi.fn(),
  getInitData: vi.fn(),
  getUserId: vi.fn(),
  hapticNotification: vi.fn(),
  showAlert: vi.fn(),
}));

import { useVoteSubmit } from '../useVoteSubmit';
import * as voteService from '../../services/voteService';
import * as platform from '../../platform/platform';

const SONG = '11111111-1111-1111-1111-111111111111';
const SID = '22222222-2222-2222-2222-222222222222';

function buildSubmit(authToken: string | null) {
  const setAuthToken = vi.fn();
  const setCurrentScreen = vi.fn();
  const submit = useVoteSubmit({
    authToken,
    votingSessionId: SID,
    setAuthToken,
    setCurrentScreen,
  });
  return { submit, setAuthToken, setCurrentScreen };
}

beforeEach(() => {
  vi.clearAllMocks();
  // history.pushState вызывается в goToVotingResults — заглушим, чтобы не шуметь в jsdom.
  vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useVoteSubmit on Max', () => {
  it('uses authenticated castVote when a JWT is present (Max)', async () => {
    vi.mocked(platform.getPlatform).mockReturnValue('max');
    vi.mocked(voteService.castVote).mockResolvedValue(undefined);

    const { submit, setCurrentScreen } = buildSubmit('jwt-token');
    await submit(SONG);

    expect(voteService.castVote).toHaveBeenCalledWith(SONG);
    expect(voteService.castVotePublic).not.toHaveBeenCalled();
    expect(setCurrentScreen).toHaveBeenCalledWith('voting-results');
  });

  it('passes platform="max" to castVoteWithInitData when no JWT yet (Max)', async () => {
    vi.mocked(platform.getPlatform).mockReturnValue('max');
    vi.mocked(platform.getInitData).mockReturnValue('max-init-data');
    vi.mocked(voteService.castVoteWithInitData).mockResolvedValue({ token: 'new-jwt', sessionId: SID });

    const { submit, setAuthToken } = buildSubmit(null);
    await submit(SONG);

    expect(voteService.castVoteWithInitData).toHaveBeenCalledWith(SONG, 'max-init-data', SID, 'max');
    expect(setAuthToken).toHaveBeenCalledWith('new-jwt');
  });

  it('does NOT fall back to public-by-id on Max and shows a Max-specific message', async () => {
    vi.mocked(platform.getPlatform).mockReturnValue('max');
    vi.mocked(platform.getInitData).mockReturnValue(null);
    vi.mocked(platform.getUserId).mockReturnValue(null);

    const { submit } = buildSubmit(null);
    await submit(SONG);

    expect(voteService.castVotePublic).not.toHaveBeenCalled();
    expect(platform.showAlert).toHaveBeenCalledWith(expect.stringContaining('Max'));
  });
});

describe('useVoteSubmit on Telegram (regression — unchanged behavior)', () => {
  it('passes platform="telegram" to castVoteWithInitData when no JWT yet', async () => {
    vi.mocked(platform.getPlatform).mockReturnValue('telegram');
    vi.mocked(platform.getInitData).mockReturnValue('tg-init-data');
    vi.mocked(voteService.castVoteWithInitData).mockResolvedValue({ token: 'tg-jwt', sessionId: SID });

    const { submit } = buildSubmit(null);
    await submit(SONG);

    expect(voteService.castVoteWithInitData).toHaveBeenCalledWith(SONG, 'tg-init-data', SID, 'telegram');
  });

  it('uses public-by-id fallback on Telegram when initData is absent', async () => {
    vi.mocked(platform.getPlatform).mockReturnValue('telegram');
    vi.mocked(platform.getInitData).mockReturnValue(null);
    vi.mocked(platform.getUserId).mockReturnValue(123456);
    vi.mocked(voteService.castVotePublic).mockResolvedValue(undefined);

    const { submit } = buildSubmit(null);
    await submit(SONG);

    expect(voteService.castVotePublic).toHaveBeenCalledWith(SONG, 123456, SID);
  });
});
