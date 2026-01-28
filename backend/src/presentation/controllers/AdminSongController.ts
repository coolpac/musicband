import { Request, Response, NextFunction } from 'express';
import { SongService } from '../../domain/services/SongService';
import { CreateSongDto, UpdateSongDto } from '../../application/dto/song.dto';
import { logger } from '../../shared/utils/logger';

// Получаем socketServer из глобального контекста
function getSocketServer() {
  return (global as any).socketServer || null;
}

export class AdminSongController {
  constructor(private songService: SongService) {}

  /**
   * GET /api/admin/songs
   * Получить все песни (админ)
   */
  async getAllSongs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const songs = await this.songService.getAllSongs();

      res.json({
        success: true,
        data: songs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/songs
   * Создать песню
   */
  async createSong(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreateSongDto;
      const song = await this.songService.createSong(data);

      // Если песня активна, рассылаем обновление списка
      const socketServer = getSocketServer();
      if (song.isActive && socketServer) {
        await socketServer.broadcastSongsUpdate();
      }

      logger.info('Song created by admin', {
        songId: song.id,
        adminId: req.user?.userId,
      });

      res.status(201).json({
        success: true,
        data: song,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/songs/:id
   * Обновить песню
   */
  async updateSong(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateSongDto;
      const song = await this.songService.updateSong(id, data);

      // Если изменилась активность или другие важные поля, рассылаем обновление
      const socketServer = getSocketServer();
      if (socketServer && (data.isActive !== undefined || data.title || data.artist)) {
        if (song.isActive) {
          await socketServer.broadcastSongsUpdate();
        } else {
          await socketServer.broadcastSongToggled({
            id: song.id,
            title: song.title,
            artist: song.artist,
            isActive: song.isActive,
          });
        }
      }

      res.json({
        success: true,
        data: song,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/admin/songs/:id
   * Удалить песню
   */
  async deleteSong(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await this.songService.deleteSong(id);

      // Рассылаем обновление списка песен
      const socketServer = getSocketServer();
      if (socketServer) {
        await socketServer.broadcastSongsUpdate();
      }

      res.json({
        success: true,
        message: 'Song deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/songs/:id/toggle
   * Переключить активность песни
   */
  async toggleSong(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const song = await this.songService.toggleSongActive(id);

      // Рассылаем событие через Socket.io
      const socketServer = getSocketServer();
      if (socketServer) {
        await socketServer.broadcastSongToggled({
          id: song.id,
          title: song.title,
          artist: song.artist,
          isActive: song.isActive,
        });
      }

      res.json({
        success: true,
        data: song,
      });
    } catch (error) {
      next(error);
    }
  }
}
