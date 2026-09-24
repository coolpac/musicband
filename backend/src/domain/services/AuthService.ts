import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type Redis from 'ioredis';
import type { Platform } from '@prisma/client';
import {
  IUserRepository,
  CreateUserData,
} from '../../infrastructure/database/repositories/UserRepository';
import { validateInitData } from '../../shared/utils/telegram';
import { validateMaxInitData } from '../../shared/utils/max';
import { UnauthorizedError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import { USER_ROLES } from '../../shared/constants';

const BLACKLIST_PREFIX = 'token_blacklist:';

export interface JWTPayload {
  userId: string;
  platform: Platform;
  platformId: string;
  role: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  user: {
    id: string;
    platform: Platform;
    platformId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    role: string;
  };
  token: string;
  startParam?: string; // Для deep links (vote_{sessionId})
}

export class AuthService {
  constructor(
    private userRepository: IUserRepository,
    private jwtSecret: string,
    private jwtExpiresIn: string,
    private adminBotToken: string,
    private userBotToken?: string, // Токен User Bot для валидации initData от пользователей
    private redis?: Redis,
    private maxAdminBotToken?: string, // Токен Admin Bot для валидации Max initData
    private maxUserBotToken?: string // Токен User Bot для валидации Max initData
  ) {}

  /**
   * Авторизация через Telegram Mini App
   * Поддерживает initData от обоих ботов (Admin Bot и User Bot)
   * @param rawInitData - initData от Telegram
   * @param referralCode - опциональный реферальный код
   * @param startParam - опциональный start_param из deep link (например, vote_{sessionId})
   */
  async authenticateWithTelegram(
    rawInitData: string,
    _referralCode?: string,
    startParam?: string
  ): Promise<AuthResult> {
    // Пробуем валидировать initData от обоих ботов
    // Сначала пробуем User Bot (для обычных пользователей)
    let initData = this.userBotToken
      ? validateInitData(rawInitData, this.userBotToken, 3600, { logFailures: false })
      : null;

    // Если не прошло, пробуем Admin Bot (для админов)
    if (!initData) {
      initData = validateInitData(rawInitData, this.adminBotToken);
    }

    if (!initData || !initData.user) {
      logger.warn('auth/telegram initData validation failed', {
        hadUserBot: !!this.userBotToken,
        rawLength: typeof rawInitData === 'string' ? rawInitData.length : 0,
      });
      throw new UnauthorizedError('Invalid or expired initData');
    }

    // Используем startParam из initData или переданный параметр
    const sessionStartParam = startParam || initData.start_param;

    const telegramUser = initData.user;
    const platformId = BigInt(telegramUser.id);

    // Ищем или создаём пользователя (findOrCreate предотвращает duplicate key при race condition)
    const createData: CreateUserData = {
      platform: 'telegram',
      platformId,
      username: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      role: USER_ROLES.USER, // По умолчанию user, админ назначается вручную
    };

    const { user: foundOrCreated, created } =
      await this.userRepository.findOrCreateByIdentity(createData);
    let user = foundOrCreated;

    if (created) {
      logger.info('New user created from Telegram', {
        userId: user.id,
        platformId: telegramUser.id,
      });

      // Отправляем уведомление админам о новом пользователе
      try {
        const { getBotManager } = await import('../../infrastructure/telegram/botManager');
        const botManager = getBotManager();
        if (botManager) {
          // Фан-аут на админов всех платформ: о новом пользователе должны узнать
          // все админы, а не только админы платформы этого пользователя.
          // platform в notice — реальная платформа пользователя (user.platform).
          await botManager.notifyNewUserToAllAdmins({
            platform: user.platform,
            platformId: user.platformId.toString(),
            username: user.username || undefined,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
          });
        }
      } catch (error) {
        logger.warn('Failed to send new user notification', { error });
      }
    } else {
      // Обновляем данные пользователя если изменились
      const needsUpdate =
        user.username !== telegramUser.username ||
        user.firstName !== telegramUser.first_name ||
        user.lastName !== telegramUser.last_name;

      if (needsUpdate) {
        user = await this.userRepository.update(user.id, {
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
        });
      }
    }

    // Генерируем JWT токен
    const token = this.generateToken({
      userId: user.id,
      platform: user.platform,
      platformId: user.platformId.toString(),
      role: user.role,
    });

    // Обрабатываем startParam если есть (для голосования)
    let processedStartParam: string | undefined;
    if (sessionStartParam && sessionStartParam.startsWith('vote_')) {
      processedStartParam = sessionStartParam; // vote_{sessionId}
    }

    return {
      user: {
        id: user.id,
        platform: user.platform,
        platformId: user.platformId.toString(),
        username: user.username || undefined,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        role: user.role,
      },
      token,
      startParam: processedStartParam,
    };
  }

  /**
   * Авторизация через Max Mini App
   * Поддерживает initData от обоих ботов (Admin Bot и User Bot Max)
   * @param rawInitData - initData от Max
   * @param startParam - опциональный start_param из deep link (например, vote_{sessionId})
   */
  async authenticateWithMax(rawInitData: string, startParam?: string): Promise<AuthResult> {
    // Пробуем валидировать initData от обоих ботов Max
    // Сначала пробуем User Bot (для обычных пользователей)
    let initData = this.maxUserBotToken
      ? validateMaxInitData(rawInitData, this.maxUserBotToken, 3600, { logFailures: false })
      : null;

    // Если не прошло, пробуем Admin Bot (для админов)
    if (!initData && this.maxAdminBotToken) {
      initData = validateMaxInitData(rawInitData, this.maxAdminBotToken);
    }

    if (!initData || !initData.user) {
      logger.warn('auth/max initData validation failed', {
        hadUserBot: !!this.maxUserBotToken,
        hadAdminBot: !!this.maxAdminBotToken,
        rawLength: typeof rawInitData === 'string' ? rawInitData.length : 0,
      });
      throw new UnauthorizedError('Invalid or expired initData');
    }

    // Используем startParam из initData или переданный параметр
    const sessionStartParam = startParam || initData.start_param;

    const maxUser = initData.user;
    const platformId = BigInt(maxUser.id);

    // Ищем или создаём пользователя (findOrCreate предотвращает duplicate key при race condition)
    const createData: CreateUserData = {
      platform: 'max',
      platformId,
      username: maxUser.username,
      firstName: maxUser.first_name,
      lastName: maxUser.last_name,
      photoUrl: maxUser.photo_url,
      role: USER_ROLES.USER, // По умолчанию user, админ назначается вручную
    };

    const { user: foundOrCreated, created } =
      await this.userRepository.findOrCreateByIdentity(createData);
    let user = foundOrCreated;

    if (created) {
      logger.info('New user created from Max', {
        userId: user.id,
        platformId: maxUser.id,
      });

      // Отправляем уведомление админам о новом пользователе
      try {
        const { getBotManager } = await import('../../infrastructure/telegram/botManager');
        const botManager = getBotManager();
        if (botManager) {
          // Фан-аут на админов всех платформ: о новом пользователе должны узнать
          // все админы, а не только админы платформы этого пользователя.
          // platform в notice — реальная платформа пользователя (user.platform).
          await botManager.notifyNewUserToAllAdmins({
            platform: user.platform,
            platformId: user.platformId.toString(),
            username: user.username || undefined,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
          });
        }
      } catch (error) {
        logger.warn('Failed to send new user notification', { error });
      }
    } else {
      // Обновляем данные пользователя если изменились
      const needsUpdate =
        user.username !== (maxUser.username ?? null) ||
        user.firstName !== (maxUser.first_name ?? null) ||
        user.lastName !== (maxUser.last_name ?? null) ||
        user.photoUrl !== (maxUser.photo_url ?? null);

      if (needsUpdate) {
        user = await this.userRepository.update(user.id, {
          username: maxUser.username,
          firstName: maxUser.first_name,
          lastName: maxUser.last_name,
          photoUrl: maxUser.photo_url,
        });
      }
    }

    // Генерируем JWT токен
    const token = this.generateToken({
      userId: user.id,
      platform: user.platform,
      platformId: user.platformId.toString(),
      role: user.role,
    });

    // Обрабатываем startParam если есть (для голосования)
    let processedStartParam: string | undefined;
    if (sessionStartParam && sessionStartParam.startsWith('vote_')) {
      processedStartParam = sessionStartParam; // vote_{sessionId}
    }

    return {
      user: {
        id: user.id,
        platform: user.platform,
        platformId: user.platformId.toString(),
        username: user.username || undefined,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        role: user.role,
      },
      token,
      startParam: processedStartParam,
    };
  }

  /**
   * Авторизация админа через email/password (для админки)
   */
  async authenticateAdmin(telegramId: number, password: string): Promise<AuthResult> {
    // Админ всегда привязан к telegram-аккаунту.
    const user = await this.userRepository.findByIdentity('telegram', BigInt(telegramId));

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Проверяем роль
    if (user.role !== USER_ROLES.ADMIN) {
      throw new UnauthorizedError('Access denied');
    }

    // Проверка пароля с использованием bcrypt
    // Пароль должен быть захеширован и сохранен в переменной окружения ADMIN_PASSWORD_HASH
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminPasswordHash) {
      logger.error('ADMIN_PASSWORD_HASH is not set in environment variables');
      throw new UnauthorizedError('Invalid credentials');
    }

    // Сравниваем с хешем используя bcrypt
    const isPasswordValid = await bcrypt.compare(password, adminPasswordHash);

    if (!isPasswordValid) {
      logger.warn('Failed admin login attempt', { telegramId });
      throw new UnauthorizedError('Invalid credentials');
    }

    // Генерируем JWT токен
    const token = this.generateToken({
      userId: user.id,
      platform: user.platform,
      platformId: user.platformId.toString(),
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        platform: user.platform,
        platformId: user.platformId.toString(),
        username: user.username || undefined,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        role: user.role,
      },
      token,
    };
  }

  /**
   * Верификация JWT токена
   */
  verifyToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload & { telegramId?: string };
      // Обратная совместимость: токены, выпущенные ДО перехода на (platform, platformId),
      // несут только telegramId. Чтобы существующие Telegram-пользователи не потеряли
      // platform/platformId в req.user (иначе ломается, например, аватарка) до истечения
      // токена (≤7д), нормализуем такие токены как telegram.
      if (!payload.platform) {
        payload.platform = 'telegram';
      }
      if (!payload.platformId && payload.telegramId) {
        payload.platformId = payload.telegramId;
      }
      return payload;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  /**
   * Проверка, отозван ли токен (jti в blacklist)
   */
  async isRevoked(jti: string | undefined): Promise<boolean> {
    if (!jti || !this.redis) return false;
    const key = BLACKLIST_PREFIX + jti;
    const exists = await this.redis.get(key);
    return exists === '1';
  }

  /**
   * Отзыв токена: добавляет jti в Redis blacklist с TTL = оставшееся время жизни токена
   */
  async revokeToken(token: string): Promise<void> {
    if (!this.redis) return;
    try {
      const decoded = jwt.decode(token) as (JWTPayload & { exp?: number }) | null;
      if (!decoded?.jti || typeof decoded.exp !== 'number') return;
      const ttlSeconds = Math.max(0, Math.floor(decoded.exp - Date.now() / 1000));
      if (ttlSeconds <= 0) return;
      const key = BLACKLIST_PREFIX + decoded.jti;
      await this.redis.setex(key, ttlSeconds, '1');
    } catch {
      // Не логируем детали — токен может быть невалидным
    }
  }

  /**
   * Генерация JWT токена с jti (UUID) для возможности отзыва
   */
  private generateToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): string {
    const withJti = { ...payload, jti: crypto.randomUUID() };
    return jwt.sign(withJti, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }
}
