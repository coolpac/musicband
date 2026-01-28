import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import imageCompression from 'browser-image-compression';
import './FileUpload.css';

interface FileUploadProps {
  onUpload: (url: string) => void;
  currentImage?: string;
  accept?: string;
  maxSize?: number; // в MB
}

export default function FileUpload({
  onUpload,
  currentImage,
  accept = 'image/*',
  maxSize = 5,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState<string | undefined>(currentImage);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setError('');

    // Валидация типа файла
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение');
      return;
    }

    // Валидация размера
    const fileSizeMB = file.size / 1024 / 1024;
    if (fileSizeMB > maxSize) {
      setError(`Размер файла не должен превышать ${maxSize}MB`);
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(20);

      // Сжатие изображения
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        onProgress: (progress: number) => {
          setUploadProgress(20 + progress * 0.3); // 20-50%
        },
      };

      const compressedFile = await imageCompression(file, options);
      setUploadProgress(60);

      // Создание preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreview(result);
        setUploadProgress(80);

        // Симуляция загрузки на сервер
        // В реальном приложении здесь будет вызов uploadService
        setTimeout(() => {
          setUploadProgress(100);
          onUpload(result);
          setIsUploading(false);
        }, 500);
      };

      reader.readAsDataURL(compressedFile);
    } catch (err) {
      console.error('Ошибка при обработке файла:', err);
      setError('Не удалось обработать файл');
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(undefined);
    onUpload('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload ${isDragging ? 'file-upload--dragover' : ''} ${
          preview ? 'file-upload--has-preview' : ''
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        {isUploading ? (
          <div className="file-upload__loading">
            <div className="file-upload__progress-bar">
              <div
                className="file-upload__progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="file-upload__progress-text">{uploadProgress}%</p>
          </div>
        ) : preview ? (
          <div className="file-upload__preview">
            <img src={preview} alt="Preview" className="file-upload__image" />
            <button
              className="file-upload__remove"
              onClick={handleRemove}
              type="button"
              aria-label="Удалить изображение"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M15 5L5 15M5 5L15 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ) : (
          <div className="file-upload__placeholder">
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              className="file-upload__icon"
            >
              <path
                d="M24 12V36M12 24H36"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <p className="file-upload__text">
              Перетащите изображение сюда или нажмите для выбора
            </p>
            <p className="file-upload__hint">
              Поддерживаемые форматы: JPG, PNG, WebP (макс. {maxSize}MB)
            </p>
          </div>
        )}
      </div>

      {error && <p className="file-upload__error">{error}</p>}
    </div>
  );
}
