/**
 * Этот модуль переехал в ../messaging/BotManager как часть Phase 3
 * (абстракция мессенджеров + реестр платформ). Здесь оставлен реэкспорт,
 * чтобы существующие импортеры (app.ts, контроллеры, сервисы) продолжали работать без изменений.
 */
export { BotManager, getBotManager, setBotManager } from '../messaging/BotManager';
export type { MessageTarget } from '../messaging/BotManager';
