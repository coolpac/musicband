/**
 * Платформенный фасад: единый API поверх Telegram Mini Apps и Max Web App.
 *
 * Один и тот же UI работает как Mini App и в Telegram, и в Max. Фасад выбирает
 * нужный бекенд по тому, какой глобал присутствует в window:
 *   - Telegram → делегирует в `telegram/telegramWebApp.ts` БЕЗ изменения поведения;
 *   - Max      → делегирует в `platform/maxWebApp.ts`;
 *   - вне Mini App ('web') → безопасные no-op / fallback.
 *
 * Инвариант: при запуске внутри Telegram все вызовы идентичны тому, что было
 * до фасада (тот же модуль telegramWebApp, те же функции).
 */

import {
  isInsideTelegram,
  initTelegramWebApp,
  getInitData as tgGetInitData,
  getStartParam as tgGetStartParam,
  getTelegramUser,
  getTelegramUserId,
  openTelegramLink,
  openExternalLink as tgOpenExternalLink,
  hapticImpact as tgHapticImpact,
  hapticSelection as tgHapticSelection,
  hapticNotification as tgHapticNotification,
  showAlert as tgShowAlert,
  showConfirm as tgShowConfirm,
  getTelegramWebApp,
} from '../telegram/telegramWebApp';
import {
  isInsideMax,
  initMaxWebApp,
  getMaxInitData,
  getMaxStartParam,
  getMaxUser,
  getMaxUserId,
  openMaxMessengerLink,
  openMaxExternalLink,
  maxHapticImpact,
  maxHapticSelection,
  maxHapticNotification,
  showMaxBackButton,
  hideMaxBackButton,
  onMaxBackButtonClick,
} from './maxWebApp';

export type Platform = 'telegram' | 'max' | 'web';

export type PlatformUser = {
  firstName: string;
  lastName?: string;
  username?: string;
  fullName: string;
};

/**
 * Определить текущую платформу.
 *
 * Если по какой-то причине присутствуют ОБА глобала, предпочитаем Telegram:
 * исторически это Telegram-приложение, и parity с Telegram критичен. Max
 * добавлен поверх, поэтому при коллизии Telegram имеет приоритет.
 */
export function getPlatform(): Platform {
  if (isInsideTelegram()) return 'telegram';
  if (isInsideMax()) return 'max';
  return 'web';
}

/** Запущены ли мы внутри Mini App (Telegram или Max). */
export function isInsideMiniApp(): boolean {
  const p = getPlatform();
  return p === 'telegram' || p === 'max';
}

/** Инициализация под текущую платформу (ready/expand/viewport). */
export function init(): void {
  switch (getPlatform()) {
    case 'telegram':
      initTelegramWebApp();
      return;
    case 'max':
      initMaxWebApp();
      return;
    default:
      return;
  }
}

/** initData для серверной валидации (Telegram → /api/auth/telegram, Max → /api/auth/max). */
export function getInitData(): string | null {
  switch (getPlatform()) {
    case 'telegram':
      return tgGetInitData();
    case 'max':
      return getMaxInitData();
    default:
      return null;
  }
}

/** start_param из deep link. */
export function getStartParam(): string | null {
  switch (getPlatform()) {
    case 'telegram':
      return tgGetStartParam();
    case 'max':
      return getMaxStartParam();
    default:
      return null;
  }
}

/** Нормализованный пользователь (только для префилла UI). */
export function getUser(): PlatformUser | null {
  switch (getPlatform()) {
    case 'telegram':
      return getTelegramUser();
    case 'max':
      return getMaxUser();
    default:
      return null;
  }
}

/** ID пользователя из initDataUnsafe. */
export function getUserId(): number | null {
  switch (getPlatform()) {
    case 'telegram':
      return getTelegramUserId();
    case 'max':
      return getMaxUserId();
    default:
      return null;
  }
}

/** Открыть внешнюю ссылку (http/https) средствами платформы. */
export function openLink(url: string): void {
  switch (getPlatform()) {
    case 'telegram':
      tgOpenExternalLink(url);
      return;
    case 'max':
      openMaxExternalLink(url);
      return;
    default:
      window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** Открыть ссылку внутри мессенджера (TG openTelegramLink / Max openMaxLink). */
export function openMessengerLink(url: string): void {
  switch (getPlatform()) {
    case 'telegram':
      openTelegramLink(url);
      return;
    case 'max':
      openMaxMessengerLink(url);
      return;
    default:
      window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** Показать кнопку «Назад». */
export function showBackButton(): void {
  switch (getPlatform()) {
    case 'telegram': {
      const tg = getTelegramWebApp();
      tg?.BackButton?.show();
      return;
    }
    case 'max':
      showMaxBackButton();
      return;
    default:
      return;
  }
}

/** Скрыть кнопку «Назад». */
export function hideBackButton(): void {
  switch (getPlatform()) {
    case 'telegram': {
      const tg = getTelegramWebApp();
      tg?.BackButton?.hide();
      return;
    }
    case 'max':
      hideMaxBackButton();
      return;
    default:
      return;
  }
}

/** Подписка на кнопку «Назад». Возвращает функцию отписки. */
export function onBackButtonClick(handler: () => void): () => void {
  switch (getPlatform()) {
    case 'telegram': {
      const tg = getTelegramWebApp();
      if (!tg?.BackButton) return () => {};
      tg.BackButton.onClick(handler);
      return () => tg.BackButton.offClick(handler);
    }
    case 'max':
      return onMaxBackButtonClick(handler);
    default:
      return () => {};
  }
}

/** Хаптик: impact. На Max — no-op, если SDK не предоставляет HapticFeedback. */
export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  switch (getPlatform()) {
    case 'telegram':
      tgHapticImpact(style);
      return;
    case 'max':
      maxHapticImpact(style);
      return;
    default:
      return;
  }
}

/** Хаптик: selectionChanged. */
export function hapticSelection(): void {
  switch (getPlatform()) {
    case 'telegram':
      tgHapticSelection();
      return;
    case 'max':
      maxHapticSelection();
      return;
    default:
      return;
  }
}

/** Хаптик: notification. */
export function hapticNotification(type: 'success' | 'warning' | 'error'): void {
  switch (getPlatform()) {
    case 'telegram':
      tgHapticNotification(type);
      return;
    case 'max':
      maxHapticNotification(type);
      return;
    default:
      return;
  }
}

/** Нативный алерт (Telegram). Вне TG — window.alert (включая Max, где нативного алерта нет в SDK). */
export function showAlert(message: string): void {
  if (getPlatform() === 'telegram') {
    tgShowAlert(message);
    return;
  }
  window.alert(message);
}

/** Нативное подтверждение (Telegram). Вне TG — window.confirm. */
export function showConfirm(message: string): Promise<boolean> {
  if (getPlatform() === 'telegram') {
    return tgShowConfirm(message);
  }
  return Promise.resolve(window.confirm(message));
}
