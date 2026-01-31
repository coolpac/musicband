import { IAgentRepository } from '../../infrastructure/database/repositories/AgentRepository';
import { IUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { IReferralLinkRepository } from '../../infrastructure/database/repositories/ReferralLinkRepository';
import { IReferralEventRepository } from '../../infrastructure/database/repositories/ReferralEventRepository';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import { USER_ROLES } from '../../shared/constants';
import crypto from 'crypto';

export class AgentService {
  constructor(
    private agentRepository: IAgentRepository,
    private userRepository: IUserRepository,
    private referralLinkRepository: IReferralLinkRepository,
    private referralEventRepository: IReferralEventRepository
  ) {}

  /**
   * Создание агента из пользователя
   */
  async createAgent(userId: string): Promise<ReturnType<IAgentRepository['create']>> {
    // Проверяем пользователя
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Проверяем, не является ли уже агентом
    const existingAgent = await this.agentRepository.findByUserId(userId);
    if (existingAgent) {
      throw new ConflictError('User is already an agent');
    }

    // Создаем агента с автоматической retry-логикой для уникального кода
    // Это защищает от race condition при одновременном создании агентов
    const agent = await this.createAgentWithUniqueCode(userId);

    // Обновляем роль пользователя на agent
    await this.userRepository.updateRole(userId, USER_ROLES.AGENT);

    logger.info('Agent created', {
      agentId: agent.id,
      userId,
      agentCode: agent.agentCode,
    });

    return agent;
  }

  /**
   * Получение агента по ID
   */
  async getAgentById(id: string) {
    const agent = await this.agentRepository.findById(id);
    if (!agent) {
      throw new NotFoundError('Agent');
    }
    return agent;
  }

  /**
   * Получение агента по userId
   */
  async getAgentByUserId(userId: string) {
    const agent = await this.agentRepository.findByUserId(userId);
    if (!agent) {
      throw new NotFoundError('Agent');
    }
    return agent;
  }

  /**
   * Получение всех агентов
   */
  async getAllAgents(status?: 'active' | 'inactive' | 'suspended') {
    return this.agentRepository.findAll({ status });
  }

  /**
   * Обновление статуса агента
   */
  async updateAgentStatus(id: string, status: 'active' | 'inactive' | 'suspended') {
    await this.getAgentById(id);
    return this.agentRepository.updateStatus(id, status);
  }

  /**
   * Создание агента с уникальным кодом (защита от race condition)
   *
   * ПОДХОД: Вместо check-then-act используем try-catch с retry
   * Базируется на UNIQUE constraint в БД (агентский код уникален по схеме)
   *
   * Если два запроса одновременно попытаются создать агента с одинаковым кодом:
   * 1. Первый успешно создаст
   * 2. Второй получит Prisma error P2002 (unique constraint violation)
   * 3. Второй сгенерирует новый код и повторит попытку
   */
  private async createAgentWithUniqueCode(userId: string) {
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Генерируем случайный код (8 hex символов)
        const agentCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        // Пытаемся создать агента
        // База данных сама проверит уникальность через UNIQUE constraint
        const agent = await this.agentRepository.create({
          userId,
          agentCode,
          status: 'active',
        });

        // Успех! Код оказался уникальным
        logger.debug('Agent created with unique code', {
          agentCode,
          attempt: attempt + 1,
        });

        return agent;
      } catch (error: any) {
        // Проверяем, это ошибка дубликата кода?
        if (error.code === 'P2002') {
          // P2002 = Prisma unique constraint violation
          logger.debug('Agent code collision detected, retrying', {
            attempt: attempt + 1,
            maxAttempts,
          });

          // Retry с новым кодом
          continue;
        }

        // Другая ошибка - пробрасываем
        throw error;
      }
    }

    // Если за 10 попыток не получилось - что-то очень не так
    throw new Error(
      `Failed to create agent with unique code after ${maxAttempts} attempts`
    );
  }

  /**
   * Генерация случайного кода (теперь без проверки БД)
   * Проверку делает createAgentWithUniqueCode через unique constraint
   */
  private generateRandomCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }
}
