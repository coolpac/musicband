import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { logger } from '../../shared/utils/logger';
import { IMAGE_LIMITS } from '../../shared/constants';

/** Размеры для responsive srcSet */
const RESPONSIVE_WIDTHS = IMAGE_LIMITS.RESPONSIVE_WIDTHS;
const DEFAULT_RESPONSIVE_WIDTH = 960; // для webpUrl / avifUrl

export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/** Результат обработки: плоские URL + srcSet для <picture> */
export interface ProcessedImage {
  originalPath: string;
  originalUrl: string;
  /** Legacy: один URL оптимизированной версии (960 WebP) */
  optimizedPath?: string;
  optimizedUrl?: string;
  /** URL варианта WebP 960 (для обратной совместимости и fallback) */
  webpUrl?: string;
  /** URL варианта AVIF 960 */
  avifUrl?: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  /** srcSet-ready строки для <picture><source srcSet="..."> */
  srcSet?: {
    webp: string;
    avif: string;
  };
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
   * uploads/original | webp | avif | thumb
   */
  async initialize(): Promise<void> {
    const dirs = [
      path.join(this.uploadDir, 'original'),
      path.join(this.uploadDir, 'webp'),
      path.join(this.uploadDir, 'avif'),
      path.join(this.uploadDir, 'thumb'),
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
   * Сохранение оригинального изображения (без перекодирования)
   */
  async saveOriginal(buffer: Buffer, filename: string): Promise<string> {
    const ext = path.extname(filename);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
    const filePath = path.join(this.uploadDir, 'original', uniqueName);

    await fs.writeFile(filePath, buffer);

    return filePath;
  }

  /**
   * Один проход Sharp: rotate (EXIF) → resize (withoutEnlargement) → формат.
   * Метаданные не копируются (Sharp по умолчанию не выводит EXIF в webp/avif).
   */
  private async processPipeline(
    buffer: Buffer,
    options: {
      width?: number;
      height?: number;
      format: 'webp' | 'avif';
      quality: number;
      fit?: 'cover' | 'inside';
    }
  ): Promise<Buffer> {
    let pipeline = sharp(buffer)
      .rotate() // auto EXIF orientation
      .resize(options.width ?? undefined, options.height ?? undefined, {
        fit: options.fit ?? 'inside',
        withoutEnlargement: true,
      });

    if (options.format === 'webp') {
      pipeline = pipeline.webp({ quality: options.quality });
    } else {
      pipeline = pipeline.avif({ quality: options.quality });
    }

    return pipeline.toBuffer();
  }

  /**
   * Полная обработка: original + responsive WebP/AVIF (480, 960, 1920) + thumbnail 200x200.
   * Обработки выполняются параллельно; ошибка одного формата не роняет весь запрос.
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
    if (buffer.length > IMAGE_LIMITS.MAX_FILE_SIZE) {
      throw new Error(
        `File size exceeds maximum allowed size of ${IMAGE_LIMITS.MAX_FILE_SIZE} bytes`
      );
    }

    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image file');
    }
    if (
      metadata.width > IMAGE_LIMITS.MAX_WIDTH ||
      metadata.height > IMAGE_LIMITS.MAX_HEIGHT
    ) {
      throw new Error('Image dimensions exceed maximum allowed size');
    }

    const originalPath = await this.saveOriginal(buffer, originalFilename);
    const originalUrl = this.getUrl(originalPath);
    const ext = path.extname(originalFilename);
    const baseId = path.basename(originalPath, ext);

    const webpQuality = IMAGE_LIMITS.WEBP_QUALITY;
    const avifQuality = IMAGE_LIMITS.AVIF_QUALITY;

    type Written = { path: string; url: string };
    const writtenWebp: Record<number, Written> = {};
    const writtenAvif: Record<number, Written> = {};
    let thumbnailPath: string | undefined;
    let thumbnailUrl: string | undefined;

    const tasks: Array<() => Promise<void>> = [];

    // Thumbnail 200x200 cover WebP
    if (options?.thumbnail !== false) {
      tasks.push(async () => {
        try {
          const thumbBuffer = await sharp(buffer)
            .rotate()
            .resize(IMAGE_LIMITS.THUMBNAIL_WIDTH, IMAGE_LIMITS.THUMBNAIL_HEIGHT, {
              fit: 'cover',
              withoutEnlargement: true,
            })
            .webp({ quality: 75 })
            .toBuffer();
          const name = `${baseId}-thumb.webp`;
          const fullPath = path.join(this.uploadDir, 'thumb', name);
          await fs.writeFile(fullPath, thumbBuffer);
          thumbnailPath = fullPath;
          thumbnailUrl = this.getUrl(fullPath);
        } catch (err) {
          logger.error('Thumbnail generation failed', { baseId, error: err });
        }
      });
    }

    // Responsive: WebP и AVIF для 480, 960, 1920
    if (options?.optimize !== false) {
      for (const width of RESPONSIVE_WIDTHS) {
        tasks.push(async () => {
          try {
            const [webpBuf, avifBuf] = await Promise.all([
              this.processPipeline(buffer, {
                width,
                format: 'webp',
                quality: webpQuality,
                fit: 'inside',
              }),
              this.processPipeline(buffer, {
                width,
                format: 'avif',
                quality: avifQuality,
                fit: 'inside',
              }),
            ]);
            const webpName = `${baseId}-${width}.webp`;
            const avifName = `${baseId}-${width}.avif`;
            const webpFullPath = path.join(this.uploadDir, 'webp', webpName);
            const avifFullPath = path.join(this.uploadDir, 'avif', avifName);
            await Promise.all([
              fs.writeFile(webpFullPath, webpBuf),
              fs.writeFile(avifFullPath, avifBuf),
            ]);
            writtenWebp[width] = { path: webpFullPath, url: this.getUrl(webpFullPath) };
            writtenAvif[width] = { path: avifFullPath, url: this.getUrl(avifFullPath) };
          } catch (err) {
            logger.error('Responsive variant generation failed', {
              baseId,
              width,
              error: err,
            });
          }
        });
      }
    }

    await Promise.all(tasks.map((t) => t()));

    // Собираем srcSet строки (только успешно созданные)
    const webpParts = RESPONSIVE_WIDTHS.filter((w) => writtenWebp[w])
      .map((w) => `${writtenWebp[w].url} ${w}w`)
      .join(', ');
    const avifParts = RESPONSIVE_WIDTHS.filter((w) => writtenAvif[w])
      .map((w) => `${writtenAvif[w].url} ${w}w`)
      .join(', ');

    const defaultWebp = writtenWebp[DEFAULT_RESPONSIVE_WIDTH]?.url ?? Object.values(writtenWebp)[0]?.url;
    const defaultAvif = writtenAvif[DEFAULT_RESPONSIVE_WIDTH]?.url ?? Object.values(writtenAvif)[0]?.url;
    const optimizedPath = writtenWebp[DEFAULT_RESPONSIVE_WIDTH]?.path;

    return {
      originalPath,
      originalUrl,
      optimizedPath,
      optimizedUrl: defaultWebp ?? undefined,
      webpUrl: defaultWebp,
      avifUrl: defaultAvif,
      thumbnailPath,
      thumbnailUrl,
      srcSet:
        webpParts || avifParts
          ? {
              webp: webpParts,
              avif: avifParts,
            }
          : undefined,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        size: buffer.length,
        format: metadata.format ?? 'unknown',
      },
    };
  }

  /**
   * Извлечение baseId из пути (original/xxx.jpg → xxx, webp/xxx-960.webp → xxx, thumb/xxx-thumb.webp → xxx)
   */
  private getBaseIdFromPath(filePath: string): string {
    const base = path.basename(filePath);
    const fromThumb = base.replace(/-thumb\.webp$/i, '');
    if (fromThumb !== base) return fromThumb;
    const fromResponsive = base.replace(/-\d+\.(webp|avif)$/i, '');
    if (fromResponsive !== base) return fromResponsive;
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * Удаление изображения и всех производных (original, webp, avif, thumb)
   * Принимает путь к любому варианту — по нему вычисляется baseId и удаляются все файлы.
   */
  async deleteImage(imagePath: string): Promise<void> {
    const baseId = this.getBaseIdFromPath(imagePath);

    const toDelete: string[] = [
      path.join(this.uploadDir, 'original', `${baseId}.jpg`),
      path.join(this.uploadDir, 'original', `${baseId}.jpeg`),
      path.join(this.uploadDir, 'original', `${baseId}.png`),
      path.join(this.uploadDir, 'original', `${baseId}.webp`),
      path.join(this.uploadDir, 'original', `${baseId}.gif`),
      path.join(this.uploadDir, 'thumb', `${baseId}-thumb.webp`),
      ...RESPONSIVE_WIDTHS.flatMap((w) => [
        path.join(this.uploadDir, 'webp', `${baseId}-${w}.webp`),
        path.join(this.uploadDir, 'avif', `${baseId}-${w}.avif`),
      ]),
    ];

    // Удаляем переданный путь отдельно, т.к. расширение оригинала может быть любым
    if (!toDelete.includes(imagePath)) {
      toDelete.unshift(imagePath);
    }

    for (const p of toDelete) {
      try {
        await fs.unlink(p);
      } catch {
        // ignore missing files
      }
    }
  }

  private getUrl(filePath: string): string {
    const relativePath = path.relative(this.uploadDir, filePath);
    return `${this.baseUrl}/${relativePath.replace(/\\/g, '/')}`;
  }

  getPathFromUrl(url: string): string {
    const relativePath = url.replace(this.baseUrl + '/', '');
    return path.join(this.uploadDir, relativePath);
  }
}
