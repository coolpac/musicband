# Код-ревью: баги, качество, костыли

## 🔴 Критические / Потенциальные баги

### 1. **Дублирование логики перехода на voting-results**

**Где:** `App.tsx` строки 651-754

**Проблема:** Одна и та же последовательность (setCurrentScreen, pushState, qs) повторяется **10+ раз** с минимальными вариациями. Высокий риск опечатки и рассинхронизации при изменениях.

**Рекомендация:** Вынести в хелпер:
```ts
const goToVotingResults = (sid?: string | null) => {
  hapticNotification('success');
  setCurrentScreen('voting-results');
  const qs = sid ? `?screen=voting-results&sessionId=${sid}` : '?screen=voting-results';
  window.history.pushState({}, '', qs);
};
```

---

### 2. **Пустой catch — потеря контекста ошибки**

**Где:** `App.tsx` строки 709, 755

```ts
} catch {
  /* fallback */
}
```

**Проблема:** Ошибка игнорируется. При отладке невозможно понять, почему fallback сработал.

**Рекомендация:**
```ts
} catch (fallbackErr) {
  console.warn('castVoteWithInitData failed, trying fallback:', fallbackErr);
}
```

---

### 3. **getVoteSessionInfo — нет обработки сбоев**

**Где:** `voteService.ts` строки 118-128

```ts
export async function getVoteSessionInfo(sessionId: string): Promise<VoteSessionInfo | null> {
  const res = await fetch(`${base}/api/public/vote/session/${sessionId}`);
  const data = await res.json();
  if (!data?.success || !data?.data) return null;
  // ...
}
```

**Проблемы:**
- `res.json()` может выбросить при невалидном JSON
- При 5xx/4xx логика `data?.success` может не сработать корректно (тело может быть пустым)
- Нет `credentials: 'include'` — для публичного эндпоинта ок, но лучше явно

**Рекомендация:**
```ts
try {
  const res = await fetch(`${base}/api/public/vote/session/${sessionId}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success || !data?.data) return null;
  return { status: data.data.status, winningSong: data.data.winningSong };
} catch {
  return null;
}
```

---

### 4. **Socket useEffect — vote:join после reconnect**

**Где:** `App.tsx` строки 439-441

```ts
newSocket.on('connect', () => {
  setSocketStatus('connected');
  newSocket.emit('vote:join', { sessionId: votingSessionId || undefined });
});
```

**Проблема:** Socket.IO при `reconnect` тоже вызывает `connect`, но к этому моменту `votingSessionId` берётся из замыкания. При смене экрана/сессии хэндлер может использовать устаревшее значение.

**Решение:** `reconnect` уже триггерит `connect` — логика верна. Но `vote:join` в `connect` не учитывает, что при раннем `return` (когда `socket?.connected`) мы только эмитим, а не пересоздаём сокет. Зависимости `[currentScreen, authToken, votingSessionId]` — при смене `votingSessionId` эффект перезапустится. Ок.

---

## 🟡 Качество кода

### 5. **Использование `as any`**

**Где:** `apiClient.ts`, `BookingsLogScreen.tsx`, `BookingsManagementScreen.tsx`, `adminPosterService.ts`

**Проблема:** Обход типизации, риск runtime-ошибок.

**Рекомендация:** Ввести типы для ошибок API:
```ts
interface ApiErrorBody {
  message?: string;
  error?: { message?: string; code?: string };
}
```

---

### 6. **Огромный onSubmit в App.tsx**

**Где:** `App.tsx` ~130 строк в одном callback

**Проблема:** Сложно читать, тестировать и поддерживать.

**Рекомендация:** Вынести в `useVoteSubmit(authToken, votingSessionId)` — хук с чёткой логикой и fallback-цепочкой.

---

### 7. **Дублирование сервисов в route-файлах**

**Где:** `public/vote.routes.ts`, `auth.routes.ts` и др.

**Проблема:** В каждом роуте создаются свои экземпляры `VoteService`, `AuthService`, `UserRepository`. Нет DI-контейнера, возможны расхождения в конфигурации.

**Рекомендация:** Единая фабрика/контейнер сервисов (уже частично в `app.ts`).

---

### 8. **Поведение PublicVoteController без authService**

**Где:** `PublicVoteController.ts` строки 208-214

```ts
if (!this.authService) {
  res.status(501).json({ ... });
  return;
}
```

**Проблема:** `authService` всегда передаётся из `vote.routes.ts`, ветка 501 по сути недостижима. Условие защищает от будущей опечатки, но можно упростить — сделать `authService` обязательным в конструкторе.

---

## 🟢 Костыли / техдолг

### 9. **Приведение типов manager в Socket**

**Где:** `App.tsx` строка 436

```ts
const manager = (newSocket as Socket & { io?: { reconnecting?: boolean; on?: (...) => void } }).io;
```

**Проблема:** Socket.IO Client типы не экспортируют `io.reconnecting` напрямую — приходится расширять интерфейс.

**Рекомендация:** Оформить типы в `socket.d.ts` или использовать `@ts-ignore` с пояснением, если типы библиотеки не обновляются.

---

### 10. **Пустой catch в ResidentsScreen**

**Где:** `ResidentsScreen.tsx` строка 38

```ts
try { sessionStorage.setItem(HINT_HIDE_KEY, '1'); } catch {}
```

**Оценка:** Допустимо для sessionStorage в приватном режиме, но лучше хотя бы залогировать.

---

### 11. **console.log в production**

**Где:** `App.tsx` — `console.log('Vote session loaded:', ...)`, `console.log('Found vote session...')` и др.

**Проблема:** Логи остаются в production, могут засорять консоль пользователя.

**Рекомендация:** Обернуть в `if (import.meta.env.DEV)` или использовать логгер с уровнем.

---

### 12. **castVoteWithInitData — sessionId не используется**

**Где:** `PublicVoteController.castVoteWithInitData` — `sessionId` из тела не передаётся в `castVote`.

**Проблема:** `VoteService.castVote(userId, songId)` сам находит активную сессию через `findActiveSession()`. При нескольких сессиях или тестах возможна путаница. Для текущей архитектуры (одна активная сессия) — приемлемо.

---

## ✅ Что сделано хорошо

- ✅ Polling с `clearInterval` в cleanup — нет утечек таймеров
- ✅ `cancelled` в auth useEffect — защита от обновления после unmount
- ✅ Разделение `loadData(true)` для silent refresh
- ✅ Проверка `hasLiveSocket` перед использованием `liveResults`
- ✅ Error boundary для React-ошибок
- ✅ Валидация через Zod на бэкенде
- ✅ Использование `next(error)` — централизованная обработка ошибок

---

## Итог

| Категория        | Количество |
|------------------|------------|
| Критические      | 3          |
| Качество         | 4          |
| Костыли/техдолг  | 4          |
| Хорошие практики| 6+         |

Рекомендуется в первую очередь исправить пункты 1 (дублирование), 2 (пустой catch) и 3 (getVoteSessionInfo).
