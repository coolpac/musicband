# Публичная страница голосования с QR-кодами

## Как это работает

### 1. Админ создает сессию голосования

Админ запускает сессию через API, **выбирая конкретные песни** для голосования:
```
POST /api/admin/votes/sessions/start
Body: { songIds: ["uuid1", "uuid2", ...] }
```

**Важно:**
- В сессию попадают **только те песни**, которые админ указал в `songIds`
- Все старые активные песни автоматически деактивируются
- Активируются только выбранные песни
- Если уже есть активная сессия, нужно сначала завершить её

**Ответ включает QR-код:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "session-uuid",
      "startedAt": "2024-01-15T10:00:00Z",
      "isActive": true
    },
    "qrCode": {
      "dataURL": "data:image/png;base64,iVBORw0KG...", // Base64 изображение QR-кода
      "deepLink": "https://t.me/your_bot?start=vote_session-uuid"
    }
  }
}
```

### 2. Пользователь сканирует QR-код

QR-код содержит deep link: `https://t.me/your_bot?start=vote_{sessionId}`

При сканировании:
- Открывается Telegram
- Открывается **User Bot** (где находится Mini App)
- Бот обрабатывает команду `/start vote_{sessionId}`
- Открывается Mini App с параметром `start_param=vote_{sessionId}`
- **Важно:** initData будет от **User Bot**, а не от Admin Bot!

### 3. Frontend получает startParam

В Mini App:
```typescript
import { WebApp } from '@twa-dev/sdk';

// Получаем start_param из initData
const initData = WebApp.initData;
const startParam = WebApp.initDataUnsafe.start_param; // vote_{sessionId}

// Или из URL
const urlParams = new URLSearchParams(window.location.search);
const startParam = urlParams.get('start_param'); // vote_{sessionId}
```

### 4. Авторизация с startParam

Frontend отправляет initData + startParam на backend:
```typescript
const response = await fetch('/api/auth/telegram', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    initData: WebApp.initData, // initData от User Bot (где открыт Mini App)
    startParam: startParam, // vote_{sessionId}
  }),
});

const { data } = await response.json();
// data.startParam содержит "vote_{sessionId}" если был передан
```

**Важно:** Backend автоматически определяет какой бот использовался:
- Пробует валидировать initData токеном **User Bot** (для обычных пользователей)
- Если не проходит, пробует токеном **Admin Bot** (для админов)
- Это позволяет работать с обоими ботами!

### 5. Frontend определяет страницу

```typescript
if (data.startParam?.startsWith('vote_')) {
  const sessionId = data.startParam.replace('vote_', '');
  // Перенаправляем на страницу голосования
  router.push(`/vote/${sessionId}`);
}
```

### 6. Страница голосования

Frontend загружает информацию о сессии:
```typescript
// GET /api/public/vote/session/{sessionId}
const sessionInfo = await fetch(`/api/public/vote/session/${sessionId}`);
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "session-uuid",
      "startedAt": "2024-01-15T10:00:00Z",
      "isActive": true
    },
    "songs": [
      {
        "id": "song-uuid",
        "title": "Название",
        "artist": "Исполнитель",
        "coverUrl": "/uploads/...",
        "isActive": true
      }
    ],
    "results": {
      "songs": [
        {
          "song": { "id": "...", "title": "...", "artist": "..." },
          "votes": 10,
          "percentage": 50.0
        }
      ],
      "totalVotes": 20
    }
  }
}
```

### 7. Голосование

Пользователь голосует через API (требует JWT токен):
```typescript
// POST /api/votes
await fetch('/api/votes', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ songId: 'song-uuid' }),
});
```

**Защита:**
- Один голос на `telegram_id` (проверяется в `VoteService`)
- Голосование только в активной сессии
- Результаты обновляются через WebSocket в real-time

## API Endpoints

### Admin

**POST /api/admin/votes/sessions/start**
- Создает сессию и возвращает QR-код
- Ответ включает `qrCode.dataURL` (Base64) и `qrCode.deepLink`

**GET /api/admin/votes/sessions/:id/qr**
- Получить QR-код для существующей сессии

### Public

**GET /api/public/vote/session/:sessionId**
- Получить информацию о сессии (песни, результаты)
- Не требует авторизации

**GET /api/public/vote/active**
- Получить активную сессию (если не указан sessionId)

### Auth

**POST /api/auth/telegram**
- Принимает `initData` и опционально `startParam`
- Возвращает `startParam` если был передан в deep link

## Формат deep link

```
https://t.me/{bot_username}?start=vote_{sessionId}
```

Пример:
```
https://t.me/musicians_bot?start=vote_abc123-def456-ghi789
```

## Frontend пример

```typescript
// 1. Получаем initData и startParam
const initData = WebApp.initData;
const startParam = WebApp.initDataUnsafe.start_param;

// 2. Авторизуемся
const authResponse = await fetch('/api/auth/telegram', {
  method: 'POST',
  body: JSON.stringify({ initData, startParam }),
});
const { data } = await authResponse.json();

// 3. Если есть startParam с vote_, перенаправляем на голосование
if (data.startParam?.startsWith('vote_')) {
  const sessionId = data.startParam.replace('vote_', '');
  window.location.href = `/vote/${sessionId}`;
}

// 4. На странице голосования загружаем данные
const sessionInfo = await fetch(`/api/public/vote/session/${sessionId}`);
const session = await sessionInfo.json();

// 5. Подключаемся к WebSocket для real-time обновлений
const socket = io('http://localhost:3000', {
  auth: { token: data.token },
});

socket.emit('vote:join', { sessionId });
socket.on('vote:state', (state) => {
  // Обновляем UI
});
```

## Переменные окружения

```env
TELEGRAM_USER_BOT_TOKEN=123456:ABC-DEF...  # Токен User Bot (для валидации initData от пользователей)
TELEGRAM_ADMIN_BOT_TOKEN=123456:XYZ-GHI...  # Токен Admin Bot (для валидации initData от админов)
TELEGRAM_USER_BOT_USERNAME=your_bot_username  # Username User Bot (для генерации deep links)
MINI_APP_URL=https://your-domain.com
```

**Важно:** Оба токена нужны, потому что:
- **User Bot** - для обычных пользователей (Mini App, голосование)
- **Admin Bot** - для админов (админка)
- Backend пробует оба токена при валидации initData

## Безопасность

- ✅ Авторизация через Telegram initData (проверка на сервере)
- ✅ Один голос на telegram_id (защита от накрутки)
- ✅ Голосование только в активной сессии
- ✅ Валидация всех данных
