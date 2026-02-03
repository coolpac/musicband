export type Song = {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  artistImageUrl?: string;
  isActive: boolean;
  orderIndex: number;
};

export type Vote = {
  id: string;
  userId: string;
  songId: string;
  sessionId: string;
  createdAt: string;
};

export type VotingSession = {
  id: string;
  startedAt: string;
  endedAt?: string;
  isActive: boolean;
  totalVoters: number;
};
