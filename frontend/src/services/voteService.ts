import { apiGet, apiPost, isMockMode } from './apiClient';

export type VoteResult = {
  songId: string;
  voteCount: number;
  percentage: number;
};

type VoteResultsApiResponse = {
  sessionId: string | null;
  songs: Array<{
    song: { id: string; title?: string; artist?: string; coverUrl?: string | null } | null;
    votes: number;
    percentage: number;
  }>;
  totalVotes: number;
};

export type MyVoteResponse = {
  votedSongId: string | null;
};

// Mock data - will be replaced with real voting results
const mockResults: VoteResult[] = [
  { songId: '1', voteCount: 142, percentage: 35 },
  { songId: '2', voteCount: 98, percentage: 24 },
  { songId: '3', voteCount: 76, percentage: 19 },
  { songId: '4', voteCount: 54, percentage: 13 },
  { songId: '5', voteCount: 36, percentage: 9 },
];

/**
 * Get voting results
 */
export async function getVoteResults(): Promise<VoteResult[]> {
  if (isMockMode()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockResults;
  }

  const data = await apiGet<VoteResultsApiResponse>('/api/votes/results');
  const songs = data?.songs ?? [];
  return songs
    .filter((s) => Boolean(s.song?.id))
    .map((s) => ({
      songId: s.song!.id,
      voteCount: s.votes,
      percentage: s.percentage,
    }));
}

/**
 * Cast a vote for a song (требует авторизации).
 */
export async function castVote(songId: string): Promise<void> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }
  await apiPost<void>('/api/votes', { songId });
}

/**
 * Голосование с initData (проверка Admin/User Bot). Возвращает JWT для сокета.
 */
export async function castVoteWithInitData(
  songId: string,
  initData: string,
  sessionId?: string
): Promise<{ token: string; sessionId: string }> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { token: 'mock', sessionId: 'mock' };
  }
  const res = await apiPost<{ sessionId: string; token: string }>('/api/public/vote/with-initdata', {
    initData,
    songId,
    ...(sessionId ? { sessionId } : {}),
  });
  return { token: res.token, sessionId: res.sessionId };
}

/**
 * Fallback: голосование по telegramId без initData. POST /api/public/vote.
 */
export async function castVotePublic(
  songId: string,
  telegramId: number,
  sessionId?: string
): Promise<void> {
  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }
  await apiPost<{ data: { sessionId: string } }>('/api/public/vote', {
    songId,
    telegramId,
    ...(sessionId ? { sessionId } : {}),
  });
}

/**
 * Get current user's vote in active session
 */
export async function getMyVote(): Promise<MyVoteResponse> {
  return apiGet<MyVoteResponse>('/api/votes/my');
}

export type VoteSessionStatus = 'active' | 'ended_with_winner' | 'ended' | 'expired';

export type VoteSessionInfo = {
  status: VoteSessionStatus;
  winningSong?: { id: string; title: string; artist: string; coverUrl: string | null };
};

/** Информация о сессии голосования (публичный эндпоинт, не требует auth) */
export async function getVoteSessionInfo(sessionId: string): Promise<VoteSessionInfo | null> {
  if (isMockMode()) return null;
  try {
    const base = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${base}/api/public/vote/session/${sessionId}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success || !data?.data) return null;
    return {
      status: data.data.status,
      winningSong: data.data.winningSong,
    };
  } catch {
    return null;
  }
}
