import { useEffect, useCallback } from 'react';
import {
  getTelegramWebApp,
  isInsideTelegram,
  isTelegramWebAppVersionAtLeast,
  initTelegramWebApp,
  hapticImpact,
  hapticSelection,
  hapticNotification,
} from './telegramWebApp';

export type HapticImpactStyle = 'light' | 'medium' | 'heavy';
export type HapticNotificationType = 'success' | 'warning' | 'error';

export function useTelegramWebApp(options?: { initOnMount?: boolean }) {
  const initOnMount = options?.initOnMount ?? true;

  useEffect(() => {
    if (!initOnMount || !isInsideTelegram()) return;
    initTelegramWebApp();
  }, [initOnMount]);

  const showBackButton = useCallback(() => {
    if (!isTelegramWebAppVersionAtLeast('6.1')) return;
    getTelegramWebApp()?.BackButton?.show();
  }, []);

  const hideBackButton = useCallback(() => {
    if (!isTelegramWebAppVersionAtLeast('6.1')) return;
    getTelegramWebApp()?.BackButton?.hide();
  }, []);

  const onBackButtonClick = useCallback((handler: () => void) => {
    if (!isTelegramWebAppVersionAtLeast('6.1')) return () => {};
    const tg = getTelegramWebApp();
    if (!tg?.BackButton) return () => {};
    tg.BackButton.onClick(handler);
    return () => tg.BackButton.offClick(handler);
  }, []);

  return {
    isTelegram: isInsideTelegram(),
    webApp: getTelegramWebApp(),
    showBackButton,
    hideBackButton,
    onBackButtonClick,
    haptic: {
      impact: hapticImpact,
      selection: hapticSelection,
      notification: hapticNotification,
    },
  };
}
