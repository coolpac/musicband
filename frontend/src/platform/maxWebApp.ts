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

/**
 * Сырые launch-данные Max. ВАЖНО (проверено бэконом из реального Max): `window.WebApp`
 * в Max НЕ создаётся, а initData приходит в `location.hash` как `#WebAppData=<query>`
 * (user/query_id/auth_date/hash/chat/ip). Читаем: SDK → hash → sessionStorage
 * (hash теряется при SPA-навигации, поэтому index.html сохраняет WebAppData сразу).
 */
function readMaxInitDataRaw(): string | null {
  const fromSdk = getMaxWebApp()?.initData;
  if (typeof fromSdk === 'string' && fromSdk.trim()) return fromSdk.trim();
  if (typeof window === 'undefined') return null;
  try {
    const h = window.location.hash.slice(1);
    if (h) {
      const wd = new URLSearchParams(h).get('WebAppData');
      if (wd) {
        try {
          sessionStorage.setItem('max_webapp_init_data', wd);
        } catch {
          /* ignore */
        }
        return wd;
      }
    }
    const stored = sessionStorage.getItem('max_webapp_init_data');
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return null;
}

/** user/start_param: из SDK initDataUnsafe (если есть) либо парсим из сырого WebAppData. */
function readMaxUnsafe(): {
  user?: { id?: number; first_name?: string; last_name?: string; username?: string };
  start_param?: string;
} {
  const unsafe = getMaxWebApp()?.initDataUnsafe;
  if (unsafe && Object.keys(unsafe).length > 0) {
    return unsafe as ReturnType<typeof readMaxUnsafe>;
  }
  const raw = readMaxInitDataRaw();
  if (!raw) return {};
  try {
    const p = new URLSearchParams(raw);
    const userStr = p.get('user');
    return {
      user: userStr ? JSON.parse(userStr) : undefined,
      start_param: p.get('start_param') ?? undefined,
    };
  } catch {
    return {};
  }
}

/** Внутри Max, если есть launch-данные (hash/SDK) или присутствует глобал WebApp. */
export function isInsideMax(): boolean {
  if (readMaxInitDataRaw()) return true;
  const wa = getMaxWebApp();
  return !!wa && ('initData' in wa || 'initDataUnsafe' in wa);
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
  return readMaxInitDataRaw();
}

/** start_param из deep link. */
export function getMaxStartParam(): string | null {
  return readMaxUnsafe().start_param ?? null;
}

/** Max user ID. */
export function getMaxUserId(): number | null {
  return readMaxUnsafe().user?.id ?? null;
}

/** Данные пользователя (только для префилла UI; на бэке проверять initData). */
export function getMaxUser(): { firstName: string; lastName?: string; username?: string; fullName: string } | null {
  const user = readMaxUnsafe().user;
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
