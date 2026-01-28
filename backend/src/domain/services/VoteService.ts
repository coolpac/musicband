import { IVoteRepository } from '../../infrastructure/database/repositories/VoteRepository';
import { ISongRepository } from '../../infrastructure/database/repositories/SongRepository';
import { IUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import { redis } from '../../config/redis';
import { CacheService, CACHE_KEYS } from '../../shared/utils/cache';
import { CACHE_TTL } from '../../shared/constants';

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

    // Получаем информацию о песнях
    const songsWithDetails = await Promise.all(
      results.map(async (result) => {
        const song = await this.songRepository.findById(result.songId);
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
      })
    );

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
   */
  async startSession(songIds: string[]): Promise<ReturnType<IVoteRepository['createSession']>> {
    if (songIds.length === 0) {
      throw new ValidationError('At least one song is required');
    }

    // Проверяем, что все песни существуют
    const songs = await Promise.all(songIds.map((id) => this.songRepository.findById(id)));
    const missingSongs = songs.filter((s) => !s);
    if (missingSongs.length > 0) {
      throw new NotFoundError('Some songs not found');
    }

    // Проверяем, нет ли уже активной сессии
    const activeSession = await this.voteRepository.findActiveSession();
    if (activeSession) {
      throw new ValidationError('There is already an active voting session. End it first.');
    }

    // Деактивируем все старые активные песни (от предыдущих сессий)
    const oldActiveSongs = await this.songRepository.findActive();
    await Promise.all(
      oldActiveSongs.map((song) => this.songRepository.update(song.id, { isActive: false }))
    );

    // Создаем сессию
    const session = await this.voteRepository.createSession();

    // Активируем только те песни, которые админ включил в сессию
    await Promise.all(songIds.map((id) => this.songRepository.update(id, { isActive: true })));

    logger.info('Voting session started', {
      sessionId: session.id,
      songIds,
      songsCount: songIds.length,
    });

    return session;
  }

  /**
   * Завершение сессии голосования
   */
  async endSession(sessionId: string) {
    const session = await this.voteRepository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundError('Voting session');
    }

    if (!session.isActive) {
      throw new ValidationError('Session is already ended');
    }

    // Получаем финальные результаты
    const results = await this.voteRepository.getResults(sessionId);

    // Завершаем сессию
    const endedSession = await this.voteRepository.endSession(sessionId);

    // Деактивируем все песни
    const votes = await this.voteRepository.findBySession(sessionId);
    const songIds = [...new Set(votes.map((v) => v.songId))];
    await Promise.all(songIds.map((id) => this.songRepository.update(id, { isActive: false })));

    // Удаляем голоса (согласно архитектуре)
    await this.voteRepository.deleteBySession(sessionId);

    // Очищаем Redis кеш
    await redis.del(`votes:session:${sessionId}:song:*`);
    await redis.del(`votes:session:${sessionId}:voters`);

    logger.info('Voting session ended', {
      sessionId,
      totalVoters: endedSession.totalVoters,
    });

    return {
      session: endedSession,
      finalResults: results,
      totalVoters: endedSession.totalVoters,
    };
  }
}
