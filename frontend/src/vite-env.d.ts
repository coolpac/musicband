/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK: string;
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Telegram Mini Apps Web App API (https://core.telegram.org/bots/webapps) */
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          [key: string]: unknown;
        };
        openTelegramLink?(url: string): void;
        openLink?(url: string, options?: { try_instant_view?: boolean; try_browser?: string }): void;
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        isVerticalSwipesEnabled?: boolean;
        isFullscreen?: boolean;
        isActive?: boolean;
        safeAreaInset?: { top: number; bottom: number; left: number; right: number };
        contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
        BackButton: {
          isVisible: boolean;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
          show(): void;
          hide(): void;
        };
        HapticFeedback: {
          impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
          notificationOccurred(type: 'error' | 'success' | 'warning'): void;
          selectionChanged(): void;
        };
        isVersionAtLeast(version: string): boolean;
        setHeaderColor(color: string): void;
        setBackgroundColor(color: string): void;
        enableClosingConfirmation(): void;
        disableClosingConfirmation(): void;
        enableVerticalSwipes(): void;
        disableVerticalSwipes(): void;
        requestFullscreen?(): void;
        exitFullscreen?(): void;
        ready(): void;
        expand(): void;
        close(): void;
        showAlert(message: string): void;
        showConfirm(message: string, callback?: (ok: boolean) => void): void;
        showPopup(params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text?: string }> }, callback?: (buttonId: string | null) => void): void;
        onEvent(eventType: string, handler: () => void): void;
        offEvent(eventType: string, handler: () => void): void;
        CloudStorage?: {
          setItem(key: string, value: string, callback?: (error: string | null, success?: boolean) => void): void;
          getItem(key: string, callback: (error: string | null, value?: string) => void): void;
          getKeys(callback: (error: string | null, keys?: string[]) => void): void;
          removeItem(key: string, callback?: (error: string | null, success?: boolean) => void): void;
        };
        MainButton?: {
          setText(text: string): void;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
          show(): void;
          hide(): void;
          enable(): void;
          disable(): void;
          showProgress(leaveActive?: boolean): void;
          hideProgress(): void;
          setParams(params: { text?: string; color?: string; text_color?: string; is_visible?: boolean; is_active?: boolean }): void;
        };
      };
    };
    /**
     * Max Web App SDK (https://st.max.ru/js/max-web-app.js).
     * Минимальная декларация поверхности, которую использует наш фасад.
     * Все методы помечены optional — реальный набор зависит от клиента/версии,
     * фасад вызывает их защищённо (guarded optional calls).
     */
    WebApp?: {
      initData?: string;
      initDataUnsafe?: {
        user?: {
          id: number;
          first_name: string;
          last_name?: string;
          username?: string;
          photo_url?: string;
          language_code?: string;
        };
        auth_date?: number;
        hash?: string;
        start_param?: string;
        query_id?: string;
        chat?: unknown;
        [key: string]: unknown;
      };
      platform?: string;
      version?: string;
      openLink?(url: string): void;
      openMaxLink?(url: string): void;
      requestContact?(): void;
      ready?(): void;
      expand?(): void;
      BackButton?: {
        show?(): void;
        hide?(): void;
        onClick?(cb: () => void): void;
        offClick?(cb: () => void): void;
      };
      HapticFeedback?: {
        impactOccurred?(style: string): void;
        notificationOccurred?(type: string): void;
        selectionChanged?(): void;
      };
      [key: string]: unknown;
    };
  }
}
export {};
