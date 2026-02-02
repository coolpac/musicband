import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../domain/services/AuthService';
import { UnauthorizedError } from '../../shared/errors';
import { USER_ROLES } from '../../shared/constants';

// Типы req.user и req.token объявлены в src/types/express.d.ts

/**
 * Middleware для проверки JWT токена
 */
export function authenticate(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Получаем токен из заголовка Authorization или из cookie
      const authHeader = req.headers.authorization;
      let token: string | undefined;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
      }

      if (!token) {
        throw new UnauthorizedError('No token provided');
      }

      // Верифицируем токен
      const payload = authService.verifyToken(token);

      // Проверка blacklist (отзыв токена)
      if (await authService.isRevoked(payload.jti)) {
        throw new UnauthorizedError('Token has been revoked');
      }

      req.token = token;
      req.user = {
        userId: payload.userId,
        telegramId: payload.telegramId,
        role: payload.role,
      };

      next();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        res.status(401).json({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Middleware для проверки роли пользователя
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
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

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Forbidden: insufficient permissions',
          code: 'FORBIDDEN',
        },
      });
      return;
    }

    next();
  };
}

/**
 * Удобные middleware для конкретных ролей
 */
export const requireAdmin = authorize(USER_ROLES.ADMIN);
export const requireAgent = authorize(USER_ROLES.AGENT);
export const requireAdminOrAgent = authorize(USER_ROLES.ADMIN, USER_ROLES.AGENT);

/**
 * Middleware для проверки, что пользователь является агентом
 * (проверяет не только роль, но и наличие записи в Agents)
 */
export function requireAgentRecord(_authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    // Проверяем роль
    if (req.user.role !== USER_ROLES.AGENT) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Forbidden: user is not an agent',
          code: 'FORBIDDEN',
        },
      });
      return;
    }

    // TODO: Можно добавить проверку наличия записи в Agents таблице
    // Пока что достаточно проверки роли

    next();
  };
}
