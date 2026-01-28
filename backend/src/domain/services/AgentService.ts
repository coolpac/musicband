import { IAgentRepository } from '../../infrastructure/database/repositories/AgentRepository';
import { IUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import { USER_ROLES } from '../../shared/constants';
import crypto from 'crypto';

export class AgentService {
  constructor(
    private agentRepository: IAgentRepository,
    private userRepository: IUserRepository
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

    // Генерируем уникальный код агента
    const agentCode = await this.generateUniqueAgentCode();

    // Создаем агента
    const agent = await this.agentRepository.create({
      userId,
      agentCode,
      status: 'active',
    });

    // Обновляем роль пользователя на agent
    await this.userRepository.updateRole(userId, USER_ROLES.AGENT);

    logger.info('Agent created', {
      agentId: agent.id,
      userId,
      agentCode,
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
   * Генерация уникального кода агента
   */
  private async generateUniqueAgentCode(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      // Генерируем код из 8 символов (буквы и цифры)
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();

      // Проверяем уникальность
      const existing = await this.agentRepository.findByAgentCode(code);
      if (!existing) {
        return code;
      }

      attempts++;
    }

    throw new Error('Failed to generate unique agent code');
  }
}
