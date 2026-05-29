import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../domain/services/AuthService';
import { TelegramAuthDto, MaxAuthDto, AdminAuthDto } from '../../application/dto/auth.dto';
import { IUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { logger } from '../../shared/utils/logger';

export class AuthController {
  constructor(
    private authService: AuthService,
    private userRepository: IUserRepository
  ) {}

  /**
   * POST /api/auth/telegram
   * Авторизация через Telegram Mini App (Admin Bot initData)
   */
  async authenticateTelegram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { initData, startParam } = req.body as TelegramAuthDto & { startParam?: string };

      const result = await this.authService.authenticateWithTelegram(
        initData,
        undefined,
        startParam
      );

      logger.info('User authenticated via Telegram', {
        userId: result.user.id,
        platform: result.user.platform,
        platformId: result.user.platformId,
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
   * POST /api/auth/max
   * Авторизация через Max Mini App
   */
  async authenticateMax(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { initData, startParam } = req.body as MaxAuthDto;

      const result = await this.authService.authenticateWithMax(initData, startParam);

      logger.info('User authenticated via Max', {
        userId: result.user.id,
        platform: result.user.platform,
        platformId: result.user.platformId,
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
        platform: result.user.platform,
        platformId: result.user.platformId,
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
  getCurrentUser(req: Request, res: Response): void {
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

    const data: {
      userId: string;
      platform: string;
      platformId: string;
      role: string;
      avatarUrl?: string;
    } = {
      userId: req.user.userId,
      platform: req.user.platform,
      platformId: req.user.platformId,
      role: req.user.role,
    };
    if (req.user.platformId) {
      data.avatarUrl = '/api/auth/me/avatar';
    }
    res.json({ success: true, data });
  }

  /**
   * GET /api/auth/me/avatar
   * Аватар текущего пользователя, платформо-зависимо:
   * - telegram → прокси фото из Telegram (getUserProfilePhotos + getFile);
   * - max → 302-редирект на сохранённый User.photoUrl (из Max initData).
   *
   * Почему редирект для Max (а не прокси-стрим как у Telegram): Max-аватар — это
   * публичный CDN-URL из initData, для которого НЕ нужен токен бота (в отличие от
   * Telegram, чей file-URL требует bot-токен). Редирект проще и не гоняет байты
   * через наш сервер.
   */
  async getAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.platformId) {
        res.status(404).send();
        return;
      }

      if (req.user.platform === 'max') {
        await this.serveMaxAvatar(req, res);
        return;
      }

      // Не-telegram (и не-max) платформы аватара не имеют.
      if (req.user.platform !== 'telegram') {
        res.status(404).send();
        return;
      }
      const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN;
      if (!token) {
        res.status(503).send();
        return;
      }
      const telegramId = req.user.platformId;
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

  /**
   * Аватар Max-пользователя: 302-редирект на сохранённый photoUrl.
   * photoUrl нет в JWT, поэтому подгружаем пользователя по identity (platform+platformId).
   * 404, если пользователь не найден или photoUrl отсутствует.
   */
  private async serveMaxAvatar(req: Request, res: Response): Promise<void> {
    const user = await this.userRepository.findByIdentity(
      'max',
      BigInt(req.user!.platformId)
    );
    if (!user?.photoUrl) {
      res.status(404).send();
      return;
    }
    res.redirect(user.photoUrl);
  }
}
