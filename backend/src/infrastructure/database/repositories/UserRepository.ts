import { PrismaClient, User, UserRole } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface IUserRepository {
  findByTelegramId(telegramId: bigint): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
  updateRole(id: string, role: UserRole): Promise<User>;
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
}
