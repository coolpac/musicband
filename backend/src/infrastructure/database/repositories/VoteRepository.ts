import { PrismaClient, Vote, VotingSession } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IVoteRepository {
  // Votes
  create(data: CreateVoteData): Promise<Vote>;
  findByUserAndSession(userId: string, sessionId: string): Promise<Vote | null>;
  findBySession(sessionId: string): Promise<Vote[]>;
  countBySong(songId: string, sessionId: string): Promise<number>;
  getResults(sessionId: string): Promise<VoteResult[]>;

  // Voting Sessions (start/end делаются в VoteService через prisma.$transaction)
  findActiveSession(): Promise<VotingSession | null>;
  findSessionById(id: string): Promise<VotingSession | null>;
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

  /**
   * Получение результатов голосования
   *
   * ОПТИМИЗАЦИЯ: Использует SQL aggregation вместо загрузки всех голосов в память
   *
   * БЫЛО (Memory Leak):
   * - Загружает 10,000 Vote объектов в память (~5 MB)
   * - Обрабатывает в JavaScript коде
   * - При 100 одновременных запросах = 500 MB!
   *
   * СТАЛО (Optimized):
   * - SQL делает aggregation на уровне БД
   * - Возвращает только N результатов (обычно 5-10 песен)
   * - Экономия памяти: -99%
   */
  async getResults(sessionId: string): Promise<VoteResult[]> {
    // SQL GROUP BY aggregation - считает на уровне БД
    const aggregatedResults = await this.client.vote.groupBy({
      by: ['songId'],
      where: { sessionId },
      _count: {
        id: true, // Количество голосов за каждую песню
      },
    });

    if (aggregatedResults.length === 0) {
      return [];
    }

    // Подсчет общего количества голосов
    const totalVotes = aggregatedResults.reduce(
      (sum, result) => sum + result._count.id,
      0
    );

    // Формируем результаты с процентами
    const results: VoteResult[] = aggregatedResults.map((result) => ({
      songId: result.songId,
      votes: result._count.id,
      percentage: Math.round((result._count.id / totalVotes) * 100 * 100) / 100,
    }));

    // Сортируем по количеству голосов (от большего к меньшему)
    return results.sort((a, b) => b.votes - a.votes);
  }

  // Voting Sessions
  async findActiveSession(): Promise<VotingSession | null> {
    return this.client.votingSession.findFirst({
      where: { isActive: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  /** Сессия без подгрузки голосов — для getSessionInfo, socket, admin (результаты берутся отдельно через getResults). */
  async findSessionById(id: string): Promise<VotingSession | null> {
    return this.client.votingSession.findUnique({
      where: { id },
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
