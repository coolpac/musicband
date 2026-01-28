import { apiClient } from './apiClient';

export interface UploadResponse {
  success: boolean;
  data: {
    url: string;
    filename: string;
    size: number;
    mimeType: string;
  };
}

/**
 * Загружает файл на сервер
 * @param file Файл для загрузки
 * @param onProgress Callback для отслеживания прогресса загрузки (0-100)
 * @returns URL загруженного файла
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    // В реальном приложении здесь будет XMLHttpRequest для отслеживания прогресса
    // или fetch с ReadableStream
    if (onProgress) {
      // Симуляция прогресса для demo
      const interval = setInterval(() => {
        const current = Math.min(
          (Date.now() % 1000) / 10,
          100
        );
        onProgress(current);
      }, 100);

      setTimeout(() => clearInterval(interval), 1000);
    }

    const response = await apiClient<UploadResponse>('/admin/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Не устанавливаем Content-Type, браузер сам установит с boundary
      },
    });

    if (!response.success) {
      throw new Error('Не удалось загрузить файл');
    }

    return response.data.url;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

/**
 * Загружает изображение на сервер
 * Специализированный метод для изображений с валидацией
 */
export async function uploadImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Валидация типа файла
  if (!file.type.startsWith('image/')) {
    throw new Error('Файл должен быть изображением');
  }

  // Валидация размера (макс 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('Размер файла не должен превышать 10MB');
  }

  return uploadFile(file, onProgress);
}

/**
 * Удаляет файл с сервера
 * @param url URL файла для удаления
 */
export async function deleteFile(url: string): Promise<void> {
  try {
    await apiClient('/admin/upload', {
      method: 'DELETE',
      body: JSON.stringify({ url }),
    });
  } catch (error) {
    console.error('Delete error:', error);
    throw error;
  }
}

/**
 * Загружает несколько файлов параллельно
 */
export async function uploadMultipleFiles(
  files: File[],
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<string[]> {
  const uploadPromises = files.map((file, index) =>
    uploadFile(file, (progress) => {
      if (onProgress) {
        onProgress(index, progress);
      }
    })
  );

  return Promise.all(uploadPromises);
}

/**
 * Создает Data URL из файла для preview
 */
export function createPreviewUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Проверяет, является ли строка валидным URL изображения
 */
export function isImageUrl(url: string): boolean {
  try {
    new URL(url);
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
  } catch {
    return false;
  }
}

/**
 * Получает размер файла в человекочитаемом формате
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
}

/**
 * Валидация MIME типов для изображений
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

/**
 * Валидация типа файла
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

/**
 * Валидация размера файла
 */
export function validateFileSize(file: File, maxSizeMB: number): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}
