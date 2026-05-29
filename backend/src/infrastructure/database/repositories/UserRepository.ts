import { PrismaClient, Platform, User, UserRole } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IUserRepository {
  findByIdentity(platform: Platform, platformId: bigint): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  /**
   * Находит или создаёт пользователя по (platform, platformId). Использует
   * create-then-catch-unique для атомарности и предотвращения duplicate key
   * при параллельных запросах.
   */
  findOrCreateByIdentity(data: CreateUserData): Promise<{ user: User; created: boolean }>;
  update(id: string, data: UpdateUserData): Promise<User>;
  updateRole(id: string, role: UserRole): Promise<User>;
  /** Обновление роли по (platform, platformId) — для назначения админа без знания id. */
  updateRoleByIdentity(
    platform: Platform,
    platformId: bigint,
    role: UserRole
  ): Promise<User | null>;
}

export interface CreateUserData {
  platform: Platform;
  platformId: bigint;
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

  async findByIdentity(platform: Platform, platformId: bigint): Promise<User | null> {
    return this.client.user.findUnique({
      where: { platform_platformId: { platform, platformId } },
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
        platform: data.platform,
        platformId: data.platformId,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'user',
        referrerId: data.referrerId,
      },
    });
  }

  async findOrCreateByIdentity(data: CreateUserData): Promise<{ user: User; created: boolean }> {
    const existing = await this.client.user.findUnique({
      where: { platform_platformId: { platform: data.platform, platformId: data.platformId } },
    });
    if (existing) {
      return { user: existing, created: false };
    }
    try {
      const user = await this.client.user.create({
        data: {
          platform: data.platform,
          platformId: data.platformId,
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
          where: { platform_platformId: { platform: data.platform, platformId: data.platformId } },
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

  async updateRoleByIdentity(
    platform: Platform,
    platformId: bigint,
    role: UserRole
  ): Promise<User | null> {
    try {
      return await this.client.user.update({
        where: { platform_platformId: { platform, platformId } },
        data: { role },
      });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2025') return null;
      throw error;
    }
  }
}
