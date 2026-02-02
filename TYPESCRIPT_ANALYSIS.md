# Анализ TypeScript в проекте «Музыканты»

## Состояние проверки

- **Backend:** `npm run type-check` не выполняется без установленных зависимостей (`tsc` не найден). Рекомендуется выполнить `npm install` в `backend/` и затем `npm run type-check`.
- **Frontend:** `npx tsc` без локального TypeScript подтягивает пакет `tsc@2.0.4` (не компилятор TypeScript). Нужен `npm install` в `frontend/` и затем `npx tsc --noEmit` или скрипт в `package.json`.
- **IDE (ReadLints):** ошибок линтера/TypeScript в открытых файлах не найдено.

Ниже — потенциальные проблемы и рекомендации по типам, найденные по коду.

---

## 1. Использование `any` (Backend)

### 1.1 Обработчики ошибок `catch (error: any)`

**Файлы:**
- `backend/src/presentation/socket/socketServer.ts` (стр. 241)
- `backend/src/domain/services/AgentService.ts` (стр. 121)
- `backend/src/presentation/controllers/ImageController.ts` (стр. 63)
- `backend/src/infrastructure/telegram/UserBot.ts` (стр. 85, 154, 170)
- `backend/src/infrastructure/telegram/AdminBot.ts` (стр. 229, 276)

**Рекомендация:** типизировать как `unknown` и сужать тип перед использованием:

```ts
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error('...', { error: message });
}
```

---

### 1.2 `(req as any).user` и расширения `Request`

**Файлы:**
- `backend/src/presentation/middleware/rateLimit.ts` — множественные `(req as any).user`, `(req as any).rateLimit`
- `backend/src/presentation/middleware/validation.ts` — `(req as any).pagination`

В `backend/src/presentation/middleware/auth.ts` уже есть расширение типа Express:

```ts
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; telegramId: string; role: string };
      token?: string;
    }
  }
}
```

**Рекомендация:** в `rateLimit.ts` и `validation.ts` использовать `req.user`, `req.rateLimit`, `req.pagination` без `as any`. Для этого нужно один раз расширить `Express.Request` (например, в `auth.ts` или в общем `types/express.d.ts`):

```ts
// types/express.d.ts или рядом с auth
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; telegramId: string; role: string };
      token?: string;
      rateLimit?: { limit: number; remaining: number; reset: number };
      pagination?: { page: number; limit: number; offset: number };
    }
  }
}
```

После этого все `(req as any).user` и т.п. можно заменить на `req.user` и убрать `as any`.

---

### 1.3 `(global as any).socketServer`

**Файлы:**
- `backend/src/app.ts` (стр. 205, 254)
- `backend/src/presentation/controllers/AdminSongController.ts` (стр. 8)

**Рекомендация:** завести глобальный тип и использовать его вместо `any`:

```ts
// где-то в shared/types или в app.ts
declare global {
  var socketServer: import('./presentation/socket/socketServer').SocketServer | undefined;
}
// запись: globalThis.socketServer = socketServer;
// чтение: const socketServer = globalThis.socketServer;
```

Так код остаётся типобезопасным без `as any`.

---

### 1.4 Результаты сокета `song: any`

**Файл:** `backend/src/presentation/socket/socketServer.ts` (стр. 345)

```ts
results: Array<{ song: any; votes: number; percentage: number }>;
```

В `AdminVoteController.endSession` передаётся `song: { id: r.songId }`.

**Рекомендация:** заменить `any` на явный тип:

```ts
results: Array<{ song: { id: string }; votes: number; percentage: number }>;
```

При необходимости потом можно расширить тип `song` (например, до полного DTO песни).

---

### 1.5 `fs.statfsSync` — `(fs as any).statfsSync`

**Файл:** `backend/src/presentation/routes/health.routes.ts` (стр. 46)

`statfsSync` есть в Node.js, но не в типах `@types/node` для всех платформ.

**Рекомендация:** оставить приведение типа, но сузить до конкретного использования и по возможности вынести в утилиту с комментарием:

```ts
// Node.js fs.statfsSync (не во всех @types/node)
const statfsSync = (fs as { statfsSync?: (path: string) => { bsize?: number; frsize?: number; bavail?: number; bfree?: number } }).statfsSync;
```

Либо использовать `// @ts-expect-error` с кратким комментарием, если тип не экспортируется.

---

### 1.6 Multer error handler — `error: any`, `res: any`, `next: any`

**Файл:** `backend/src/presentation/middleware/upload.ts` (стр. 33–36)

**Рекомендация:** типизировать как в Express:

```ts
import { Request, Response, NextFunction } from 'express';

export function handleUploadError(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof multer.MulterError) {
    // ...
  }
  next(error);
}
```

Для `error` предпочтительно `unknown` и проверка `error instanceof multer.MulterError`.

---

### 1.7 `metadata?: any` в рефералах

**Файлы:**
- `backend/src/domain/services/ReferralService.ts` (стр. 159)
- `backend/src/infrastructure/database/repositories/ReferralEventRepository.ts` (стр. 29)

В Prisma поле `ReferralEvent.metadata` имеет тип `Json?`.

**Рекомендация:** заменить на `Record<string, unknown>` или тип, соответствующий реальному содержимому (например, `{ bookingId?: string; voteSessionId?: string }`), либо оставить `Prisma.JsonValue` при использовании типов Prisma.

---

## 2. Frontend

- Явных использований `any` во фронтенде не найдено.
- `@ts-ignore` / `@ts-expect-error` не используются — хорошо.

Рекомендуется добавить в `frontend/package.json` скрипт проверки типов и запускать его в CI:

```json
"scripts": {
  "type-check": "tsc --noEmit"
}
```

---

## 3. Краткий чеклист исправлений

| Приоритет | Что сделать |
|-----------|-------------|
| Высокий   | Установить зависимости в `backend/` и `frontend/`, убедиться, что `npm run type-check` (или аналог) проходит. |
| Средний   | Расширить `Express.Request` (rateLimit, pagination), убрать `(req as any)` в middleware. |
| Средний   | Заменить `catch (error: any)` на `catch (error: unknown)` и сужать тип там, где нужно. |
| Средний   | Типизировать `globalThis.socketServer` и убрать `(global as any).socketServer`. |
| Низкий    | Заменить `song: any` в типе события сокета на `song: { id: string }`. |
| Низкий    | Типизировать `handleUploadError` (Request, Response, NextFunction, error: unknown). |
| Низкий    | Уточнить тип `metadata` в ReferralService/ReferralEventRepository (JsonValue или свой тип). |

После правок стоит снова запустить `npm run type-check` в backend и frontend и при необходимости включить строгие опции (например, `noImplicitAny`, если ещё не включены).
