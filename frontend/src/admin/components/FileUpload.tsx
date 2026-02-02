import { useState, useRef, useCallback, useEffect, ChangeEvent, DragEvent } from 'react';
import {
  compressImageWithPreview,
  getImageDimensions,
  COMPRESSION_PRESETS,
  type CompressionPresetKey,
  type CompressOptions,
} from '../../utils/imageCompression';
import './FileUpload.css';

const MAX_INPUT_MB = 10;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 100;
const SMALL_IMAGE_PX = 480;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

interface FileUploadProps {
  onUpload: (url: string) => void;
  currentImage?: string;
  accept?: string;
  maxSize?: number; // в MB
  preset?: CompressionPresetKey;
}

export default function FileUpload({
  onUpload,
  currentImage,
  accept = 'image/*',
  maxSize = MAX_INPUT_MB,
  preset = 'poster',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentImage);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [savings, setSavings] = useState<string>('');
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const previewObjectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const revokePreviewUrl = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => revokePreviewUrl();
  }, [revokePreviewUrl]);

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
    if (files && files.length > 0) handleFile(files[0]);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFile(files[0]);
  };

  const handleFile = async (file: File) => {
    setError('');
    setSizeWarning(null);
    revokePreviewUrl();
    setPreviewUrl(undefined);
    setOriginalSize(null);
    setCompressedSize(null);
    setSavings('');

    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение');
      return;
    }

    const fileSizeMB = file.size / 1024 / 1024;
    if (fileSizeMB > maxSize) {
      setError(`Размер файла не должен превышать ${maxSize} MB`);
      return;
    }

    if (fileSizeMB > MAX_INPUT_MB) {
      setError(`Максимальный размер загрузки: ${MAX_INPUT_MB} MB`);
      return;
    }

    try {
      const { width, height } = await getImageDimensions(file);
      if (width < MIN_WIDTH || height < MIN_HEIGHT) {
        setError(`Минимальный размер изображения: ${MIN_WIDTH}×${MIN_HEIGHT} px`);
        return;
      }
      if (width < SMALL_IMAGE_PX || height < SMALL_IMAGE_PX) {
        setSizeWarning(`Изображение небольшое (${width}×${height} px). Рекомендуется не менее ${SMALL_IMAGE_PX} px по стороне.`);
      }
    } catch {
      setError('Не удалось прочитать размеры изображения');
      return;
    }

    try {
      setIsUploading(true);
      setCompressionProgress(0);

      const presetOpts = COMPRESSION_PRESETS[preset];
      const options: CompressOptions = {
        ...presetOpts,
        quality: 0.8,
        useWebWorker: true,
        onProgress: (p) => setCompressionProgress(p),
      };

      const result = await compressImageWithPreview(file, options);
      revokePreviewUrl();
      previewObjectUrlRef.current = result.previewUrl;

      setPreviewUrl(result.previewUrl);
      setOriginalSize(result.originalSize);
      setCompressedSize(result.compressedSize);
      setSavings(result.savings);
      setCompressionProgress(100);

      const dataUrl = await fileToDataUrl(result.compressed);
      onUpload(dataUrl);
    } catch (err) {
      console.error('Ошибка при обработке файла:', err);
      setError('Не удалось обработать файл');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    revokePreviewUrl();
    setPreviewUrl(undefined);
    setOriginalSize(null);
    setCompressedSize(null);
    setSavings('');
    setSizeWarning(null);
    onUpload('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const displayPreview = previewUrl ?? currentImage;

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload ${isDragging ? 'file-upload--dragover' : ''} ${
          displayPreview ? 'file-upload--has-preview' : ''
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
                style={{ width: `${compressionProgress}%` }}
              />
            </div>
            <p className="file-upload__progress-text">Сжатие: {compressionProgress}%</p>
          </div>
        ) : displayPreview ? (
          <div className="file-upload__preview">
            <img
              src={displayPreview}
              alt="Превью"
              className="file-upload__image"
            />
            <button
              className="file-upload__remove"
              onClick={handleRemove}
              type="button"
              aria-label="Удалить"
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
            {(originalSize != null || compressedSize != null) && (
              <div className="file-upload__sizes">
                {originalSize != null && (
                  <span className="file-upload__size file-upload__size--before">
                    Было: {formatSize(originalSize)}
                  </span>
                )}
                {compressedSize != null && (
                  <span className="file-upload__size file-upload__size--after">
                    Стало: {formatSize(compressedSize)}
                  </span>
                )}
                {savings && (
                  <span className="file-upload__savings">{savings}</span>
                )}
              </div>
            )}
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
              JPG, PNG, WebP. Макс. {maxSize} MB, мин. {MIN_WIDTH}×{MIN_HEIGHT} px
            </p>
          </div>
        )}
      </div>

      {sizeWarning && (
        <p className="file-upload__warning">{sizeWarning}</p>
      )}
      {error && <p className="file-upload__error">{error}</p>}
    </div>
  );
}
