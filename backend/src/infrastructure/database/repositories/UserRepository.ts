import { PrismaClient, User, UserRole } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IUserRepository {
  findByTelegramId(telegramId: bigint): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  /**
   * Находит или создаёт пользователя по telegramId. Использует upsert для атомарности
   * и предотвращения duplicate key при параллельных запросах.
   */
  findOrCreateByTelegramId(data: CreateUserData): Promise<{ user: User; created: boolean }>;
  update(id: string, data: UpdateUserData): Promise<User>;
  updateRole(id: string, role: UserRole): Promise<User>;
  /** Обновление роли по telegram_id (для назначения админа без знания id). */
  updateRoleByTelegramId(telegramId: bigint, role: UserRole): Promise<User | null>;
}

export interface CreateUserData {
  telegramId: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  referrerId?: string;
}

export interface UpdateUserData {
  username?: string;
  firstName?: string;
  lastName?: string;
}

export class PrismaUserRepository implements IUserRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findByTelegramId(telegramId: bigint): Promise<User | null> {
    return this.client.user.findUnique({
      where: { telegramId },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.client.user.findUnique({
      where: { id },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    return this.client.user.create({
      data: {
        telegramId: data.telegramId,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'user',
        referrerId: data.referrerId,
      },
    });
  }

  async findOrCreateByTelegramId(data: CreateUserData): Promise<{ user: User; created: boolean }> {
    const existing = await this.client.user.findUnique({
      where: { telegramId: data.telegramId },
    });
    if (existing) {
      return { user: existing, created: false };
    }
    try {
      const user = await this.client.user.create({
        data: {
          telegramId: data.telegramId,
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role || 'user',
          referrerId: data.referrerId,
        },
      });
      return { user, created: true };
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2002') {
        const user = await this.client.user.findUniqueOrThrow({
          where: { telegramId: data.telegramId },
        });
        return { user, created: false };
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    return this.client.user.update({
      where: { id },
      data: {
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    return this.client.user.update({
      where: { id },
      data: { role },
    });
  }

  async updateRoleByTelegramId(telegramId: bigint, role: UserRole): Promise<User | null> {
    try {
      return await this.client.user.update({
        where: { telegramId },
        data: { role },
      });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2025') return null;
      throw error;
    }
  }
}
