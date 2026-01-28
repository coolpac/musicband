import QRCode from 'qrcode';
import { logger } from '../../shared/utils/logger';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Генерация QR-кода в виде Data URL (для отображения в браузере)
 */
export async function generateQRCodeDataURL(
  text: string,
  options: QRCodeOptions = {}
): Promise<string> {
  try {
    const defaultOptions = {
      width: options.width || 300,
      margin: options.margin || 2,
      color: {
        dark: options.color?.dark || '#000000',
        light: options.color?.light || '#FFFFFF',
      },
    };

    const dataURL = await QRCode.toDataURL(text, defaultOptions);
    return dataURL;
  } catch (error) {
    logger.error('Error generating QR code', { error, text });
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Генерация QR-кода в виде Buffer (для сохранения в файл)
 */
export async function generateQRCodeBuffer(
  text: string,
  options: QRCodeOptions = {}
): Promise<Buffer> {
  try {
    const defaultOptions = {
      width: options.width || 300,
      margin: options.margin || 2,
      color: {
        dark: options.color?.dark || '#000000',
        light: options.color?.light || '#FFFFFF',
      },
    };

    const buffer = await QRCode.toBuffer(text, defaultOptions);
    return buffer;
  } catch (error) {
    logger.error('Error generating QR code buffer', { error, text });
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Генерация deep link для Telegram Mini App
 */
export function generateTelegramDeepLink(
  botUsername: string,
  startParam: string
): string {
  // Формат: https://t.me/{bot_username}?start={start_param}
  return `https://t.me/${botUsername}?start=${startParam}`;
}

/**
 * Генерация QR-кода для сессии голосования
 */
export async function generateVotingSessionQR(
  sessionId: string,
  botUsername: string,
  options: QRCodeOptions = {}
): Promise<{
  qrCodeDataURL: string;
  deepLink: string;
  qrCodeBuffer?: Buffer;
}> {
  const startParam = `vote_${sessionId}`;
  const deepLink = generateTelegramDeepLink(botUsername, startParam);

  const qrCodeDataURL = await generateQRCodeDataURL(deepLink, options);
  const qrCodeBuffer = await generateQRCodeBuffer(deepLink, options);

  return {
    qrCodeDataURL,
    deepLink,
    qrCodeBuffer,
  };
}
