/**
 * Image compression utility using browser-image-compression.
 * Skips SVG and GIF (raster only). Use Web Worker by default.
 */

import imageCompression from 'browser-image-compression';

export interface CompressOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  useWebWorker?: boolean;
  onProgress?: (progress: number) => void;
}

export const COMPRESSION_PRESETS = {
  cover: { maxSizeMB: 0.5, maxWidthOrHeight: 1200 },
  poster: { maxSizeMB: 1, maxWidthOrHeight: 1920 },
  logo: { maxSizeMB: 0.2, maxWidthOrHeight: 400 },
  format: { maxSizeMB: 0.8, maxWidthOrHeight: 1440 },
} as const;

export type CompressionPresetKey = keyof typeof COMPRESSION_PRESETS;

/** Returns true if file is a raster image we should compress (not SVG/GIF). */
export function shouldCompress(file: File): boolean {
  const type = file.type?.toLowerCase() ?? '';
  if (type === 'image/svg+xml' || type === 'image/gif') return false;
  return type.startsWith('image/');
}

const defaultOptions: Required<Omit<CompressOptions, 'onProgress'>> = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  quality: 0.8,
  useWebWorker: true,
};

/**
 * Compress a raster image. Returns original file for SVG/GIF without compressing.
 */
export async function compressImage(file: File, options?: CompressOptions): Promise<File> {
  if (!shouldCompress(file)) return file;

  const opts = { ...defaultOptions, ...options };
  const libOptions = {
    maxSizeMB: opts.maxSizeMB,
    maxWidthOrHeight: opts.maxWidthOrHeight,
    useWebWorker: opts.useWebWorker,
    initialQuality: opts.quality,
    onProgress: opts.onProgress,
  };

  return imageCompression(file, libOptions);
}

export interface CompressWithPreviewResult {
  compressed: File;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  savings: string;
}

/**
 * Compress image and create object URL for preview. Caller must revoke previewUrl when done.
 * Pass onProgress in options to report compression progress (0–100).
 */
export async function compressImageWithPreview(
  file: File,
  options?: CompressOptions
): Promise<CompressWithPreviewResult> {
  const originalSize = file.size;

  if (!shouldCompress(file)) {
    const previewUrl = URL.createObjectURL(file);
    return {
      compressed: file,
      previewUrl,
      originalSize,
      compressedSize: file.size,
      savings: '0 B (0%)',
    };
  }

  const compressed = await compressImage(file, options);
  const compressedSize = compressed.size;
  const previewUrl = URL.createObjectURL(compressed);

  const saved = originalSize - compressedSize;
  const percent = originalSize > 0 ? Math.round((saved / originalSize) * 100) : 0;
  const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  };
  const savings =
    saved > 0
      ? `Сэкономлено: ${formatBytes(saved)} (${percent}%)`
      : `Сэкономлено: 0 B (0%)`;

  return {
    compressed,
    previewUrl,
    originalSize,
    compressedSize,
    savings,
  };
}

/**
 * Get image dimensions (width, height) from a File. Rejects if not an image.
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}
