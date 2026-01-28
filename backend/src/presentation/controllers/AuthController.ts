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
   * Выход из системы
   */
  async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie('token');
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  /**
   * GET /api/auth/me
   * Получить текущего пользователя
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

    res.json({
      success: true,
      data: {
        userId: req.user.userId,
        telegramId: req.user.telegramId,
        role: req.user.role,
      },
    });
  }
}
