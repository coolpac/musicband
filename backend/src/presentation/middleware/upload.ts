import multer from 'multer';
import { Request } from 'express';
import { ValidationError } from '../../shared/errors';
import { IMAGE_LIMITS } from '../../shared/constants';

// Настройка хранилища для Multer (в памяти)
const storage = multer.memoryStorage();

// Фильтр файлов
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Проверяем MIME тип
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ValidationError(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`));
  }
};

// Настройка Multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: IMAGE_LIMITS.MAX_FILE_SIZE,
    files: 1,
  },
});

// Middleware для обработки ошибок Multer
export function handleUploadError(
  error: any,
  req: Request,
  res: any,
  next: any
): void {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: {
          message: `File size exceeds maximum allowed size of ${IMAGE_LIMITS.MAX_FILE_SIZE} bytes`,
          code: 'FILE_TOO_LARGE',
        },
      });
      return;
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        success: false,
        error: {
          message: 'Too many files',
          code: 'TOO_MANY_FILES',
        },
      });
      return;
    }
  }

  next(error);
}
