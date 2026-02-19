/**
 * Глобальные переменные приложения (socketServer).
 * Тип задаётся через интерфейс, чтобы избежать циклических импортов.
 */
import type { SocketServer } from '../presentation/socket/socketServer';

declare global {
  // eslint-disable-next-line no-var -- global declaration requires var for proper typing
  var socketServer: SocketServer | undefined;
}

export {};
