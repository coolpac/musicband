import QRCode from 'qrcode';
import type { Platform } from '@prisma/client';
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
 * Нормализует username Telegram-бота:
 * - удаляет @
 * - поддерживает ввод вида https://t.me/username
 * - fallback на значение по умолчанию
 */
export function normalizeTelegramBotUsername(
  raw: string | undefined | null,
  fallback = 'vgulbot'
): string {
  const value = (raw || '').trim();
  if (!value) return fallback;

  const cleaned = value
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^t\.me\//i, '')
    .replace(/^@+/, '')
    .replace(/\/+$/, '');

  return cleaned || fallback;
}

/**
 * Нормализует username Max-бота (зеркало normalizeTelegramBotUsername):
 * - удаляет @
 * - поддерживает ввод вида https://max.ru/username
 * - fallback на configured MAX_USER_BOT_USERNAME (или явный аргумент)
 *
 * Max-боты имеют username вида id744719465529_bot.
 */
export function normalizeMaxBotUsername(
  raw: string | undefined | null,
  fallback = process.env.MAX_USER_BOT_USERNAME || ''
): string {
  const value = (raw || '').trim();
  if (!value) return fallback;

  const cleaned = value
    .replace(/^https?:\/\/max\.ru\//i, '')
    .replace(/^max\.ru\//i, '')
    .replace(/^@+/, '')
    .replace(/\/+$/, '');

  return cleaned || fallback;
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
 * Генерация deep link для Telegram бота (команда /start)
 * Формат: https://t.me/{bot_username}?start={start_param}
 */
export function generateTelegramBotDeepLink(botUsername: string, startParam: string): string {
  const username = normalizeTelegramBotUsername(botUsername);
  return `https://t.me/${username}?start=${startParam}`;
}

/**
 * Генерация direct link для Telegram Mini App с параметрами
 * Формат: https://t.me/{bot_username}/{app_name}?startapp={start_param}
 *
 * ВАЖНО: Только этот формат передаёт параметры в Mini App через start_param!
 * web_app кнопки НЕ поддерживают передачу параметров через URL query string.
 */
export function generateTelegramMiniAppDirectLink(
  botUsername: string,
  appName: string,
  startParam: string
): string {
  const username = normalizeTelegramBotUsername(botUsername);
  return `https://t.me/${username}/${appName}?startapp=${startParam}`;
}

/**
 * Опции построения платформенного deep link.
 * - telegram: miniAppName задаёт direct link Mini App (t.me/bot/app?startapp=...).
 * - max: miniApp=true задаёт launch Mini App (max.ru/bot?startapp=...).
 */
export interface DeepLinkOptions {
  /** Telegram: имя Mini App для direct link (t.me/bot/<app>?startapp=...). */
  miniAppName?: string;
  /** Max: использовать вариант запуска Mini App (?startapp=) вместо ?start=. */
  miniApp?: boolean;
}

/**
 * Платформо-зависимое построение deep link.
 *
 * telegram → https://t.me/<bot>?start=<payload>
 *            (или https://t.me/<bot>/<app>?startapp=<payload>, если задан miniAppName)
 *            — байт-в-байт совпадает с generateTelegramBotDeepLink /
 *            generateTelegramMiniAppDirectLink.
 * max      → https://max.ru/<bot>?start=<payload>
 *            (или https://max.ru/<bot>?startapp=<payload>, если miniApp=true).
 */
export function buildDeepLink(
  platform: Platform,
  botUsername: string,
  payload: string,
  options: DeepLinkOptions = {}
): string {
  if (platform === 'max') {
    const username = normalizeMaxBotUsername(botUsername);
    return options.miniApp
      ? `https://max.ru/${username}?startapp=${payload}`
      : `https://max.ru/${username}?start=${payload}`;
  }

  // telegram (default): сохраняем существующее поведение байт-в-байт.
  return options.miniAppName
    ? generateTelegramMiniAppDirectLink(botUsername, options.miniAppName, payload)
    : generateTelegramBotDeepLink(botUsername, payload);
}

/**
 * Генерация QR-кода для сессии голосования
 *
 * Если указан miniAppName — генерирует direct link (t.me/bot/app?startapp=...)
 * который сразу открывает Mini App с параметрами.
 *
 * Если miniAppName не указан — генерирует bot deep link (t.me/bot?start=...)
 * который открывает чат с ботом и отправляет команду /start.
 */
export async function generateVotingSessionQR(
  sessionId: string,
  botUsername: string,
  options: QRCodeOptions = {},
  miniAppName?: string
): Promise<{
  qrCodeDataURL: string;
  deepLink: string;
  qrCodeBuffer?: Buffer;
}> {
  const startParam = `vote_${sessionId}`;

  // Предпочитаем direct link если есть имя Mini App
  const deepLink = miniAppName
    ? generateTelegramMiniAppDirectLink(botUsername, miniAppName, startParam)
    : generateTelegramBotDeepLink(botUsername, startParam);

  const qrCodeDataURL = await generateQRCodeDataURL(deepLink, options);
  const qrCodeBuffer = await generateQRCodeBuffer(deepLink, options);

  return {
    qrCodeDataURL,
    deepLink,
    qrCodeBuffer,
  };
}

/**
 * Генерация QR-кода сессии голосования для КОНКРЕТНОЙ платформы.
 *
 * Строит платформо-зависимый deep link (через buildDeepLink) и кодирует его в QR.
 * Telegram-ветка с теми же аргументами даёт тот же deepLink, что и
 * generateVotingSessionQR (t.me/bot?start=vote_<id> либо t.me/bot/<app>?startapp=...).
 * Max-ветка кодирует max.ru-ссылку.
 */
export async function generateVotingSessionQRForPlatforms(
  sessionId: string,
  platform: Platform,
  botUsername: string,
  options: QRCodeOptions & DeepLinkOptions = {}
): Promise<{
  qrCodeDataURL: string;
  deepLink: string;
  qrCodeBuffer: Buffer;
}> {
  const { miniAppName, miniApp, ...qrOptions } = options;
  const startParam = `vote_${sessionId}`;

  const deepLink = buildDeepLink(platform, botUsername, startParam, { miniAppName, miniApp });

  const qrCodeDataURL = await generateQRCodeDataURL(deepLink, qrOptions);
  const qrCodeBuffer = await generateQRCodeBuffer(deepLink, qrOptions);

  return {
    qrCodeDataURL,
    deepLink,
    qrCodeBuffer,
  };
}
