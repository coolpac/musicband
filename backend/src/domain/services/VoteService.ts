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
  async castVote(userId: string, songId: string, targetSessionId?: string): Promise<string> {
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

    // Получаем сессию: по ID (если передан) или активную
    const session = targetSessionId
      ? await this.voteRepository.findSessionById(targetSessionId)
      : await this.voteRepository.findActiveSession();
    if (!session) {
      throw new ValidationError(targetSessionId ? 'Session not found' : 'No active voting session');
    }
    if (!session.isActive) {
      throw new ValidationError('Voting session is not active');
    }

    // Проверяем, не голосовал ли уже пользователь
    const existingVote = await this.voteRepository.findByUserAndSession(userId, session.id);
    if (existingVote) {
      throw new ConflictError('User has already voted in this session');
    }

    // Создаем голос
    try {
      await this.voteRepository.create({
        userId,
        songId,
        sessionId: session.id,
      });
    } catch (error: unknown) {
      // Race-condition / double submit: Prisma unique constraint (P2002)
      const prismaError = error as { code?: string };
      if (prismaError?.code === 'P2002') {
        throw new ConflictError('User has already voted in this session');
      }
      throw error;
    }

    // Обновляем счетчик в Redis
    // Не делаем Redis критичным: если Redis временно недоступен, голос уже записан в БД.
    try {
      await redis.incr(`votes:session:${session.id}:song:${songId}`);
      await redis.sadd(`votes:session:${session.id}:voters`, userId);
    } catch (error) {
      logger.warn('Failed to update vote counters in Redis (non-critical)', {
        error,
        sessionId: session.id,
        songId,
        userId,
      });
    }

    // Инвалидируем кеш результатов
    await this.invalidateResultsCache(session.id);

    logger.info('Vote cast', {
      userId,
      songId,
      sessionId: session.id,
    });

    return session.id;
  }

  /**
   * Временное решение: голосование по telegramId без проверки initData.
   * Находит или создаёт пользователя по telegramId, затем создаёт голос.
   * Небезопасно: telegramId можно подставить с другого устройства.
   */
  async castVoteByTelegramId(
    telegramId: number,
    songId: string,
    sessionId?: string
  ): Promise<string> {
    const tid = BigInt(telegramId);
    const { user, created } = await this.userRepository.findOrCreateByTelegramId({
      telegramId: tid,
      role: 'user',
    });
    if (created) {
      logger.info('User created from public vote (telegramId)', { userId: user.id, telegramId });
    }

    const session = sessionId
      ? await this.voteRepository.findSessionById(sessionId)
      : await this.voteRepository.findActiveSession();
    if (!session) {
      throw new ValidationError(sessionId ? 'Session not found' : 'No active voting session');
    }
    if (!session.isActive) {
      throw new ValidationError('Voting session is not active');
    }

    const song = await this.songRepository.findById(songId);
    if (!song) throw new NotFoundError('Song');
    if (!song.isActive) throw new ValidationError('Song is not active for voting');

    const existingVote = await this.voteRepository.findByUserAndSession(user.id, session.id);
    if (existingVote) {
      throw new ConflictError('User has already voted in this session');
    }

    try {
      await this.voteRepository.create({
        userId: user.id,
        songId,
        sessionId: session.id,
      });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError?.code === 'P2002') {
        throw new ConflictError('User has already voted in this session');
      }
      throw error;
    }

    try {
      await redis.incr(`votes:session:${session.id}:song:${songId}`);
      await redis.sadd(`votes:session:${session.id}:voters`, user.id);
    } catch (error) {
      logger.warn('Failed to update vote counters in Redis (non-critical)', {
        error,
        sessionId: session.id,
        songId,
      });
    }

    await this.invalidateResultsCache(session.id);
    logger.info('Vote cast (by telegramId)', {
      telegramId,
      userId: user.id,
      songId,
      sessionId: session.id,
    });
    return session.id;
  }

  /**
   * Получение результатов голосования (с кешированием)
   * Для завершённых сессий — возвращает сохранённый JSON-снимок.
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

    // Завершённая сессия — отдаём сохранённый снимок результатов
    if (!session.isActive && session.finalResults) {
      const stored = session.finalResults as {
        sessionId: string;
        songs: Array<{
          song: { id: string; title: string; artist: string; coverUrl: string | null } | null;
          votes: number;
          percentage: number;
        }>;
        totalVotes: number;
      };
      return stored;
    }

    // Пытаемся получить из кеша
    const cacheKey = CACHE_KEYS.VOTE_RESULTS(session.id);
    const cached = await CacheService.get<{
      sessionId: string;
      songs: Array<{
        song: { id: string; title: string; artist: string; coverUrl: string | null } | null;
        votes: number;
        percentage: number;
      }>;
      totalVotes: number;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    // Если нет в кеше, получаем из БД
    const results = await this.voteRepository.getResults(session.id);
    const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

    // Получаем ВСЕ активные песни (чтобы песни с 0 голосов тоже показывались)
    const allActiveSongs = await this.songRepository.findActive();

    // Map голосов по songId для быстрого доступа
    const votesMap = new Map(results.map((r) => [r.songId, r]));

    // Собираем результаты: все активные песни + их голоса (0 если не голосовали)
    const songsWithDetails = allActiveSongs.map((song) => {
      const result = votesMap.get(song.id);
      return {
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          coverUrl: song.coverUrl,
        },
        votes: result?.votes ?? 0,
        percentage: result?.percentage ?? 0,
      };
    });

    // Сортируем по голосам (больше → первее)
    songsWithDetails.sort((a, b) => b.votes - a.votes);

    const response = {
      sessionId: session.id,
      songs: songsWithDetails,
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

    // Получаем ВСЕ активные песни (включая те, за которые никто не голосовал)
    const activeSongs = await this.songRepository.findActive();
    const allActiveSongIds = activeSongs.map((s) => s.id);

    // Получаем голоса для подсчёта уникальных voters и telegramId
    const votes = await this.voteRepository.findBySession(sessionId);

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

    // Формируем JSON-снимок результатов (сохраняется в VotingSession, т.к. голоса удаляются)
    const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
    const votesMap = new Map(results.map((r) => [r.songId, r]));
    const finalResultsSnapshot = {
      sessionId,
      songs: activeSongs.map((song) => {
        const result = votesMap.get(song.id);
        return {
          song: { id: song.id, title: song.title, artist: song.artist, coverUrl: song.coverUrl },
          votes: result?.votes ?? 0,
          percentage: result?.percentage ?? 0,
        };
      }).sort((a, b) => b.votes - a.votes),
      totalVotes,
    };

    // TRANSACTION: Завершаем сессию + деактивируем песни + удаляем голоса атомарно
    const endedSession = await prisma.$transaction(async (tx) => {
      // 1. Завершаем сессию (isActive = false, победитель, expiresAt, снимок результатов)
      const updated = await tx.votingSession.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          endedAt: new Date(),
          totalVoters: votes.length,
          winningSongId,
          expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 часов
          finalResults: finalResultsSnapshot,
        },
      });

      // 2. Деактивируем ВСЕ активные песни (включая с 0 голосов)
      if (allActiveSongIds.length > 0) {
        await tx.song.updateMany({
          where: { id: { in: allActiveSongIds } },
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

    // Планируем рассылки по челябинскому времени (UTC+5):
    // Первое сообщение — в 18:00, второе — в 20:00
    if (voterTelegramIds.length > 0) {
      const telegramIds = voterTelegramIds.map((u) => u.telegramId.toString());

      const CHELYABINSK_OFFSET = 5; // UTC+5
      const now = new Date();

      // Базовая дата — сегодня в UTC
      const baseDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      ));

      // 18:00 Челябинск = 13:00 UTC
      const day1At = new Date(baseDate.getTime() + (18 - CHELYABINSK_OFFSET) * 60 * 60 * 1000);
      // Если 18:00 уже прошло — переносим на завтра
      if (day1At.getTime() <= now.getTime()) {
        day1At.setTime(day1At.getTime() + 24 * 60 * 60 * 1000);
      }

      // 20:00 Челябинск = 15:00 UTC
      const day2At = new Date(baseDate.getTime() + (20 - CHELYABINSK_OFFSET) * 60 * 60 * 1000);
      // Если 20:00 уже прошло — переносим на завтра
      if (day2At.getTime() <= now.getTime()) {
        day2At.setTime(day2At.getTime() + 24 * 60 * 60 * 1000);
      }

      await prisma.votingFollowUp.create({
        data: {
          sessionId,
          telegramIds,
          campaignDay: 1,
          scheduledAt: day1At,
        },
      });

      await prisma.votingFollowUp.create({
        data: {
          sessionId,
          telegramIds,
          campaignDay: 2,
          scheduledAt: day2At,
        },
      });

      logger.info('Voting follow-ups scheduled (18:00 + 20:00 Chelyabinsk)', {
        sessionId,
        voterCount: voterTelegramIds.length,
        day1At: day1At.toISOString(),
        day2At: day2At.toISOString(),
      });
    }

    logger.info('Voting session ended', {
      sessionId,
      totalVoters: endedSession.totalVoters,
    });

    return {
      session: endedSession,
      finalResults: results,
      finalResultsSnapshot,
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
