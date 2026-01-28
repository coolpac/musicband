import { PrismaClient, Vote, VotingSession } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IVoteRepository {
  // Votes
  create(data: CreateVoteData): Promise<Vote>;
  findByUserAndSession(userId: string, sessionId: string): Promise<Vote | null>;
  findBySession(sessionId: string): Promise<Vote[]>;
  countBySong(songId: string, sessionId: string): Promise<number>;
  getResults(sessionId: string): Promise<VoteResult[]>;
  deleteBySession(sessionId: string): Promise<void>;

  // Voting Sessions
  createSession(): Promise<VotingSession>;
  findActiveSession(): Promise<VotingSession | null>;
  findSessionById(id: string): Promise<VotingSession | null>;
  endSession(id: string): Promise<VotingSession>;
  getSessionHistory(page: number, limit: number): Promise<{ sessions: VotingSession[]; total: number }>;
}

export interface CreateVoteData {
  userId: string;
  songId: string;
  sessionId: string;
}

export interface VoteResult {
  songId: string;
  votes: number;
  percentage: number;
}

export class PrismaVoteRepository implements IVoteRepository {
  constructor(private client: PrismaClient = prisma) {}

  // Votes
  async create(data: CreateVoteData): Promise<Vote> {
    return this.client.vote.create({
      data: {
        userId: data.userId,
        songId: data.songId,
        sessionId: data.sessionId,
      },
    });
  }

  async findByUserAndSession(userId: string, sessionId: string): Promise<Vote | null> {
    return this.client.vote.findFirst({
      where: {
        userId,
        sessionId,
      },
    });
  }

  async findBySession(sessionId: string): Promise<Vote[]> {
    return this.client.vote.findMany({
      where: { sessionId },
      include: {
        user: true,
        song: true,
      },
    });
  }

  async countBySong(songId: string, sessionId: string): Promise<number> {
    return this.client.vote.count({
      where: {
        songId,
        sessionId,
      },
    });
  }

  async getResults(sessionId: string): Promise<VoteResult[]> {
    const votes = await this.findBySession(sessionId);
    const totalVotes = votes.length;

    if (totalVotes === 0) {
      return [];
    }

    // Группируем по песням
    const songVotes = new Map<string, number>();
    votes.forEach((vote) => {
      const count = songVotes.get(vote.songId) || 0;
      songVotes.set(vote.songId, count + 1);
    });

    // Формируем результаты с процентами
    const results: VoteResult[] = [];
    songVotes.forEach((votes, songId) => {
      results.push({
        songId,
        votes,
        percentage: Math.round((votes / totalVotes) * 100 * 100) / 100,
      });
    });

    return results.sort((a, b) => b.votes - a.votes);
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await this.client.vote.deleteMany({
      where: { sessionId },
    });
  }

  // Voting Sessions
  async createSession(): Promise<VotingSession> {
    // Закрываем все активные сессии
    await this.client.votingSession.updateMany({
      where: { isActive: true },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });

    return this.client.votingSession.create({
      data: {
        isActive: true,
      },
    });
  }

  async findActiveSession(): Promise<VotingSession | null> {
    return this.client.votingSession.findFirst({
      where: { isActive: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findSessionById(id: string): Promise<VotingSession | null> {
    return this.client.votingSession.findUnique({
      where: { id },
      include: {
        votes: {
          include: {
            song: true,
            user: true,
          },
        },
      },
    });
  }

  async endSession(id: string): Promise<VotingSession> {
    // Подсчитываем уникальных голосовавших
    const uniqueVoters = await this.client.vote.groupBy({
      by: ['userId'],
      where: { sessionId: id },
    });

    return this.client.votingSession.update({
      where: { id },
      data: {
        isActive: false,
        endedAt: new Date(),
        totalVoters: uniqueVoters.length,
      },
    });
  }

  async getSessionHistory(page: number, limit: number): Promise<{ sessions: VotingSession[]; total: number }> {
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      this.client.votingSession.findMany({
        where: { isActive: false },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.client.votingSession.count({
        where: { isActive: false },
      }),
    ]);

    return { sessions, total };
  }
}
