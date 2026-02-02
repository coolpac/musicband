/**
 * Глобальные переменные приложения (socketServer).
 * Тип задаётся через интерфейс, чтобы избежать циклических импортов.
 */
import type { SocketServer } from '../presentation/socket/socketServer';

declare global {
  var socketServer: SocketServer | undefined;
}

export {};
