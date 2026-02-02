import { IVoteRepository } from '../../infrastructure/database/repositories/VoteRepository';
import { ISongRepository } from '../../infrastructure/database/repositories/SongRepository';
import { IUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import { redis } from '../../config/redis';
import { CacheService, CACHE_KEYS } from '../../shared/utils/cache';
import { CACHE_TTL } from '../../shared/constants';
import { prisma } from '../../config/database';
import type { VotingSession } from '@prisma/client';

export class VoteService {
  constructor(
    private voteRepository: IVoteRepository,
    private songRepository: ISongRepository,
    private userRepository: IUserRepository
  ) {}

  /**
   * Создание голоса
   */
  async castVote(userId: string, songId: string): Promise<void> {
    // Проверяем пользователя
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Проверяем песню
    const song = await this.songRepository.findById(songId);
    if (!song) {
      throw new NotFoundError('Song');
    }

    if (!song.isActive) {
      throw new ValidationError('Song is not active for voting');
    }

    // Получаем активную сессию
    const session = await this.voteRepository.findActiveSession();
    if (!session) {
      throw new ValidationError('No active voting session');
    }

    // Проверяем, не голосовал ли уже пользователь
    const existingVote = await this.voteRepository.findByUserAndSession(userId, session.id);
    if (existingVote) {
      throw new ConflictError('User has already voted in this session');
    }

    // Создаем голос
    await this.voteRepository.create({
      userId,
      songId,
      sessionId: session.id,
    });

    // Обновляем счетчик в Redis
    await redis.incr(`votes:session:${session.id}:song:${songId}`);
    await redis.sadd(`votes:session:${session.id}:voters`, userId);

    // Инвалидируем кеш результатов
    await this.invalidateResultsCache(session.id);

    logger.info('Vote cast', {
      userId,
      songId,
      sessionId: session.id,
    });
  }

  /**
   * Получение результатов голосования (с кешированием)
   */
  async getResults(sessionId?: string) {
    let session;

    if (sessionId) {
      session = await this.voteRepository.findSessionById(sessionId);
      if (!session) {
        throw new NotFoundError('Voting session');
      }
    } else {
      session = await this.voteRepository.findActiveSession();
      if (!session) {
        return {
          sessionId: null,
          songs: [],
          totalVotes: 0,
        };
      }
    }

    // Пытаемся получить из кеша
    const cacheKey = CACHE_KEYS.VOTE_RESULTS(session.id);
    const cached = await CacheService.get<{
      sessionId: string;
      songs: Array<{ song: { id: string; title: string; artist: string; coverUrl: string | null } | null; votes: number; percentage: number }>;
      totalVotes: number;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    // Если нет в кеше, получаем из БД
    const results = await this.voteRepository.getResults(session.id);
    const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

    // Получаем информацию о песнях (оптимизированно - один запрос вместо N)
    const songIds = results.map((r) => r.songId);
    const songs = await this.songRepository.findByIds(songIds);

    // Создаем Map для быстрого доступа
    const songsMap = new Map(songs.map((s) => [s.id, s]));

    // Собираем результаты с деталями песен
    const songsWithDetails = results.map((result) => {
      const song = songsMap.get(result.songId);
      return {
        song: song
          ? {
              id: song.id,
              title: song.title,
              artist: song.artist,
              coverUrl: song.coverUrl,
            }
          : null,
        votes: result.votes,
        percentage: result.percentage,
      };
    });

    const response = {
      sessionId: session.id,
      songs: songsWithDetails.filter((s) => s.song !== null),
      totalVotes,
    };

    // Сохраняем в кеш на короткое время
    await CacheService.set(cacheKey, response, CACHE_TTL.VOTE_RESULTS);

    return response;
  }

  /**
   * Инвалидация кеша результатов голосования
   */
  private async invalidateResultsCache(sessionId: string): Promise<void> {
    await CacheService.invalidate(CACHE_KEYS.VOTE_RESULTS(sessionId));
  }

  /**
   * Получение голоса пользователя
   */
  async getUserVote(userId: string) {
    const session = await this.voteRepository.findActiveSession();
    if (!session) {
      return { votedSongId: null };
    }

    const vote = await this.voteRepository.findByUserAndSession(userId, session.id);
    return {
      votedSongId: vote?.songId || null,
    };
  }

  /**
   * Получение активной сессии (публичный метод для внешнего доступа)
   */
  async getActiveSession() {
    return this.voteRepository.findActiveSession();
  }

  /**
   * Получение сессии по ID (публичный метод для внешнего доступа)
   */
  async getSessionById(sessionId: string) {
    return this.voteRepository.findSessionById(sessionId);
  }

  /**
   * Получение истории сессий (публичный метод для внешнего доступа)
   */
  async getSessionHistory(page: number, limit: number) {
    return this.voteRepository.getSessionHistory(page, limit);
  }

  /**
   * Запуск новой сессии голосования
   * Активирует только те песни, которые админ включил в сессию
   *
   * ВАЖНО: Использует DATABASE TRANSACTION для атомарности операций
   * Если любая операция упадет - все изменения откатятся автоматически
   */
  async startSession(songIds: string[]): Promise<VotingSession> {
    if (songIds.length === 0) {
      throw new ValidationError('At least one song is required');
    }

    // Проверяем, что все песни существуют (BATCH запрос вместо N+1)
    const songs = await this.songRepository.findByIds(songIds);
    if (songs.length !== songIds.length) {
      throw new NotFoundError('Some songs not found');
    }

    // Проверяем, нет ли уже активной сессии
    const activeSession = await this.voteRepository.findActiveSession();
    if (activeSession) {
      throw new ValidationError('There is already an active voting session. End it first.');
    }

    // TRANSACTION: Все операции выполняются атомарно
    // Либо ВСЕ успешно, либо ВСЁ откатывается
    const session = await prisma.$transaction(async (tx) => {
      // 1. Деактивируем старые активные песни
      await tx.song.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      // 2. Создаем новую сессию голосования
      const newSession = await tx.votingSession.create({
        data: {
          isActive: true,
          totalVoters: 0,
        },
      });

      // 3. Активируем выбранные админом песни
      await tx.song.updateMany({
        where: { id: { in: songIds } },
        data: { isActive: true },
      });

      logger.info('Voting session started (transaction committed)', {
        sessionId: newSession.id,
        songIds,
        songsCount: songIds.length,
      });

      return newSession;
    });

    return session;
  }

  /**
   * Завершение сессии голосования
   *
   * ВАЖНО: Использует DATABASE TRANSACTION
   * Порядок операций критичен - сначала получаем результаты, потом удаляем данные
   */
  async endSession(sessionId: string) {
    const session = await this.voteRepository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundError('Voting session');
    }

    if (!session.isActive) {
      throw new ValidationError('Session is already ended');
    }

    // Получаем финальные результаты ДО удаления
    const results = await this.voteRepository.getResults(sessionId);

    // Получаем список песен для деактивации
    const votes = await this.voteRepository.findBySession(sessionId);
    const songIds = [...new Set(votes.map((v) => v.songId))];

    // Собираем telegramId всех проголосовавших (ДО deleteMany в транзакции)
    const uniqueUserIds = [...new Set(votes.map((v) => v.userId))];
    const voterTelegramIds =
      uniqueUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: uniqueUserIds } },
            select: { telegramId: true },
          })
        : [];

    // Победитель — песня с максимумом голосов (results уже отсортированы по votes DESC)
    const winningSongId = results.length > 0 ? results[0].songId : null;

    // TRANSACTION: Завершаем сессию + деактивируем песни + удаляем голоса атомарно
    const endedSession = await prisma.$transaction(async (tx) => {
      // 1. Завершаем сессию (устанавливаем isActive = false, победитель, expiresAt)
      const updated = await tx.votingSession.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          endedAt: new Date(),
          totalVoters: votes.length, // Сохраняем финальное кол-во голосов
          winningSongId,
          expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 часов
        },
      });

      // 2. Деактивируем все песни из сессии
      if (songIds.length > 0) {
        await tx.song.updateMany({
          where: { id: { in: songIds } },
          data: { isActive: false },
        });
      }

      // 3. Удаляем голоса (по архитектуре - они временные)
      await tx.vote.deleteMany({
        where: { sessionId },
      });

      return updated;
    });

    // Полные данные победителя для ответа
    let winningSong = null;
    if (winningSongId) {
      winningSong = await this.songRepository.findById(winningSongId);
    }

    // Очищаем Redis кеш (вне транзакции - не критично если упадет)
    try {
      await CacheService.delPattern(`votes:session:${sessionId}:*`);
      logger.debug('Vote session cache cleared', { sessionId });
    } catch (error) {
      logger.warn('Failed to clear vote session cache', { sessionId, error });
    }

    logger.info('Voting session ended', {
      sessionId,
      totalVoters: endedSession.totalVoters,
    });

    return {
      session: endedSession,
      finalResults: results,
      totalVoters: endedSession.totalVoters,
      winningSong: winningSong
        ? {
            id: winningSong.id,
            title: winningSong.title,
            artist: winningSong.artist,
            coverUrl: winningSong.coverUrl,
          }
        : null,
      voterTelegramIds: voterTelegramIds.map((u) => u.telegramId),
    };
  }
}
