import { prisma } from '../../../config/database';

export interface OnboardingAnswerRow {
  id: string;
  telegramId: bigint;
  role: string;
  createdAt: Date;
}

export interface IOnboardingRepository {
  findByTelegramId(telegramId: bigint): Promise<OnboardingAnswerRow | null>;
  create(telegramId: bigint, role: string): Promise<OnboardingAnswerRow>;
  /** Кол-во пользователей (в таблице users) с определённой onboarding-ролью */
  countUsersByRole(role: string): Promise<number>;
  /** Общее кол-во пользователей в таблице users */
  countAllUsers(): Promise<number>;
}

export class PrismaOnboardingRepository implements IOnboardingRepository {
  async findByTelegramId(telegramId: bigint): Promise<OnboardingAnswerRow | null> {
    const row = await prisma.onboardingAnswer.findUnique({
      where: { telegramId },
    });
    return row;
  }

  async create(telegramId: bigint, role: string): Promise<OnboardingAnswerRow> {
    const row = await prisma.onboardingAnswer.create({
      data: { telegramId, role },
    });
    return row;
  }

  async countUsersByRole(role: string): Promise<number> {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM users u
      INNER JOIN onboarding_answers oa ON oa.telegram_id = u.telegram_id
      WHERE oa.role = ${role}
    `;
    return Number(result[0].count);
  }

  async countAllUsers(): Promise<number> {
    return prisma.user.count();
  }
}
