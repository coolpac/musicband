import { Platform } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface OnboardingAnswerRow {
  id: string;
  platform: Platform;
  platformId: bigint;
  role: string;
  createdAt: Date;
}

export interface IOnboardingRepository {
  findByIdentity(platform: Platform, platformId: bigint): Promise<OnboardingAnswerRow | null>;
  create(platform: Platform, platformId: bigint, role: string): Promise<OnboardingAnswerRow>;
  /**
   * Кол-во пользователей (в таблице users) с определённой onboarding-ролью.
   * Опциональный platform-фильтр — чтобы каждый admin-бот показывал счётчик
   * только по своей платформе (telegram-бот → telegram-пользователи и т.д.).
   * Без фильтра считаем по всем платформам (обратная совместимость).
   */
  countUsersByRole(role: string, platform?: Platform): Promise<number>;
  /**
   * Общее кол-во пользователей в таблице users.
   * Опциональный platform-фильтр (см. countUsersByRole).
   */
  countAllUsers(platform?: Platform): Promise<number>;
}

export class PrismaOnboardingRepository implements IOnboardingRepository {
  async findByIdentity(
    platform: Platform,
    platformId: bigint
  ): Promise<OnboardingAnswerRow | null> {
    const row = await prisma.onboardingAnswer.findUnique({
      where: { platform_platformId: { platform, platformId } },
    });
    return row;
  }

  async create(platform: Platform, platformId: bigint, role: string): Promise<OnboardingAnswerRow> {
    const row = await prisma.onboardingAnswer.create({
      data: { platform, platformId, role },
    });
    return row;
  }

  async countUsersByRole(role: string, platform?: Platform): Promise<number> {
    // Платформенный фильтр опционален: без него считаем по всем платформам (как раньше).
    const result = platform
      ? await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count
          FROM users u
          INNER JOIN onboarding_answers oa ON oa.platform = u.platform AND oa.platform_id = u.platform_id
          WHERE oa.role = ${role} AND u.platform::text = ${platform}
        `
      : await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count
          FROM users u
          INNER JOIN onboarding_answers oa ON oa.platform = u.platform AND oa.platform_id = u.platform_id
          WHERE oa.role = ${role}
        `;
    return Number(result[0].count);
  }

  async countAllUsers(platform?: Platform): Promise<number> {
    return prisma.user.count(platform ? { where: { platform } } : undefined);
  }
}
