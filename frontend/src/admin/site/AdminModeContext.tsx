import { createContext, useContext, type ReactNode } from 'react';

/** Админка работает в двух режимах: Telegram-приложение и публичный сайт. */
export type AdminMode = 'app' | 'site';

const ADMIN_MODE_STORAGE_KEY = 'admin_mode';

function isAdminMode(value: unknown): value is AdminMode {
  return value === 'app' || value === 'site';
}

/** Режим из ?mode=site в адресе (ссылка из письма/бота), иначе из localStorage, иначе «Приложение». */
export function readInitialAdminMode(): AdminMode {
  if (typeof window === 'undefined') return 'app';

  try {
    const fromQuery = new URLSearchParams(window.location.search).get('mode');
    if (isAdminMode(fromQuery)) return fromQuery;
  } catch {
    /* адрес без query или экзотический URL — не повод падать */
  }

  try {
    const stored = window.localStorage.getItem(ADMIN_MODE_STORAGE_KEY);
    if (isAdminMode(stored)) return stored;
  } catch {
    /* приватный режим / запрет storage */
  }

  return 'app';
}

export function persistAdminMode(mode: AdminMode): void {
  try {
    window.localStorage.setItem(ADMIN_MODE_STORAGE_KEY, mode);
  } catch {
    /* запись недоступна — режим просто не переживёт перезагрузку */
  }
}

/**
 * Экран с черновиком (редактор контента) регистрирует такой «замок»,
 * пока он активен. Оболочка спрашивает подтверждение перед уходом.
 */
export interface AdminUnsavedGuard {
  hasUnsavedChanges: () => boolean;
  discardChanges: () => void;
}

export interface AdminModeContextValue {
  mode: AdminMode;
  /** Переключение режима с проверкой несохранённых изменений. */
  requestMode: (mode: AdminMode) => void;
  /** Возвращает функцию снятия регистрации (для useEffect cleanup). */
  registerUnsavedGuard: (guard: AdminUnsavedGuard) => () => void;
}

const AdminModeContext = createContext<AdminModeContextValue | null>(null);

export function AdminModeProvider({
  value,
  children,
}: {
  value: AdminModeContextValue;
  children: ReactNode;
}) {
  return <AdminModeContext.Provider value={value}>{children}</AdminModeContext.Provider>;
}

/** null вне провайдера — AdminHeader используется и в сторонних местах, падать нельзя. */
export function useAdminMode(): AdminModeContextValue | null {
  return useContext(AdminModeContext);
}
