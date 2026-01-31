import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { IUserRepository, CreateUserData } from '../../infrastructure/database/repositories/UserRepository';
import { validateInitData, TelegramUser } from '../../shared/utils/telegram';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import { USER_ROLES } from '../../shared/constants';

export interface JWTPayload {
  userId: string;
  telegramId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  user: {
    id: string;
    telegramId: string;
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
    private userBotToken?: string // Токен User Bot для валидации initData от пользователей
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
    referralCode?: string,
    startParam?: string
  ): Promise<AuthResult> {
    // Пробуем валидировать initData от обоих ботов
    // Сначала пробуем User Bot (для обычных пользователей)
    let initData = this.userBotToken
      ? validateInitData(rawInitData, this.userBotToken)
      : null;

    // Если не прошло, пробуем Admin Bot (для админов)
    if (!initData) {
      initData = validateInitData(rawInitData, this.adminBotToken);
    }

    if (!initData || !initData.user) {
      throw new UnauthorizedError('Invalid or expired initData');
    }

    // Используем startParam из initData или переданный параметр
    const sessionStartParam = startParam || initData.start_param;

    const telegramUser = initData.user;
    const telegramId = BigInt(telegramUser.id);

    // Ищем или создаем пользователя
    let user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      // Создаем нового пользователя
      const createData: CreateUserData = {
        telegramId,
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        role: USER_ROLES.USER, // По умолчанию user, админ назначается вручную
      };

      user = await this.userRepository.create(createData);
      logger.info('New user created from Telegram', { userId: user.id, telegramId: telegramUser.id });

      // Отправляем уведомление админам о новом пользователе
      // Импортируем динамически, чтобы избежать циклических зависимостей
      try {
        const { getBotManager } = await import('../../infrastructure/telegram/botManager');
        const botManager = getBotManager();
        if (botManager) {
          await botManager.notifyNewUser({
            telegramId: user.telegramId.toString(),
            username: user.username || undefined,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
          });
        }
      } catch (error) {
        // Игнорируем ошибки уведомлений, чтобы не блокировать регистрацию
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
      telegramId: user.telegramId.toString(),
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
        telegramId: user.telegramId.toString(),
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
    const user = await this.userRepository.findByTelegramId(BigInt(telegramId));

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
      telegramId: user.telegramId.toString(),
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        telegramId: user.telegramId.toString(),
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
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;
      return payload;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  /**
   * Генерация JWT токена
   */
  private generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
  }
}
