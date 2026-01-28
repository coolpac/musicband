import { IReferralLinkRepository } from '../../infrastructure/database/repositories/ReferralLinkRepository';
import { IReferralEventRepository } from '../../infrastructure/database/repositories/ReferralEventRepository';
import { IAgentRepository } from '../../infrastructure/database/repositories/AgentRepository';
import { IUserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';
import crypto from 'crypto';

export class ReferralService {
  constructor(
    private referralLinkRepository: IReferralLinkRepository,
    private referralEventRepository: IReferralEventRepository,
    private agentRepository: IAgentRepository,
    private userRepository: IUserRepository
  ) {}

  /**
   * Создание реферальной ссылки для агента
   */
  async createReferralLink(agentId: string, data: { name?: string; expiresAt?: Date }) {
    // Проверяем агента
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) {
      throw new NotFoundError('Agent');
    }

    if (agent.status !== 'active') {
      throw new ValidationError('Agent is not active');
    }

    // Генерируем уникальный код ссылки
    const linkCode = await this.generateUniqueLinkCode();

    // Создаем ссылку
    const link = await this.referralLinkRepository.create({
      agentId,
      linkCode,
      name: data.name,
      expiresAt: data.expiresAt,
    });

    logger.info('Referral link created', {
      linkId: link.id,
      agentId,
      linkCode,
    });

    return link;
  }

  /**
   * Получение всех ссылок агента
   */
  async getAgentLinks(agentId: string) {
    await this.agentRepository.findById(agentId);
    return this.referralLinkRepository.findByAgentId(agentId);
  }

  /**
   * Обработка клика по реферальной ссылке
   */
  async handleLinkClick(linkCode: string, ipAddress?: string, userAgent?: string) {
    const link = await this.referralLinkRepository.findByLinkCode(linkCode);
    if (!link) {
      throw new NotFoundError('Referral link');
    }

    // Проверяем активность ссылки
    if (!link.isActive) {
      throw new ValidationError('Referral link is not active');
    }

    // Проверяем срок действия
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new ValidationError('Referral link has expired');
    }

    // Увеличиваем счетчик кликов
    await this.referralLinkRepository.incrementClickCount(link.id);

    // Создаем событие клика
    const event = await this.referralEventRepository.create({
      agentId: link.agentId,
      referralLinkId: link.id,
      eventType: 'click',
      ipAddress,
      userAgent,
    });

    logger.info('Referral link clicked', {
      linkId: link.id,
      linkCode,
      eventId: event.id,
    });

    return {
      link,
      event,
    };
  }

  /**
   * Обработка регистрации по реферальной ссылке
   */
  async handleRegistration(userId: string, linkCode?: string) {
    if (!linkCode) {
      return null;
    }

    const link = await this.referralLinkRepository.findByLinkCode(linkCode);
    if (!link || !link.isActive) {
      return null;
    }

    // Проверяем срок действия
    if (link.expiresAt && link.expiresAt < new Date()) {
      return null;
    }

    // Обновляем referrer_id пользователя
    const agent = await this.agentRepository.findById(link.agentId);
    if (agent) {
      await this.userRepository.update(userId, {
        // referrerId устанавливается при создании пользователя через AuthService
      });

      // Увеличиваем счетчики
      await this.referralLinkRepository.incrementConversionCount(link.id);
      await this.agentRepository.incrementReferrals(link.agentId);
      await this.agentRepository.incrementActiveReferrals(link.agentId);

      // Создаем событие регистрации
      const event = await this.referralEventRepository.create({
        agentId: link.agentId,
        referralLinkId: link.id,
        referredUserId: userId,
        eventType: 'registration',
      });

      logger.info('User registered via referral link', {
        userId,
        linkId: link.id,
        agentId: link.agentId,
        eventId: event.id,
      });

      return event;
    }

    return null;
  }

  /**
   * Создание события реферала (booking, vote)
   */
  async createReferralEvent(
    userId: string,
    eventType: 'booking' | 'vote',
    metadata?: any
  ) {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.referrerId) {
      return null; // Пользователь не был привлечен агентом
    }

    // Находим агента по referrerId
    const agent = await this.agentRepository.findByUserId(user.referrerId);
    if (!agent || agent.status !== 'active') {
      return null;
    }

    // Создаем событие
    const event = await this.referralEventRepository.create({
      agentId: agent.id,
      referredUserId: userId,
      eventType,
      metadata,
    });

    logger.info('Referral event created', {
      eventId: event.id,
      agentId: agent.id,
      userId,
      eventType,
    });

    return event;
  }

  /**
   * Получение статистики агента
   */
  async getAgentStats(agentId: string, startDate?: Date, endDate?: Date) {
    await this.agentRepository.findById(agentId);
    return this.referralEventRepository.getStats(agentId, startDate, endDate);
  }

  /**
   * Получение событий агента
   */
  async getAgentEvents(agentId: string, options?: {
    page?: number;
    limit?: number;
    eventType?: 'click' | 'registration' | 'booking' | 'vote';
    status?: 'pending' | 'confirmed' | 'rejected';
  }) {
    await this.agentRepository.findById(agentId);
    return this.referralEventRepository.findByAgentId(agentId, options);
  }

  /**
   * Генерация уникального кода ссылки
   */
  private async generateUniqueLinkCode(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      // Генерируем код из 12 символов
      const code = crypto.randomBytes(6).toString('hex').toUpperCase();

      // Проверяем уникальность
      const existing = await this.referralLinkRepository.findByLinkCode(code);
      if (!existing) {
        return code;
      }

      attempts++;
    }

    throw new Error('Failed to generate unique link code');
  }
}
