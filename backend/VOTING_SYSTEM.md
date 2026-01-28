# Оптимизированная система голосования

## Архитектура

### Защита от накрутки

1. **IP-based Rate Limiting** - Ограничение по IP адресу
2. **Session-based Voting** - Один голос на сессию
3. **Redis Cache** - Быстрое кеширование результатов
4. **Fingerprinting** - Отслеживание устройств через fingerprint
5. **Time Windows** - Ограничение по временным окнам

### Технологии

- **PostgreSQL** - Хранение голосов
- **Redis** - Кеширование и rate limiting
- **Express** - API endpoints
- **Socket.IO** - Real-time обновления результатов

## Схема базы данных

```prisma
model Vote {
  id            String   @id @default(uuid())
  songId        String   @map("song_id")
  song          Song     @relation(fields: [songId], references: [id])

  // Tracking
  ipAddress     String?  @map("ip_address")
  userAgent     String?  @map("user_agent")
  fingerprint   String?  // Browser fingerprint
  sessionId     String?  @map("session_id")

  createdAt     DateTime @default(now()) @map("created_at")

  @@index([songId])
  @@index([ipAddress])
  @@index([fingerprint])
  @@index([createdAt])
  @@map("votes")
}

model Song {
  id          String   @id @default(uuid())
  title       String
  artist      String
  coverUrl    String?  @map("cover_url")
  audioUrl    String?  @map("audio_url")
  order       Int      @default(0)
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  votes       Vote[]

  @@map("songs")
}
```

## API Endpoints

### POST /api/votes

Отправка голоса с защитой от накрутки:

```typescript
// Request
{
  "songId": "uuid",
  "fingerprint": "hash" // Optional client fingerprint
}

// Response
{
  "success": true,
  "data": {
    "voteId": "uuid",
    "songId": "uuid"
  }
}

// Error (rate limited)
{
  "success": false,
  "message": "Вы уже голосовали. Попробуйте позже.",
  "retryAfter": 3600 // seconds
}
```

### GET /api/votes/results

Получение результатов с кешированием (обновление каждые 10 секунд):

```typescript
// Response
{
  "success": true,
  "data": [
    {
      "songId": "1",
      "voteCount": 142,
      "percentage": 35.5
    }
  ],
  "totalVotes": 400,
  "lastUpdated": "2024-01-28T12:00:00Z"
}
```

### GET /api/votes/can-vote

Проверка возможности голосовать:

```typescript
// Response
{
  "success": true,
  "data": {
    "canVote": false,
    "reason": "ip_rate_limit",
    "retryAfter": 3600
  }
}
```

## Redis Cache Strategy

### Структура ключей

```
votes:results              # Кеш результатов (TTL: 10s)
votes:count:{songId}       # Счетчик голосов для песни (TTL: 10s)
votes:ratelimit:ip:{ip}    # Rate limit по IP (TTL: 1h)
votes:ratelimit:fp:{fp}    # Rate limit по fingerprint (TTL: 1h)
votes:session:{sessionId}  # Отслеживание сессии (TTL: 24h)
```

### Пример использования Redis

```typescript
// Rate limiting
const ipKey = `votes:ratelimit:ip:${ip}`;
const ipVotes = await redis.incr(ipKey);
if (ipVotes === 1) {
  await redis.expire(ipKey, 3600); // 1 hour
}
if (ipVotes > MAX_VOTES_PER_HOUR) {
  throw new RateLimitError();
}

// Кеширование результатов
const cacheKey = 'votes:results';
let results = await redis.get(cacheKey);
if (!results) {
  results = await calculateResults();
  await redis.setex(cacheKey, 10, JSON.stringify(results));
}
```

## Real-time Updates

Используем Socket.IO для real-time обновлений:

```typescript
// Server
io.on('connection', (socket) => {
  socket.on('subscribe:votes', (roomId) => {
    socket.join('votes');
  });
});

// После голоса
io.to('votes').emit('votes:updated', results);

// Client
socket.on('votes:updated', (results) => {
  updateVotingResults(results);
});
```

## Оптимизации

### 1. Batch Updates

Обновляем счетчики пакетами каждые 10 секунд вместо моментально:

```typescript
const voteQueue = [];

async function addVote(vote) {
  voteQueue.push(vote);

  if (voteQueue.length >= BATCH_SIZE) {
    await flushVotes();
  }
}

async function flushVotes() {
  if (voteQueue.length === 0) return;

  await prisma.vote.createMany({
    data: voteQueue
  });

  voteQueue.length = 0;
  await invalidateCache();
}

// Flush every 10 seconds
setInterval(flushVotes, 10000);
```

### 2. Database Indexes

```sql
CREATE INDEX idx_votes_song_id ON votes(song_id);
CREATE INDEX idx_votes_created_at ON votes(created_at);
CREATE INDEX idx_votes_ip_address ON votes(ip_address);
CREATE INDEX idx_votes_fingerprint ON votes(fingerprint);
```

### 3. Materialized View

Создаем материализованное представление для быстрых запросов:

```sql
CREATE MATERIALIZED VIEW votes_summary AS
SELECT
  song_id,
  COUNT(*) as vote_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM votes
GROUP BY song_id;

-- Refresh every minute
CREATE OR REPLACE FUNCTION refresh_votes_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY votes_summary;
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule('refresh-votes', '*/1 * * * *', 'SELECT refresh_votes_summary()');
```

## Защита от ботов

### 1. Browser Fingerprinting

На клиенте собираем fingerprint:

```typescript
import FingerprintJS from '@fingerprintjs/fingerprintjs';

const fp = await FingerprintJS.load();
const result = await fp.get();
const fingerprint = result.visitorId;

// Отправляем с голосом
await castVote(songId, fingerprint);
```

### 2. CAPTCHA (опционально)

Для подозрительной активности:

```typescript
if (ipVotes > SUSPICIOUS_THRESHOLD) {
  return { requiresCaptcha: true };
}

// Frontend показывает CAPTCHA
```

### 3. Honeypot Fields

Добавляем скрытые поля в форму:

```typescript
// Скрытое поле, которое боты заполнят
<input type="text" name="website" style="display:none" />

// Backend проверяет
if (req.body.website) {
  throw new BotDetectedError();
}
```

## Масштабирование

### Для > 10,000 одновременных пользователей

1. **Redis Cluster** - Распределенное кеширование
2. **PostgreSQL Read Replicas** - Чтение с реплик
3. **Load Balancer** - Nginx/HAProxy
4. **CDN** - Кешируем статику и результаты
5. **Message Queue** - RabbitMQ/SQS для обработки голосов

### Горизонтальное масштабирование

```
[Load Balancer]
       |
   [App 1] [App 2] [App 3]
       |
   [Redis Cluster]
       |
 [PostgreSQL Primary]
   /           \
[Replica 1]  [Replica 2]
```

## Мониторинг

### Метрики

- Количество голосов в секунду
- Время отклика API
- Cache hit rate
- Заблокированные IP
- Подозрительная активность

### Logging

```typescript
logger.info('vote_cast', {
  songId,
  ip,
  fingerprint,
  timestamp: Date.now()
});

logger.warn('rate_limit_exceeded', {
  ip,
  attempts,
  timestamp: Date.now()
});
```

## Тестирование нагрузки

```bash
# Apache Bench
ab -n 10000 -c 100 http://localhost:3000/api/votes/results

# Artillery
artillery quick --count 1000 --num 10 http://localhost:3000/api/votes
```

## Резюме

Эта система обеспечивает:
- ✅ Защиту от накрутки (IP + fingerprint + session)
- ✅ Высокую производительность (Redis cache + batch updates)
- ✅ Масштабируемость (до 10K+ concurrent users)
- ✅ Real-time обновления (Socket.IO)
- ✅ Надежность (PostgreSQL + Redis)
