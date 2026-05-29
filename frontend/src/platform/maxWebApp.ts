/**
 * Max Web App SDK — обёртка над глобальным `window.WebApp`.
 * SDK: https://st.max.ru/js/max-web-app.js
 *
 * Все вызовы методов SDK защищены (guarded optional calls): набор методов
 * зависит от клиента/версии Max, поэтому неизвестные/отсутствующие методы — no-op.
 */

type MaxWebApp = NonNullable<Window['WebApp']>;

export function getMaxWebApp(): MaxWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.WebApp ?? null;
}

/** Внутри Max, если глобал WebApp присутствует и похож на Max SDK (есть initData/initDataUnsafe). */
export function isInsideMax(): boolean {
  const wa = getMaxWebApp();
  if (!wa) return false;
  return 'initData' in wa || 'initDataUnsafe' in wa;
}

/** Инициализация при запуске в Max: ready/expand, если такие методы есть. */
export function initMaxWebApp(): void {
  const wa = getMaxWebApp();
  if (!wa) return;
  // Набор методов init зависит от версии Max SDK — вызываем защищённо.
  try {
    wa.ready?.();
  } catch {
    /* ignore */
  }
  try {
    wa.expand?.();
  } catch {
    /* ignore */
  }
}

/** initData (URL-encoded строка для серверной валидации на /api/auth/max). */
export function getMaxInitData(): string | null {
  const value = getMaxWebApp()?.initData?.trim();
  return value ? value : null;
}

/** start_param из deep link (initDataUnsafe.start_param). */
export function getMaxStartParam(): string | null {
  return (getMaxWebApp()?.initDataUnsafe?.start_param as string | undefined) ?? null;
}

/** Max user ID из initDataUnsafe. */
export function getMaxUserId(): number | null {
  const user = getMaxWebApp()?.initDataUnsafe?.user;
  return user?.id ?? null;
}

/** Данные пользователя из initDataUnsafe (только для префилла UI; на бэке проверять initData). */
export function getMaxUser(): { firstName: string; lastName?: string; username?: string; fullName: string } | null {
  const user = getMaxWebApp()?.initDataUnsafe?.user;
  if (!user?.first_name) return null;
  const firstName = String(user.first_name);
  const lastName = user.last_name ? String(user.last_name) : undefined;
  const username = user.username ? String(user.username) : undefined;
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return { firstName, lastName, username, fullName };
}

/** Открыть внешнюю ссылку. В Max — openLink, иначе window.open. */
export function openMaxExternalLink(url: string): void {
  const wa = getMaxWebApp();
  if (wa?.openLink && /^https?:\/\//i.test(url)) {
    wa.openLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Открыть ссылку внутри Max (аналог openTelegramLink). Fallback — window.open. */
export function openMaxMessengerLink(url: string): void {
  const wa = getMaxWebApp();
  if (wa?.openMaxLink) {
    wa.openMaxLink(url);
    return;
  }
  if (wa?.openLink && /^https?:\/\//i.test(url)) {
    wa.openLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Показать кнопку «Назад» (если поддерживается). */
export function showMaxBackButton(): void {
  getMaxWebApp()?.BackButton?.show?.();
}

/** Скрыть кнопку «Назад» (если поддерживается). */
export function hideMaxBackButton(): void {
  getMaxWebApp()?.BackButton?.hide?.();
}

/**
 * Подписаться на нажатие кнопки «Назад». Возвращает функцию отписки.
 * Если SDK не предоставляет offClick — отписка no-op.
 */
export function onMaxBackButtonClick(handler: () => void): () => void {
  const back = getMaxWebApp()?.BackButton;
  if (!back?.onClick) return () => {};
  back.onClick(handler);
  return () => back.offClick?.(handler);
}

/** Хаптики в Max могут отсутствовать → no-op, если метода нет. */
export function maxHapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  getMaxWebApp()?.HapticFeedback?.impactOccurred?.(style);
}

export function maxHapticSelection(): void {
  getMaxWebApp()?.HapticFeedback?.selectionChanged?.();
}

export function maxHapticNotification(type: 'success' | 'warning' | 'error'): void {
  getMaxWebApp()?.HapticFeedback?.notificationOccurred?.(type);
}
