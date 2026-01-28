import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { logger } from '../../shared/utils/logger';
import { IMAGE_LIMITS } from '../../shared/constants';

export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface ProcessedImage {
  originalPath: string;
  optimizedPath?: string;
  thumbnailPath?: string;
  originalUrl: string;
  optimizedUrl?: string;
  thumbnailUrl?: string;
  metadata: {
    width: number;
    height: number;
    size: number;
    format: string;
  };
}

export class ImageStorage {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(uploadDir: string = 'uploads', baseUrl: string = '/uploads') {
    this.uploadDir = uploadDir;
    this.baseUrl = baseUrl;
  }

  /**
   * Инициализация директорий для хранения изображений
   */
  async initialize(): Promise<void> {
    const dirs = [
      path.join(this.uploadDir, 'original'),
      path.join(this.uploadDir, 'optimized'),
      path.join(this.uploadDir, 'thumbnails'),
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        logger.error('Failed to create upload directory', { dir, error });
      }
    }

    logger.info('Image storage initialized', { uploadDir: this.uploadDir });
  }

  /**
   * Сохранение оригинального изображения
   */
  async saveOriginal(buffer: Buffer, filename: string): Promise<string> {
    const ext = path.extname(filename);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
    const filePath = path.join(this.uploadDir, 'original', uniqueName);

    await fs.writeFile(filePath, buffer);

    return filePath;
  }

  /**
   * Обработка изображения через Sharp
   */
  async processImage(
    buffer: Buffer,
    options: ImageProcessingOptions = {}
  ): Promise<Buffer> {
    let image = sharp(buffer);

    // Автоматическая коррекция ориентации по EXIF
    image = image.rotate();

    // Изменение размера
    if (options.width || options.height) {
      image = image.resize(options.width, options.height, {
        fit: options.fit || 'cover',
        withoutEnlargement: true,
      });
    }

    // Конвертация формата
    const format = options.format || 'webp';
    const quality = options.quality || 80;

    switch (format) {
      case 'webp':
        image = image.webp({ quality });
        break;
      case 'jpeg':
        image = image.jpeg({ quality, mozjpeg: true });
        break;
      case 'png':
        image = image.png({ quality, compressionLevel: 9 });
        break;
    }

    return image.toBuffer();
  }

  /**
   * Полная обработка изображения (оригинал + оптимизированная версия + thumbnail)
   */
  async processAndSave(
    buffer: Buffer,
    originalFilename: string,
    options?: {
      optimize?: boolean;
      thumbnail?: boolean;
      optimizeOptions?: ImageProcessingOptions;
      thumbnailOptions?: ImageProcessingOptions;
    }
  ): Promise<ProcessedImage> {
    // Валидация размера файла
    if (buffer.length > IMAGE_LIMITS.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${IMAGE_LIMITS.MAX_FILE_SIZE} bytes`);
    }

    // Получаем метаданные оригинального изображения
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image file');
    }

    // Проверяем размеры
    if (metadata.width > IMAGE_LIMITS.MAX_WIDTH || metadata.height > IMAGE_LIMITS.MAX_HEIGHT) {
      throw new Error(`Image dimensions exceed maximum allowed size`);
    }

    // Сохраняем оригинал
    const originalPath = await this.saveOriginal(buffer, originalFilename);
    const originalUrl = this.getUrl(originalPath);

    let optimizedPath: string | undefined;
    let optimizedUrl: string | undefined;
    let thumbnailPath: string | undefined;
    let thumbnailUrl: string | undefined;

    // Создаем оптимизированную версию
    if (options?.optimize !== false) {
      const optimizeOptions: ImageProcessingOptions = {
        width: IMAGE_LIMITS.OPTIMIZED_WIDTH,
        height: IMAGE_LIMITS.OPTIMIZED_HEIGHT,
        format: 'webp',
        quality: 80,
        fit: 'inside',
        ...options?.optimizeOptions,
      };

      const optimizedBuffer = await this.processImage(buffer, optimizeOptions);
      const ext = path.extname(originalFilename);
      const optimizedName = path.basename(originalPath, ext) + '.webp';
      optimizedPath = path.join(this.uploadDir, 'optimized', optimizedName);
      await fs.writeFile(optimizedPath, optimizedBuffer);
      optimizedUrl = this.getUrl(optimizedPath);
    }

    // Создаем thumbnail
    if (options?.thumbnail !== false) {
      const thumbnailOptions: ImageProcessingOptions = {
        width: IMAGE_LIMITS.THUMBNAIL_WIDTH,
        height: IMAGE_LIMITS.THUMBNAIL_HEIGHT,
        format: 'webp',
        quality: 75,
        fit: 'cover',
        ...options?.thumbnailOptions,
      };

      const thumbnailBuffer = await this.processImage(buffer, thumbnailOptions);
      const ext = path.extname(originalFilename);
      const thumbnailName = path.basename(originalPath, ext) + '-thumb.webp';
      thumbnailPath = path.join(this.uploadDir, 'thumbnails', thumbnailName);
      await fs.writeFile(thumbnailPath, thumbnailBuffer);
      thumbnailUrl = this.getUrl(thumbnailPath);
    }

    return {
      originalPath,
      optimizedPath,
      thumbnailPath,
      originalUrl,
      optimizedUrl,
      thumbnailUrl,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        size: buffer.length,
        format: metadata.format || 'unknown',
      },
    };
  }

  /**
   * Удаление изображения
   */
  async deleteImage(imagePath: string): Promise<void> {
    try {
      await fs.unlink(imagePath);

      // Пытаемся удалить оптимизированную версию и thumbnail
      const ext = path.extname(imagePath);
      const baseName = path.basename(imagePath, ext);

      const optimizedPath = path.join(this.uploadDir, 'optimized', baseName + '.webp');
      const thumbnailPath = path.join(this.uploadDir, 'thumbnails', baseName + '-thumb.webp');

      try {
        await fs.unlink(optimizedPath);
      } catch {
        // Игнорируем ошибки
      }

      try {
        await fs.unlink(thumbnailPath);
      } catch {
        // Игнорируем ошибки
      }
    } catch (error) {
      logger.error('Failed to delete image', { imagePath, error });
      throw error;
    }
  }

  /**
   * Получение URL для изображения
   */
  private getUrl(filePath: string): string {
    const relativePath = path.relative(this.uploadDir, filePath);
    return `${this.baseUrl}/${relativePath.replace(/\\/g, '/')}`;
  }

  /**
   * Получение пути из URL
   */
  getPathFromUrl(url: string): string {
    const relativePath = url.replace(this.baseUrl + '/', '');
    return path.join(this.uploadDir, relativePath);
  }
}
