import { useCallback } from 'react';
import { hapticNotification, showAlert, getTelegramUserId, getTelegramWebApp } from '../telegram/telegramWebApp';
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
  setCurrentScreen: (s: string) => void;
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
      const telegramId = getTelegramUserId();
      if (telegramId == null) return false;
      try {
        await castVotePublic(songId, telegramId, sid);
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
      const initData = getTelegramWebApp()?.initData;
      if (!initData) return null;
      try {
        return await castVoteWithInitData(songId, initData, sid);
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
        if (getTelegramUserId() == null) {
          hapticNotification('error');
          showAlert('Откройте приложение через Telegram, чтобы проголосовать.');
        } else {
          hapticNotification('error');
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
