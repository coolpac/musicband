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
}
