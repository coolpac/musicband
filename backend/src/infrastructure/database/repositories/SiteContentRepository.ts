import { Prisma, PrismaClient, SiteContent } from '@prisma/client';
import { prisma } from '../../../config/database';

export interface ISiteContentRepository {
  findAll(): Promise<SiteContent[]>;
  findBySection(section: string): Promise<SiteContent | null>;
  upsert(section: string, value: Prisma.InputJsonValue): Promise<SiteContent>;
}

/**
 * Контент публичного сайта: одна строка на секцию. Хранится только то, что админ
 * реально изменил — дефолты живут во фронтенде и мержатся поверх при рендере.
 */
export class PrismaSiteContentRepository implements ISiteContentRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<SiteContent[]> {
    return this.client.siteContent.findMany({
      orderBy: { section: 'asc' },
    });
  }

  async findBySection(section: string): Promise<SiteContent | null> {
    return this.client.siteContent.findUnique({
      where: { section },
    });
  }

  async upsert(section: string, value: Prisma.InputJsonValue): Promise<SiteContent> {
    return this.client.siteContent.upsert({
      where: { section },
      create: { section, value },
      update: { value },
    });
  }
}
