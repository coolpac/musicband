/**
 * Admin API for voting sessions (requires admin auth).
 */

import { apiGet, apiPost } from './apiClient';

export type VotingSessionListItem = {
  id: string;
  isActive: boolean;
  startedAt: string;
  endedAt?: string | null;
  totalVoters: number;
};

export type VotingSessionWithResults = {
  session: VotingSessionListItem;
  results: Array<{
    song: { id: string; title: string; artist: string; coverUrl: string | null } | null;
    votes: number;
    percentage: number;
  }>;
  totalVoters: number;
};

export type VoteStats = {
  totalVotes: number;
  activeSongs: number;
  totalVoters: number;
  results: Array<{
    song: { id: string; title: string; artist: string; coverUrl: string | null } | null;
    votes: number;
    percentage: number;
  }>;
};

export type StartSessionResponse = {
  session: VotingSessionListItem;
  qrCode: {
    dataURL: string;
    deepLink: string;
  };
};

export type HistoryResponse = {
  sessions: Array<{ id: string; startedAt: string; endedAt: string | null; totalVoters: number }>;
  total: number;
  page: number;
  limit: number;
};

const BASE = '/api/admin/votes';

export async function getActiveSession(): Promise<VotingSessionListItem | null> {
  const data = await apiGet<VotingSessionListItem[]>(`${BASE}/sessions?isActive=true`);
  return data?.[0] ?? null;
}

export async function getSessionById(id: string): Promise<VotingSessionWithResults | null> {
  try {
    return await apiGet<VotingSessionWithResults>(`${BASE}/sessions/${id}`);
  } catch {
    return null;
  }
}

export async function startSession(songIds: string[]): Promise<StartSessionResponse> {
  return apiPost<StartSessionResponse>(`${BASE}/sessions/start`, { songIds });
}

export async function endSession(id: string): Promise<unknown> {
  return apiPost<unknown>(`${BASE}/sessions/${id}/end`);
}

export async function getSessionQR(id: string): Promise<{ qrCode: { dataURL: string; deepLink: string } }> {
  const data = await apiGet<{ qrCode: { dataURL: string; deepLink: string } }>(`${BASE}/sessions/${id}/qr`);
  return data;
}

export async function getStats(sessionId?: string): Promise<VoteStats> {
  const url = sessionId ? `${BASE}/stats?sessionId=${encodeURIComponent(sessionId)}` : `${BASE}/stats`;
  return apiGet<VoteStats>(url);
}

export async function getHistory(page = 1, limit = 10): Promise<HistoryResponse> {
  return apiGet<HistoryResponse>(`${BASE}/history?page=${page}&limit=${limit}`);
}
