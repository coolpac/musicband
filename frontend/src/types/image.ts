/**
 * Формат изображения с сервера (upload API): original + srcSet + thumbnail.
 * Legacy: может быть просто строкой URL.
 */
export type ServerImage =
  | string
  | {
      original: string;
      srcSet?: { webp?: string; avif?: string };
      thumbnail?: string;
    };

/**
 * Приводит ServerImage к пропам для OptimizedImage.
 * Для строки возвращает { src }; для объекта — { src: original, srcSet }.
 */
export function getOptimizedImageProps(
  image: ServerImage | null | undefined
): { src: string; srcSet?: { webp?: string; avif?: string } } | null {
  if (image == null) return null;
  if (typeof image === 'string') return { src: image };
  if (typeof image === 'object' && 'original' in image) {
    return {
      src: image.original,
      srcSet: image.srcSet,
    };
  }
  return null;
}
