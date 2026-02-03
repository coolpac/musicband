/**
 * Telegram Mini Apps Web App API — утилиты и инициализация.
 * Документация: https://core.telegram.org/bots/webapps
 */

type TelegramWebApp = NonNullable<Window['Telegram']>['WebApp'];

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function isInsideTelegram(): boolean {
  return Boolean(getTelegramWebApp());
}

/** Инициализация при запуске в Telegram: ready, expand, fullscreen, отключение свайпа, цвета. */
export function initTelegramWebApp(): void {
  const tg = getTelegramWebApp();
  if (!tg) return;

  tg.ready();
  tg.expand();

  // Запрет закрытия свайпом по контенту (Bot API 7.7+)
  if (tg.disableVerticalSwipes) {
    tg.disableVerticalSwipes();
  }

  // Полноэкранный режим (Bot API 8.0+)
  if (tg.isVersionAtLeast?.('8.0') && tg.requestFullscreen) {
    tg.requestFullscreen();
  }

  // Цвета под тему Telegram
  if (tg.themeParams?.bg_color) {
    tg.setBackgroundColor(tg.themeParams.bg_color);
  }
  if (tg.themeParams?.secondary_bg_color ?? tg.themeParams?.bg_color) {
    tg.setHeaderColor(tg.themeParams.secondary_bg_color ?? tg.themeParams.bg_color ?? '#111111');
  }
  applyTelegramViewportAndSafeArea();
}

/**
 * Хаптик: impact — столкновение UI (кнопки, тапы).
 * Стили: light — лёгкие действия, medium — подтверждение, heavy — важные/деструктивные.
 * Вне Telegram вызов игнорируется. Не вызывать слишком часто — влияет на батарею.
 * @see https://docs.telegram-mini-apps.com/platform/haptic-feedback
 */
export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred(style);
}

/**
 * Хаптик: selectionChanged — смена выбора (слайдеры, табы, переключатели).
 * Только при изменении выбора, не при подтверждении.
 */
export function hapticSelection(): void {
  getTelegramWebApp()?.HapticFeedback?.selectionChanged();
}

/**
 * Хаптик: notification — результат действия (success / error / warning).
 * success — действие выполнено, error — ошибка, warning — предупреждение.
 */
export function hapticNotification(type: 'success' | 'warning' | 'error'): void {
  getTelegramWebApp()?.HapticFeedback?.notificationOccurred(type);
}

/** Показать нативный алерт Telegram (вне Telegram — fallback на window.alert). */
export function showAlert(message: string): void {
  const tg = getTelegramWebApp();
  if (tg?.showAlert) {
    tg.showAlert(message);
  } else {
    window.alert(message);
  }
}

/** Показать нативное подтверждение Telegram (вне Telegram — fallback на window.confirm). */
export function showConfirm(message: string): Promise<boolean> {
  const tg = getTelegramWebApp();
  if (tg?.showConfirm) {
    return new Promise((resolve) => {
      tg!.showConfirm!(message, (ok: boolean) => resolve(ok));
    });
  }
  return Promise.resolve(window.confirm(message));
}

/** Включить подтверждение при закрытии мини-приложения (свайп по шапке). */
export function enableClosingConfirmation(): void {
  getTelegramWebApp()?.enableClosingConfirmation?.();
}

/** Выключить подтверждение при закрытии. */
export function disableClosingConfirmation(): void {
  getTelegramWebApp()?.disableClosingConfirmation?.();
}

/** Открыть ссылку t.me/... внутри Telegram (чат, канал). Вне Telegram — window.open. */
export function openTelegramLink(url: string): void {
  const tg = getTelegramWebApp();
  if (tg?.openTelegramLink && /^https:\/\/t\.me\//i.test(url)) {
    tg.openTelegramLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** start_param из deep link (initDataUnsafe.start_param). */
export function getStartParam(): string | null {
  return getTelegramWebApp()?.initDataUnsafe?.start_param ?? null;
}

/** Telegram user ID из initDataUnsafe (для проверки pending vote session). */
export function getTelegramUserId(): number | null {
  const user = getTelegramWebApp()?.initDataUnsafe?.user;
  return user?.id ?? null;
}

/** Данные пользователя из initDataUnsafe (только для префилла UI; на бэке проверять initData). */
export function getTelegramUser(): { firstName: string; lastName?: string; username?: string; fullName: string } | null {
  const user = getTelegramWebApp()?.initDataUnsafe?.user;
  if (!user?.first_name) return null;
  const firstName = String(user.first_name);
  const lastName = user.last_name ? String(user.last_name) : undefined;
  const username = user.username ? String(user.username) : undefined;
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return { firstName, lastName, username, fullName };
}

/** Установить CSS-переменные safe area и viewport (вызывается при инициализации). */
export function applyTelegramViewportAndSafeArea(): void {
  const tg = getTelegramWebApp();
  if (!tg) return;
  const root = document.documentElement;
  root.classList.add('tg-mini-app');
  if (tg.safeAreaInset) {
    root.style.setProperty('--tg-safe-area-inset-top', `${tg.safeAreaInset.top}px`);
    root.style.setProperty('--tg-safe-area-inset-bottom', `${tg.safeAreaInset.bottom}px`);
    root.style.setProperty('--tg-safe-area-inset-left', `${tg.safeAreaInset.left}px`);
    root.style.setProperty('--tg-safe-area-inset-right', `${tg.safeAreaInset.right}px`);
  }
  if (typeof tg.viewportStableHeight === 'number') {
    root.style.setProperty('--tg-viewport-stable-height', `${tg.viewportStableHeight}px`);
  }
  if (typeof tg.viewportHeight === 'number') {
    root.style.setProperty('--tg-viewport-height', `${tg.viewportHeight}px`);
  }
  tg.onEvent?.('viewportChanged', () => {
    if (typeof tg.viewportStableHeight === 'number') {
      root.style.setProperty('--tg-viewport-stable-height', `${tg.viewportStableHeight}px`);
    }
    if (typeof tg.viewportHeight === 'number') {
      root.style.setProperty('--tg-viewport-height', `${tg.viewportHeight}px`);
    }
  });
}
