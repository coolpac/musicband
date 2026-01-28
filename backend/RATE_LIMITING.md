# Rate Limiting - Документация

## Обзор

Реализована система rate limiting для защиты API от злоупотреблений и DDoS атак. Используется Redis для хранения счетчиков, что позволяет масштабировать систему на несколько серверов.

## Типы Rate Limiters

### 1. Auth Rate Limiter
**Применяется к:** `/api/auth/telegram`, `/api/auth/admin/login`

**Лимит:** 5 попыток входа за 15 минут

**Защита:** От брутфорса паролей и подбора токенов

**Ключ:** `rate_limit:auth:{userId || ip}`

### 2. Vote Rate Limiter
**Применяется к:** `POST /api/votes`

**Лимит:** 1 запрос в минуту

**Защита:** От спама и автоматизированных попыток накрутки

**Важно:** Это дополнительная защита. Основная бизнес-логика уже ограничивает: **один пользователь = один голос за сессию**. Rate limiting защищает от частых повторных запросов.

**Ключ:** `rate_limit:vote:{userId}` (если авторизован) или `rate_limit:vote:{ip}`

### 3. Booking Rate Limiter
**Применяется к:** `POST /api/bookings`

**Лимит:** 10 бронирований в час

**Защита:** От спама бронирований

**Ключ:** `rate_limit:booking:{userId}` (если авторизован) или `rate_limit:booking:{ip}`

### 4. Upload Rate Limiter
**Применяется к:** `POST /api/upload/image`

**Лимит:** 20 загрузок в час

**Защита:** От спама загрузок изображений

**Ключ:** `rate_limit:upload:{userId}` (если авторизован) или `rate_limit:upload:{ip}`

### 5. Review Rate Limiter
**Применяется к:** `POST /api/reviews`

**Лимит:** 5 отзывов в день

**Защита:** От спама отзывов

**Ключ:** `rate_limit:review:{userId}` (если авторизован) или `rate_limit:review:{ip}`

### 6. Public API Rate Limiter
**Применяется к:** Все публичные GET endpoints
- `/api/songs`
- `/api/formats`
- `/api/partners`
- `/api/posters`
- `/api/votes/results`
- `/api/bookings/available-dates`
- `/api/public/vote/*`

**Лимит:** 100 запросов в минуту

**Защита:** От перегрузки сервера

**Ключ:** `rate_limit:api:{ip}`

### 7. Admin Rate Limiter
**Применяется к:** Все `/api/admin/*` endpoints

**Лимит:** 100 запросов в минуту (для админов)

**Защита:** От злоупотребления админскими правами

**Ключ:** `rate_limit:admin:{userId}`

### 8. Referral Rate Limiter
**Применяется к:** `/api/agent/links` (POST)

**Лимит:** 10 событий в минуту

**Защита:** От спама создания реферальных ссылок

**Ключ:** `rate_limit:referral:{ip}`

## Архитектура

### Redis-based Rate Limiting

Используется Redis для хранения счетчиков, что позволяет:
- Масштабировать на несколько серверов
- Синхронизировать лимиты между инстансами
- Быстро проверять и обновлять счетчики

**Формат ключа в Redis:**
```
rate_limit:{type}:{identifier}
```

**TTL:** Автоматически устанавливается равным `windowMs` (окно времени лимита)

### Fallback на express-rate-limit

Если Redis недоступен, используется `express-rate-limit` как fallback (fail-open стратегия).

## HTTP Headers

При применении rate limiting устанавливаются следующие заголовки:

```
X-RateLimit-Limit: 100          # Максимальное количество запросов
X-RateLimit-Remaining: 95        # Оставшееся количество запросов
X-RateLimit-Reset: 2024-01-15T10:01:00Z  # Время сброса лимита
Retry-After: 60                  # Секунд до сброса (только при превышении)
```

## Обработка ошибок

При превышении лимита возвращается:
- **Status Code:** 429 (Too Many Requests)
- **Error Code:** `RATE_LIMIT_EXCEEDED`
- **Message:** Зависит от типа лимитера

## Логирование

Все превышения лимитов логируются с уровнем `warn`:
```typescript
logger.warn('Rate limit exceeded', {
  key,
  ip: req.ip,
  path: req.path,
  method: req.method,
  count: currentCount,
  max,
});
```

## Настройка лимитов

Лимиты настраиваются в `/backend/src/shared/constants/index.ts`:

```typescript
export const RATE_LIMIT = {
  API: 100,        // запросов в минуту (public API)
  AUTH: 5,         // попыток входа за 15 минут
  VOTE: 1,         // голосов в минуту
  BOOKING: 10,     // бронирований в час
  UPLOAD: 20,      // загрузок в час
  REVIEW: 5,       // отзывов в день
  REFERRAL_EVENT: 10, // событий в минуту
  ADMIN: 100,      // запросов в минуту (для админов)
} as const;
```

## Применение к маршрутам

### Пример для auth routes:
```typescript
router.post(
  '/telegram',
  authRateLimiter, // Применяем rate limiting
  validate(TelegramAuthSchema),
  authController.authenticateTelegram.bind(authController)
);
```

### Пример для admin routes:
```typescript
router.use(authenticate(authService));
router.use(requireAdmin);
router.use(adminRateLimiter); // Применяем ко всем admin endpoints
```

## Мониторинг

Для мониторинга rate limiting можно использовать:
- Логи (Winston) - все превышения логируются
- Redis keys - можно проверить текущие счетчики
- HTTP headers - клиенты могут видеть оставшиеся запросы

## Производительность

- **Redis операции:** O(1) - GET, SETEX
- **Время ответа:** < 1ms (при доступном Redis)
- **Fail-open:** Если Redis недоступен, rate limiting пропускается (не блокирует запросы)

## Безопасность

- ✅ Защита от брутфорса (auth endpoints)
- ✅ Защита от накрутки (vote endpoints)
- ✅ Защита от спама (booking, upload, review)
- ✅ Защита от DDoS (public API)
- ✅ Масштабируемость (Redis-based)
- ✅ Fail-open стратегия (не блокирует при сбое Redis)
