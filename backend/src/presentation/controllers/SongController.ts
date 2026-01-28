import { Request, Response, NextFunction } from 'express';
import { SongService } from '../../domain/services/SongService';
import { logger } from '../../shared/utils/logger';

export class SongController {
  constructor(private songService: SongService) {}

  /**
   * GET /api/songs
   * Получить все песни (с фильтром isActive)
   */
  async getAllSongs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const songs = await this.songService.getAllSongs(isActive);

      res.json({
        success: true,
        data: songs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/songs/:id
   * Получить песню по ID
   */
  async getSongById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const song = await this.songService.getSongById(id);

      res.json({
        success: true,
        data: song,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/songs/:id/lyrics
   * Получить текст песни
   */
  async getSongLyrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const song = await this.songService.getSongById(id);

      res.json({
        success: true,
        data: {
          lyrics: song.lyrics || '',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
