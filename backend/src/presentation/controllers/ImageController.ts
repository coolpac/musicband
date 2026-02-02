import { Request, Response, NextFunction } from 'express';
import { ImageStorage } from '../../infrastructure/storage/ImageStorage';
import { logger } from '../../shared/utils/logger';

export class ImageController {
  constructor(private imageStorage: ImageStorage) {}

  /**
   * POST /api/upload/image
   * Загрузить и обработать изображение
   */
  async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            message: 'No file uploaded',
            code: 'NO_FILE',
          },
        });
        return;
      }

      const buffer = req.file.buffer;
      const filename = req.file.originalname;

      // Обрабатываем изображение
      const result = await this.imageStorage.processAndSave(buffer, filename, {
        optimize: true,
        thumbnail: true,
      });

      logger.info('Image uploaded and processed', {
        originalUrl: result.originalUrl,
        webpUrl: result.webpUrl,
        avifUrl: result.avifUrl,
        thumbnailUrl: result.thumbnailUrl,
      });

      res.json({
        success: true,
        data: {
          original: {
            url: result.originalUrl,
            width: result.metadata.width,
            height: result.metadata.height,
            size: result.metadata.size,
          },
          originalUrl: result.originalUrl,
          webpUrl: result.webpUrl ?? undefined,
          avifUrl: result.avifUrl ?? undefined,
          thumbnailUrl: result.thumbnailUrl ?? undefined,
          srcSet: result.srcSet ?? undefined,
          optimized: result.optimizedUrl
            ? { url: result.optimizedUrl }
            : undefined,
          thumbnail: result.thumbnailUrl
            ? { url: result.thumbnailUrl }
            : undefined,
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * DELETE /api/upload/image
   * Удалить изображение
   */
  async deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { url } = req.body;

      if (!url) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Image URL is required',
            code: 'VALIDATION_ERROR',
          },
        });
        return;
      }

      const imagePath = this.imageStorage.getPathFromUrl(url);
      await this.imageStorage.deleteImage(imagePath);

      logger.info('Image deleted', { url });

      res.json({
        success: true,
        message: 'Image deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
