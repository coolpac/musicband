# Авторизация

## Обзор

Система авторизации поддерживает два способа входа:
1. **Telegram Mini App** - через initData от Admin Bot (для пользователей и админов)
2. **Admin Login** - через telegramId + password (для админов в админке)

## Telegram Mini App авторизация

### Как это работает

1. Пользователь открывает Mini App через **Admin Bot**
2. Telegram передает `initData` в Mini App
3. Frontend отправляет `initData` на `/api/auth/telegram`
4. Backend проверяет подпись initData используя токен **Admin Bot**
5. Если валидно - создается/обновляется пользователь в БД
6. Генерируется JWT токен и возвращается клиенту

### API Endpoint

```
POST /api/auth/telegram
Content-Type: application/json

Body:
{
  "initData": "query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%3A279058397%2C%22first_name%3A%22Vladislav%22%2C%22last_name%3A%22Kibenko%22%2C%22username%3A%22vdkfrost%22%2C%22language_code%3A%22ru%22%7D&auth_date=1662771648&hash=c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2"
}

Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "telegramId": "279058397",
      "username": "vdkfrost",
      "firstName": "Vladislav",
      "lastName": "Kibenko",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Frontend пример (React)

```typescript
import { WebApp } from '@twa-dev/sdk';

const webApp = WebApp.initData;

// Отправляем initData на backend
const response = await fetch('/api/auth/telegram', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    initData: webApp,
  }),
});

const data = await response.json();
// Сохраняем токен
localStorage.setItem('token', data.data.token);
```

## Admin Login

### API Endpoint

```
POST /api/auth/admin/login
Content-Type: application/json

Body:
{
  "telegramId": 123456789,
  "password": "your_admin_password"
}

Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "telegramId": "123456789",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## Использование токена

### В заголовке Authorization

```typescript
fetch('/api/protected-endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### В cookie

Токен автоматически устанавливается в cookie при успешной авторизации.

## Защита endpoints

### Middleware для проверки авторизации

```typescript
import { authenticate, requireAdmin } from './middleware/auth';

// Требует любой авторизованный пользователь
router.get('/profile', authenticate(authService), getProfile);

// Требует роль admin
router.get('/admin/stats', authenticate(authService), requireAdmin, getStats);
```

## Проверка initData

### Алгоритм проверки

1. Извлекается `hash` из initData
2. Проверяется `auth_date` (не старше 1 часа)
3. Параметры сортируются по ключу
4. Формируется `data_check_string`
5. Вычисляется секретный ключ: `HMAC-SHA256(bot_token, "WebAppData")`
6. Вычисляется HMAC: `HMAC-SHA256(data_check_string, secret_key)`
7. Сравнивается с полученным `hash`

### Безопасность

- ✅ Проверка подписи через HMAC-SHA256
- ✅ Проверка свежести данных (max 1 час)
- ✅ Использование токена Admin Bot для проверки
- ✅ JWT токены с expiration
- ✅ HTTP-only cookies в production

## Переменные окружения

```env
# Токен Admin Bot (для проверки initData)
TELEGRAM_ADMIN_BOT_TOKEN=your_admin_bot_token

# JWT секрет
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Временный пароль для админов (MVP)
ADMIN_PASSWORD=your_admin_password
```

## Создание первого админа

**Важно:** в PostgreSQL колонка называется `telegram_id` (snake_case), не `telegramId`.

### Вариант 1: Пользователь уже есть (зашёл через бота)

Назначьте роль админа существующему пользователю:

```sql
UPDATE users SET role = 'admin' WHERE telegram_id = 123456789;
```

### Вариант 2: Создание нового пользователя-админа

```sql
INSERT INTO users (id, telegram_id, username, first_name, role, created_at, updated_at)
VALUES (
  gen_random_uuid()::text,
  123456789, -- ваш Telegram ID
  'your_username',
  'Your Name',
  'admin',
  NOW(),
  NOW()
);
```

Если пользователь с таким `telegram_id` уже есть, получите duplicate key — тогда используйте Вариант 1 (UPDATE).

2. Используйте этот telegramId для входа через `/api/auth/admin/login`

## Ошибки

### 401 Unauthorized
- Невалидный или истекший токен
- Невалидный initData
- Неправильные credentials

### 403 Forbidden
- Недостаточно прав (неправильная роль)

### 400 Bad Request
- Ошибки валидации данных
