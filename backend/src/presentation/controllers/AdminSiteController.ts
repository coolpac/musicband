import { Request, Response, NextFunction } from 'express';
import { SiteContentService } from '../../domain/services/SiteContentService';
import { isSiteSectionId, validateSectionBody } from '../../application/dto/site.dto';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';

export class AdminSiteController {
  constructor(private siteContentService: SiteContentService) {}

  /**
   * GET /api/admin/site/content
   * Всё, что админ когда-либо сохранял. Дефолты живут во фронтенде.
   */
  async getContent(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const content = await this.siteContentService.getAdminContent();
      res.json({
        success: true,
        data: content,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/site/content/:section
   * Тело — JSON секции целиком (белый список id, ≤ 256 КБ, глубокая проверка).
   */
  async updateSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { section } = req.params;
      if (!isSiteSectionId(section)) {
        throw new NotFoundError('Site section');
      }

      // Без этой проверки запрос с другим Content-Type дошёл бы сюда с пустым req.body
      // (express.json() его не разбирает) и молча затёр бы секцию объектом `{}`.
      if (!req.is('application/json')) {
        throw new ValidationError('Ожидается тело JSON', [
          { path: '.', message: 'Требуется заголовок Content-Type: application/json' },
        ]);
      }

      const value = validateSectionBody(req.body);
      const saved = await this.siteContentService.saveSection(section, value);

      logger.info('Site section updated by admin', {
        section,
        adminId: req.user?.userId,
      });

      res.json({
        success: true,
        data: saved,
      });
    } catch (error) {
      next(error);
    }
  }
}
