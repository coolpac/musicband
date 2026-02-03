import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../domain/services/AuthService';
import { TelegramAuthDto, AdminAuthDto } from '../../application/dto/auth.dto';
import { logger } from '../../shared/utils/logger';

export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/auth/telegram
   * Авторизация через Telegram Mini App (Admin Bot initData)
   */
  async authenticateTelegram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { initData, startParam } = req.body as TelegramAuthDto & { startParam?: string };

      const result = await this.authService.authenticateWithTelegram(initData, undefined, startParam);

      logger.info('User authenticated via Telegram', {
        userId: result.user.id,
        telegramId: result.user.telegramId,
        role: result.user.role,
        startParam: result.startParam,
      });

      // Устанавливаем токен в cookie (опционально)
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      });

      res.json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
          startParam: result.startParam, // Для фронтенда (vote_{sessionId})
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/admin/login
   * Авторизация админа через telegramId + password
   */
  async authenticateAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { telegramId, password } = req.body as AdminAuthDto;

      const result = await this.authService.authenticateAdmin(telegramId, password);

      logger.info('Admin authenticated', {
        userId: result.user.id,
        telegramId: result.user.telegramId,
      });

      // Устанавливаем токен в cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      });

      res.json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Выход из системы + отзыв токена (jti в Redis blacklist)
   */
  async logout(req: Request, res: Response): Promise<void> {
    if (req.token) {
      await this.authService.revokeToken(req.token);
    }
    res.clearCookie('token');
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  /**
   * GET /api/auth/me
   * Получить текущего пользователя (avatarUrl — для загрузки аватарки из Telegram)
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    const data: { userId: string; telegramId: string; role: string; avatarUrl?: string } = {
      userId: req.user.userId,
      telegramId: req.user.telegramId,
      role: req.user.role,
    };
    if (req.user.telegramId) {
      data.avatarUrl = '/api/auth/me/avatar';
    }
    res.json({ success: true, data });
  }

  /**
   * GET /api/auth/me/avatar
   * Прокси фото профиля текущего пользователя из Telegram (getUserProfilePhotos + getFile).
   */
  async getAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.telegramId) {
        res.status(404).send();
        return;
      }
      const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN;
      if (!token) {
        res.status(503).send();
        return;
      }
      const telegramId = req.user.telegramId;
      const base = `https://api.telegram.org/bot${token}`;

      const photosRes = await fetch(`${base}/getUserProfilePhotos?user_id=${telegramId}&limit=1`);
      const photosJson = (await photosRes.json()) as {
        ok: boolean;
        result?: { total_count: number; photos?: Array<Array<{ file_id: string }>> };
      };
      if (!photosJson.ok || !photosJson.result?.photos?.length) {
        res.status(404).send();
        return;
      }
      const sizes = photosJson.result.photos[0];
      const largest = sizes[sizes.length - 1];
      const fileId = largest.file_id;

      const fileRes = await fetch(`${base}/getFile?file_id=${encodeURIComponent(fileId)}`);
      const fileJson = (await fileRes.json()) as { ok: boolean; result?: { file_path: string } };
      if (!fileJson.ok || !fileJson.result?.file_path) {
        res.status(404).send();
        return;
      }
      const fileUrl = `https://api.telegram.org/file/bot${token}/${fileJson.result.file_path}`;
      const imageRes = await fetch(fileUrl);
      if (!imageRes.ok) {
        res.status(502).send();
        return;
      }
      const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      const buffer = await imageRes.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error) {
      next(error);
    }
  }
}
