import { useCallback } from 'react';
import { hapticNotification, showAlert, getUserId, getInitData, getPlatform } from '../platform/platform';
import { castVote, castVotePublic, castVoteWithInitData, getMyVote } from '../services/voteService';
import { ApiError } from '../services/apiClient';

/** Навигация на экран результатов после успешного голоса */
function goToVotingResults(
  setCurrentScreen: (s: string) => void,
  sessionId?: string | null
): void {
  hapticNotification('success');
  setCurrentScreen('voting-results');
  const qs = sessionId ? `?screen=voting-results&sessionId=${sessionId}` : '?screen=voting-results';
  window.history.pushState({}, '', qs);
}

type UseVoteSubmitParams = {
  authToken: string | null;
  votingSessionId: string | null;
  setAuthToken: (t: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setCurrentScreen: (s: any) => void;
};

/**
 * Хук для обработки отправки голоса с fallback-цепочкой:
 * 1. initData (если нет JWT) → JWT + голос
 * 2. castVote (если есть JWT)
 * 3. castVotePublic (telegramId) — fallback
 */
export function useVoteSubmit({
  authToken,
  votingSessionId,
  setAuthToken,
  setCurrentScreen,
}: UseVoteSubmitParams): (songId: string) => Promise<void> {
  const sid = votingSessionId || undefined;

  const tryPublicVote = useCallback(
    async (songId: string): Promise<boolean> => {
      // Публичный fallback по id поддержан только для Telegram: бэкенд создаёт
      // пользователя как telegram-идентичность, поэтому Max-id сюда слать нельзя.
      if (getPlatform() !== 'telegram') return false;
      const userId = getUserId();
      if (userId == null) return false;
      try {
        await castVotePublic(songId, userId, sid);
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 409) return true;
        return false;
      }
    },
    [sid]
  );

  const tryInitDataVote = useCallback(
    async (songId: string): Promise<{ token: string; sessionId: string } | null> => {
      const initData = getInitData();
      if (!initData) return null;
      try {
        return await castVoteWithInitData(songId, initData, sid, getPlatform() === 'max' ? 'max' : 'telegram');
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 409) {
          goToVotingResults(setCurrentScreen, votingSessionId);
          return { token: '', sessionId: votingSessionId || '' };
        }
        console.warn('castVoteWithInitData failed:', err);
        return null;
      }
    },
    [sid, votingSessionId, setCurrentScreen]
  );

  return useCallback(
    async (songId: string) => {
      if (!authToken) {
        const result = await tryInitDataVote(songId);
        if (result?.token) {
          localStorage.setItem('auth_token', result.token);
          setAuthToken(result.token);
          goToVotingResults(setCurrentScreen, result.sessionId || votingSessionId);
          return;
        }
        if (result !== null) return;
        const ok = await tryPublicVote(songId);
        if (ok) {
          goToVotingResults(setCurrentScreen, votingSessionId);
          return;
        }
        hapticNotification('error');
        if (getUserId() == null) {
          const where = getPlatform() === 'max' ? 'Max' : 'Telegram';
          showAlert(`Откройте приложение через ${where}, чтобы проголосовать.`);
        } else {
          showAlert('Не удалось отправить голос. Попробуйте ещё раз.');
        }
        return;
      }

      try {
        await castVote(songId);
        goToVotingResults(setCurrentScreen, votingSessionId);
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) {
          const result = await tryInitDataVote(songId);
          if (result?.token) {
            localStorage.setItem('auth_token', result.token);
            setAuthToken(result.token);
            goToVotingResults(setCurrentScreen, result.sessionId || votingSessionId);
            return;
          }
          const ok = await tryPublicVote(songId);
          if (ok) {
            goToVotingResults(setCurrentScreen, votingSessionId);
            return;
          }
          localStorage.removeItem('auth_token');
          setAuthToken(null);
          hapticNotification('error');
          showAlert('Сессия истекла. Попробуйте проголосовать ещё раз.');
          return;
        }
        if (error instanceof ApiError && error.statusCode === 409) {
          goToVotingResults(setCurrentScreen, votingSessionId);
          return;
        }
        const ok = await tryPublicVote(songId);
        if (ok) {
          goToVotingResults(setCurrentScreen, votingSessionId);
          return;
        }
        try {
          const mine = await getMyVote();
          if (mine?.votedSongId) {
            goToVotingResults(setCurrentScreen, votingSessionId);
            return;
          }
        } catch (e) {
          console.warn('Failed to verify my vote after error:', e);
        }
        hapticNotification('error');
        showAlert('Не удалось отправить голос. Попробуйте ещё раз.');
      }
    },
    [
      authToken,
      votingSessionId,
      setAuthToken,
      setCurrentScreen,
      tryPublicVote,
      tryInitDataVote,
    ]
  );
}
