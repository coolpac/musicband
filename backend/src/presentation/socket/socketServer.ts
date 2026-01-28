import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from '../../config/redis';
import { logger } from '../../shared/utils/logger';
import { AuthService } from '../../domain/services/AuthService';
import { VoteService } from '../../domain/services/VoteService';
import { SongService } from '../../domain/services/SongService';
import { UnauthorizedError } from '../../shared/errors';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export class SocketServer {
  private io: SocketIOServer;
  private voteService: VoteService;
  private songService: SongService;
  private authService: AuthService;

  // Debounce для обновлений результатов
  private resultsUpdateTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_DELAY = 1500; // 1.5 секунды

  constructor(httpServer: HTTPServer, voteService: VoteService, songService: SongService, authService: AuthService) {
    this.voteService = voteService;
    this.songService = songService;
    this.authService = authService;

    // Инициализируем Socket.io
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || '*',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Настраиваем Redis Adapter для масштабирования
    this.setupRedisAdapter();

    // Middleware для авторизации
    this.setupAuthMiddleware();

    // Обработчики событий
    this.setupEventHandlers();

    logger.info('Socket.io server initialized');
  }

  /**
   * Настройка Redis Adapter для синхронизации между серверами
   */
  private setupRedisAdapter(): void {
    const pubClient = redis;
    const subClient = redis.duplicate();

    this.io.adapter(createAdapter(pubClient, subClient));

    logger.info('Socket.io Redis adapter configured');
  }

  /**
   * Middleware для авторизации WebSocket соединений
   */
  private setupAuthMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          logger.warn('WebSocket connection rejected: no token');
          return next(new UnauthorizedError('No token provided'));
        }

        // Верифицируем токен
        const payload = this.authService.verifyToken(token);

        // Сохраняем данные пользователя в socket
        socket.userId = payload.userId;
        socket.userRole = payload.role;

        logger.info('WebSocket connection authenticated', {
          userId: payload.userId,
          socketId: socket.id,
        });

        next();
      } catch (error) {
        logger.warn('WebSocket authentication failed', { error, socketId: socket.id });
        next(new UnauthorizedError('Invalid token'));
      }
    });
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info('Client connected', {
        socketId: socket.id,
        userId: socket.userId,
      });

      // Обработка присоединения к голосованию
      socket.on('vote:join', async (data: { sessionId?: string }) => {
        await this.handleVoteJoin(socket, data.sessionId);
      });

      // Обработка голоса
      socket.on('vote:cast', async (data: { songId: string }) => {
        await this.handleVoteCast(socket, data.songId);
      });

      // Обработка отключения
      socket.on('vote:leave', () => {
        this.handleVoteLeave(socket);
      });

      // Обработка отключения клиента
      socket.on('disconnect', (reason) => {
        logger.info('Client disconnected', {
          socketId: socket.id,
          userId: socket.userId,
          reason,
        });
        this.handleVoteLeave(socket);
      });
    });
  }

  /**
   * Обработка присоединения к голосованию
   */
  private async handleVoteJoin(socket: AuthenticatedSocket, sessionId?: string): Promise<void> {
    try {
      if (!socket.userId) {
        socket.emit('vote:error', { message: 'User not authenticated', code: 'UNAUTHORIZED' });
        return;
      }

      // Получаем активную сессию или указанную
      let session;
      if (sessionId) {
        session = await this.voteService.getSessionById(sessionId);
        if (!session) {
          socket.emit('vote:error', { message: 'Session not found', code: 'NOT_FOUND' });
          return;
        }
      } else {
        session = await this.voteService.getActiveSession();
        if (!session) {
          socket.emit('vote:state', {
            sessionId: null,
            songs: [],
            results: { songs: [], totalVotes: 0 },
            myVote: null,
          });
          return;
        }
      }

      // Присоединяемся к комнате голосования
      const roomName = `vote:session:${session.id}`;
      socket.join(roomName);

      // Получаем состояние
      const songs = await this.songService.getActiveSongs();
      const results = await this.voteService.getResults(session.id);
      const myVote = await this.voteService.getUserVote(socket.userId);

      // Отправляем полное состояние клиенту
      socket.emit('vote:state', {
        sessionId: session.id,
        songs: songs.map((s) => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          coverUrl: s.coverUrl,
          isActive: s.isActive,
        })),
        results: {
          songs: results.songs,
          totalVotes: results.totalVotes,
        },
        myVote: myVote.votedSongId ? { songId: myVote.votedSongId } : null,
      });

      logger.debug('Client joined voting session', {
        socketId: socket.id,
        userId: socket.userId,
        sessionId: session.id,
      });
    } catch (error) {
      logger.error('Error handling vote:join', { error, socketId: socket.id });
      socket.emit('vote:error', { message: 'Failed to join voting session', code: 'INTERNAL_ERROR' });
    }
  }

  /**
   * Обработка голоса
   */
  private async handleVoteCast(socket: AuthenticatedSocket, songId: string): Promise<void> {
    try {
      if (!socket.userId) {
        socket.emit('vote:error', { message: 'User not authenticated', code: 'UNAUTHORIZED' });
        return;
      }

      // Создаем голос через сервис
      await this.voteService.castVote(socket.userId, songId);

      // Подтверждение клиенту
      socket.emit('vote:cast:success', { songId });

      // Получаем активную сессию
      const session = await this.voteService.getActiveSession();
      if (!session) {
        return;
      }

      // Запускаем debounced обновление результатов
      this.scheduleResultsUpdate(session.id);

      logger.info('Vote cast', {
        userId: socket.userId,
        songId,
        sessionId: session.id,
      });
    } catch (error: any) {
      logger.error('Error handling vote:cast', { error, socketId: socket.id, userId: socket.userId });
      socket.emit('vote:error', {
        message: error.message || 'Failed to cast vote',
        code: error.code || 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * Обработка отключения от голосования
   */
  private handleVoteLeave(socket: AuthenticatedSocket): void {
    // Покидаем все комнаты голосования
    const rooms = Array.from(socket.rooms);
    rooms.forEach((room) => {
      if (room.startsWith('vote:session:')) {
        socket.leave(room);
      }
    });
  }

  /**
   * Планирование обновления результатов с debounce
   */
  private scheduleResultsUpdate(sessionId: string): void {
    // Отменяем предыдущий таймер если есть
    const existingTimer = this.resultsUpdateTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Создаем новый таймер
    const timer = setTimeout(async () => {
      await this.broadcastResultsUpdate(sessionId);
      this.resultsUpdateTimers.delete(sessionId);
    }, this.DEBOUNCE_DELAY);

    this.resultsUpdateTimers.set(sessionId, timer);
  }

  /**
   * Рассылка обновления результатов всем в комнате
   */
  private async broadcastResultsUpdate(sessionId: string): Promise<void> {
    try {
      const results = await this.voteService.getResults(sessionId);
      const roomName = `vote:session:${sessionId}`;

      this.io.to(roomName).emit('vote:results:updated', {
        sessionId,
        songs: results.songs,
        totalVotes: results.totalVotes,
      });

      logger.debug('Results updated broadcasted', { sessionId, totalVotes: results.totalVotes });
    } catch (error) {
      logger.error('Error broadcasting results update', { error, sessionId });
    }
  }

  /**
   * Рассылка обновления списка песен (когда админ изменил)
   */
  async broadcastSongsUpdate(): Promise<void> {
    try {
      const songs = await this.songService.getActiveSongs();
      this.io.emit('vote:songs:updated', songs);

      logger.info('Songs update broadcasted', { count: songs.length });
    } catch (error) {
      logger.error('Error broadcasting songs update', { error });
    }
  }

  /**
   * Рассылка события переключения песни
   */
  async broadcastSongToggled(song: { id: string; title: string; artist: string; isActive: boolean }): Promise<void> {
    try {
      this.io.emit('vote:song:toggled', song);
      logger.info('Song toggled broadcasted', { songId: song.id, isActive: song.isActive });
    } catch (error) {
      logger.error('Error broadcasting song toggle', { error });
    }
  }

  /**
   * Рассылка события начала сессии
   */
  async broadcastSessionStarted(session: { id: string; startedAt: Date }): Promise<void> {
    try {
      this.io.emit('vote:session:started', session);
      logger.info('Session started broadcasted', { sessionId: session.id });
    } catch (error) {
      logger.error('Error broadcasting session started', { error });
    }
  }

  /**
   * Рассылка события завершения сессии
   */
  async broadcastSessionEnded(data: {
    sessionId: string;
    results: Array<{ song: any; votes: number; percentage: number }>;
    totalVoters: number;
  }): Promise<void> {
    try {
      this.io.emit('vote:session:ended', data);
      logger.info('Session ended broadcasted', { sessionId: data.sessionId });
    } catch (error) {
      logger.error('Error broadcasting session ended', { error });
    }
  }

  /**
   * Получить количество подключенных клиентов
   */
  getConnectedClientsCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Получить Socket.io сервер (для внешнего использования)
   */
  getIO(): SocketIOServer {
    return this.io;
  }
}
