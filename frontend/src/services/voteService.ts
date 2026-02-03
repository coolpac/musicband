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
 * Cast a vote for a song
 */
export async function castVote(songId: string): Promise<void> {
  if (isMockMode()) {
    // [Mock] Casting vote for song
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }

  try {
    await apiPost<void>('/api/votes', { songId });
  } catch (error) {
    console.error('Failed to cast vote:', error);
    throw error;
  }
}

/**
 * Get current user's vote in active session
 */
export async function getMyVote(): Promise<MyVoteResponse> {
  return apiGet<MyVoteResponse>('/api/votes/my');
}
