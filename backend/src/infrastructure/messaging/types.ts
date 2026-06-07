import type { Platform } from '@prisma/client';

export type { Platform };

/** Цель уведомления: платформа + идентификатор получателя на ней. */
export interface MessageTarget {
  platform: Platform;
  platformId: string;
}

/**
 * Уведомление пользователю о бронировании (получено / подтверждено).
 * Поля идентичны тем, что UserBot.sendBookingReceived / sendBookingConfirmation принимают сегодня.
 */
export interface BookingNotice {
  bookingDate: string;
  formatName?: string;
  fullName: string;
}

/**
 * Уведомление админам о новом бронировании.
 * Соответствует payload-у AdminBot.notifyNewBooking.
 */
export interface NewBookingNotice {
  id: string;
  bookingDate: string;
  formatName?: string;
  fullName: string;
  contactValue: string;
  city?: string;
  platform?: Platform;
  telegramId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

/** Человекочитаемая метка платформы для уведомлений админам. */
export function platformLabel(platform?: Platform): string {
  return platform === 'max' ? 'Max' : 'Telegram';
}

/**
 * Уведомление админам о новом пользователе.
 * Соответствует payload-у AdminBot.notifyNewUser.
 */
export interface NewUserNotice {
  platform: Platform;
  platformId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Данные песни-победителя голосования.
 * Соответствует winningSong в UserBot.sendVotingWinnerNotification.
 */
export interface SongNotice {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
}

/**
 * Кнопка рассылки (inline). Лифт из BotManager.broadcastToUsers / AdminBot.
 */
export interface BroadcastButton {
  text: string;
  url: string;
  kind: 'url' | 'web_app';
}

/**
 * Медиа-вложение рассылки.
 */
export interface BroadcastMedia {
  type: 'photo' | 'video' | 'document';
  fileId: string;
}

/**
 * Аудитория рассылки. Разрешение сегмента в список id остаётся в BotManager;
 * адаптер получает уже готовый список получателей.
 */
export type BroadcastSegment = 'all' | 'just_person' | 'organizer';

/**
 * Прогресс рассылки.
 */
export interface BroadcastProgress {
  sent: number;
  failed: number;
  total: number;
}

/**
 * Payload рассылки, который адаптер рассылает по уже разрешённому списку получателей.
 * Сегмент здесь не нужен — список id вычисляет BotManager и передаёт явно.
 */
export interface BroadcastPayload {
  text: string;
  buttons: BroadcastButton[];
  media?: BroadcastMedia;
  /**
   * Готовый HTTP(S)-URL медиа, разрешённый из media.fileId один раз в BotManager
   * (через Telegram admin-бота getFileLink). Нужен для кросс-платформенной доставки:
   * Telegram шлёт по этому URL (admin-овый file_id user-бот не примет), а Max
   * скачивает по URL и загружает к себе (uploadImage/uploadVideo).
   */
  mediaUrl?: string;
  onProgress?: (progress: BroadcastProgress) => Promise<void>;
}

/**
 * Результат отправки запроса отзыва (UserBot.sendReviewRequest).
 */
export interface ReviewRequestResult {
  sent: boolean;
  errorCode?: number;
  errorMessage?: string;
}

/**
 * Payload запроса отзыва (UserBot.sendReviewRequest).
 */
export interface ReviewNotice {
  bookingId: string;
  bookingDate: string;
  formatName?: string;
  fullName?: string;
}

/**
 * Результат пакетной отправки (follow-up / broadcast).
 */
export interface BatchSendResult {
  sent: number;
  failed: number;
}

/**
 * QR-код сессии голосования для рассылки админам платформы.
 * deepLink уже построен под конкретную платформу (t.me / max.ru), а qrPngBuffer
 * кодирует именно эту ссылку. BotManager строит QR per-platform и передаёт сюда готовый.
 */
export interface VotingQrNotice {
  sessionId: string;
  deepLink: string;
  qrPngBuffer: Buffer;
  requestedByAdminId?: string;
}

/**
 * Абстракция мессенджер-платформы. BotManager хранит реестр Map<Platform, PlatformBots>
 * и маршрутизирует уведомления в нужный адаптер.
 *
 * Адаптер отвечает за отправку конкретных сообщений (включая платформенный throttling
 * при пакетных рассылках). Разрешение аудитории/сегментов и работа с БД остаётся в BotManager.
 *
 * Идентификатор получателя — platformId в виде строки (Telegram chatId как строка).
 */
export interface PlatformBots {
  readonly platform: Platform;

  /** Запуск (для Telegram polling уже стартует в конструкторе ботов — no-op). */
  start(): Promise<void> | void;
  /** Остановка polling всех ботов платформы (graceful shutdown). */
  stop(): Promise<void> | void;

  // --- user-facing ---

  sendBookingReceived(platformId: string, booking: BookingNotice): Promise<void>;
  sendBookingConfirmation(platformId: string, booking: BookingNotice): Promise<void>;
  sendReviewRequest(platformId: string, review: ReviewNotice): Promise<ReviewRequestResult>;
  /**
   * Пакетная рассылка follow-up по уже разрешённому списку id с платформенным throttling.
   */
  sendVotingFollowUp(platformIds: string[], campaignDay: number): Promise<BatchSendResult>;
  sendVotingWinner(platformId: string, song: SongNotice, sessionId: string): Promise<void>;

  // --- admin-facing ---

  notifyNewBooking(booking: NewBookingNotice): Promise<void>;
  notifyNewUser(user: NewUserNotice): Promise<void>;
  /**
   * Рассылка по уже разрешённому списку получателей с платформенным throttling.
   */
  broadcast(platformIds: string[], payload: BroadcastPayload): Promise<BroadcastProgress>;
  /**
   * Разрешить медиа-идентификатор платформы в публичный HTTP(S)-URL (опционально).
   * Реализует Telegram (через admin-бота getFileLink): медиа рассылки хранится как
   * Telegram file_id, и BotManager один раз резолвит его в URL, чтобы доставить медиа
   * и в Telegram, и в Max. Платформы без такой возможности метод не реализуют.
   */
  resolveMediaUrl?(fileId: string): Promise<string | undefined>;
  sendCsvToAdmin(platformId: string, csv: Buffer, filename: string): Promise<void>;
  /**
   * Рассылка QR-кода сессии голосования админам этой платформы. deepLink/QR уже
   * построены под платформу (BotManager строит per-platform).
   */
  sendVotingQrToAdmins(notice: VotingQrNotice): Promise<void>;
}
