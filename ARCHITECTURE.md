# Архитектура проекта "Музыканты"

## Технологический стек

### Backend
- **Node.js** + **TypeScript** - основной язык
- **Express** - HTTP сервер
- **Socket.io** - WebSocket для real-time
- **PostgreSQL** - основная БД (ACID, транзакции)
- **Redis** - кеш, сессии, real-time счетчики голосов
- **Prisma** - ORM для работы с БД
- **JWT** - авторизация для админки
- **Multer** + **Sharp** - загрузка и оптимизация изображений (локальное хранилище)
- **node-telegram-bot-api** - Telegram Bot API
- **Bull** или **BullMQ** - очереди задач для асинхронной обработки (CSV экспорт)
- **fast-csv** или **csv-writer** - генерация CSV файлов

### Frontend
- **React** + **TypeScript** - Telegram Mini App
- **React** + **TypeScript** - Админка
- **Vite** - сборка
- **Socket.io-client** - подключение к real-time
- **@twa-dev/sdk** - Telegram WebApp SDK

---

## Схема базы данных

### Таблицы и связи

```sql
-- Пользователи
Users (
  id UUID PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  role ENUM('user', 'admin', 'agent') DEFAULT 'user',
  referrer_id UUID REFERENCES Users(id) ON DELETE SET NULL, -- агент, который привел пользователя
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_referrer_id (referrer_id)
)

-- Агенты (дополнительная информация для пользователей с ролью agent)
Agents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES Users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  agent_code VARCHAR(50) UNIQUE NOT NULL, -- уникальный код агента для ссылок
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  total_referrals INTEGER DEFAULT 0, -- кешированное количество рефералов
  total_active_referrals INTEGER DEFAULT 0, -- кешированное количество активных рефералов
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_agent_code (agent_code)
)

-- Реферальные ссылки (генерируются для каждого агента)
ReferralLinks (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES Agents(id) ON DELETE CASCADE NOT NULL,
  link_code VARCHAR(100) UNIQUE NOT NULL, -- уникальный код ссылки
  name VARCHAR(255), -- название ссылки (опционально, для удобства агента)
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP, -- опционально, срок действия ссылки
  click_count INTEGER DEFAULT 0, -- количество переходов
  conversion_count INTEGER DEFAULT 0, -- количество регистраций по ссылке
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_agent_id (agent_id),
  INDEX idx_link_code (link_code)
)

-- События рефералов (переходы и регистрации)
ReferralEvents (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES Agents(id) ON DELETE CASCADE NOT NULL,
  referral_link_id UUID REFERENCES ReferralLinks(id) ON DELETE SET NULL,
  referred_user_id UUID REFERENCES Users(id) ON DELETE CASCADE, -- NULL если еще не зарегистрировался
  event_type ENUM('click', 'registration', 'booking', 'vote') NOT NULL,
  ip_address VARCHAR(45), -- для аналитики и защиты от фрода
  user_agent TEXT,
  status ENUM('pending', 'confirmed', 'rejected') DEFAULT 'pending',
  metadata JSONB, -- дополнительная информация (какое бронирование, какое голосование и т.д.)
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_agent_id_created (agent_id, created_at),
  INDEX idx_referred_user_id (referred_user_id),
  INDEX idx_event_type (event_type),
  INDEX idx_status (status)
)

-- Песни
Songs (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  cover_url TEXT,
  lyrics TEXT,
  is_active BOOLEAN DEFAULT false, -- включена ли в голосование
  order_index INTEGER DEFAULT 0, -- порядок отображения
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Сессии голосования (для истории и статистики)
VotingSessions (
  id UUID PRIMARY KEY,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  total_voters INTEGER DEFAULT 0, -- количество уникальных голосовавших
  created_at TIMESTAMP DEFAULT NOW()
)

-- Голоса (один пользователь = один голос на песню в рамках одной сессии)
Votes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES Users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES Songs(id) ON DELETE CASCADE,
  session_id UUID REFERENCES VotingSessions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, song_id, session_id) -- защита от дублирования в рамках сессии
)

-- Форматы выступлений
Formats (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Партнеры
Partners (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  link TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Афиши
Posters (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  link TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- Заблокированные даты (админ закрыл день для бронирования)
BlockedDates (
  id UUID PRIMARY KEY,
  blocked_date DATE NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Бронирования
Bookings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES Users(id) ON DELETE CASCADE,
  format_id UUID REFERENCES Formats(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  contact_type VARCHAR(50), -- телефон, email, telegram
  contact_value VARCHAR(255) NOT NULL,
  city VARCHAR(255),
  source VARCHAR(255), -- откуда узнали
  income DECIMAL(10, 2), -- заработок для этой записи (указывает админ)
  status ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_booking_date (booking_date),
  INDEX idx_user_id (user_id),
  INDEX idx_booking_date_status (booking_date, status)
)

-- Отзывы (только для админов, не публикуются)
Reviews (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES Users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

-- История действий пользователей (для статистики и уведомлений админу)
UserActivityLog (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES Users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'vote', 'booking', 'review'
  action_data JSONB, -- детали действия
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_id_created (user_id, created_at),
  INDEX idx_action_type (action_type)
)
```

### Индексы для производительности

```sql
-- Быстрый поиск активных песен
CREATE INDEX idx_songs_active ON Songs(is_active) WHERE is_active = true;

-- Быстрый подсчет голосов по сессии
CREATE INDEX idx_votes_session_song ON Votes(session_id, song_id);
CREATE INDEX idx_votes_session_user ON Votes(session_id, user_id);
CREATE INDEX idx_votes_song ON Votes(song_id);
CREATE INDEX idx_votes_user ON Votes(user_id);

-- Поиск активной сессии голосования
CREATE INDEX idx_voting_sessions_active ON VotingSessions(is_active) WHERE is_active = true;

-- Поиск заблокированных дат
CREATE INDEX idx_blocked_dates_date ON BlockedDates(blocked_date);

-- Реферальная система
CREATE INDEX idx_referral_events_agent_status ON ReferralEvents(agent_id, status, created_at);
CREATE INDEX idx_referral_links_agent_active ON ReferralLinks(agent_id, is_active);
```

---

## API Endpoints

### Авторизация

```
POST /api/auth/telegram
  Body: { initData: string }
  Response: { user: User, token?: string }

POST /api/auth/admin/login
  Body: { telegramId: number, password: string }
  Response: { admin: User, token: string }
  Note: Админы создаются вручную в БД, авторизация через telegram_id + password
```

### Песни (Public)

```
GET /api/songs
  Query: ?isActive=true
  Response: Song[]

GET /api/songs/:id
  Response: Song

GET /api/songs/:id/lyrics
  Response: { lyrics: string }
```

### Голосование (Public, требует авторизацию Telegram)

```
POST /api/votes
  Headers: { Authorization: Bearer <token> }
  Body: { songId: string }
  Response: { success: boolean, vote: Vote }
  Note: Если пользователь был привлечен агентом, создается ReferralEvent типа 'vote'

GET /api/votes/results
  Query: ?sessionId=xxx (опционально, если не указан - текущая активная)
  Response: { 
    sessionId: string,
    songs: Array<{
      song: Song,
      votes: number,
      percentage: number
    }>,
    totalVotes: number
  }

GET /api/votes/my
  Headers: { Authorization: Bearer <token> }
  Response: { votedSongId: string | null } // текущий голос пользователя
```

### Бронирование (Public, требует авторизацию Telegram)

```
POST /api/bookings
  Headers: { Authorization: Bearer <token> }
  Body: {
    formatId: string,
    bookingDate: string (YYYY-MM-DD),
    fullName: string,
    contactType: string,
    contactValue: string,
    city?: string,
    source?: string,
    referralCode?: string // опционально, если пользователь пришел по реферальной ссылке
  }
  Response: { booking: Booking }
  Note: Если указан referralCode и пользователь еще не был привязан к агенту, создается ReferralEvent типа 'booking'

GET /api/bookings/available-dates
  Query: ?formatId=xxx&month=YYYY-MM
  Response: { 
    dates: string[], // доступные даты в формате YYYY-MM-DD
    blockedDates: string[] // заблокированные админом даты
  }
  Note: Прошедшие даты автоматически блокируются, админ может закрыть день вручную

GET /api/bookings/my
  Headers: { Authorization: Bearer <token> }
  Response: Booking[]
```

### Отзывы (Public, требует авторизацию Telegram, только для админов)

```
POST /api/reviews
  Headers: { Authorization: Bearer <token> }
  Body: { rating: number (1-5), text?: string }
  Response: { review: Review }
  Note: Пользователь может оставить несколько отзывов, редактировать нельзя
```

### Реферальные ссылки (Public)

```
GET /api/referral/:code
  Query: ?redirect=true
  Response: { 
    agent: { id, name },
    link: { id, code, name },
    redirect: boolean
  }
  Note: При переходе по ссылке создается событие ReferralEvent типа 'click'
  Если redirect=true, редирект на главную страницу Mini App с сохранением referral_code в cookie/localStorage
```

### Форматы (Public)

```
GET /api/formats
  Response: Format[]
```

### Партнеры (Public)

```
GET /api/partners
  Response: Partner[]
```

### Афиши (Public)

```
GET /api/posters
  Response: Poster[]
```

---

## Admin API Endpoints

Все требуют авторизацию админа (JWT token)

### Песни (Admin)

```
GET /api/admin/songs
  Response: Song[]

POST /api/admin/songs
  Body: { title, artist, coverUrl?, lyrics?, isActive? }
  Response: { song: Song }

PUT /api/admin/songs/:id
  Body: { title?, artist?, coverUrl?, lyrics?, isActive?, orderIndex? }
  Response: { song: Song }

DELETE /api/admin/songs/:id
  Response: { success: boolean }

POST /api/admin/songs/:id/toggle
  Response: { song: Song }
```

### Голосование (Admin)

```
GET /api/admin/votes/sessions
  Query: ?isActive=true
  Response: VotingSession[]

GET /api/admin/votes/sessions/:id
  Response: {
    session: VotingSession,
    results: Array<{ song: Song, votes: number, percentage: number }>,
    totalVoters: number
  }

POST /api/admin/votes/sessions/start
  Body: { songIds: string[] } // какие песни включить
  Response: { session: VotingSession }

POST /api/admin/votes/sessions/:id/end
  Response: { 
    success: boolean, 
    session: VotingSession,
    finalResults: Array<{ song: Song, votes: number, percentage: number }>,
    totalVoters: number
  }
  Note: При завершении сессии все голоса удаляются, статистика сохраняется в сессии

GET /api/admin/votes/stats
  Query: ?sessionId=xxx
  Response: {
    totalVotes: number,
    activeSongs: number,
    totalVoters: number,
    results: Array<{ song: Song, votes: number, percentage: number }>
  }

GET /api/admin/votes/history
  Query: ?page=1&limit=10
  Response: { 
    sessions: Array<{
      id: string,
      startedAt: string,
      endedAt: string,
      totalVoters: number
    }>,
    total: number
  }
```

### Бронирования (Admin)

```
GET /api/admin/bookings
  Query: ?date=YYYY-MM-DD&status=pending
  Response: Booking[]

GET /api/admin/bookings/stats
  Response: {
    total: number,
    confirmed: number,
    pending: number,
    cancelled: number,
    totalIncome: number,
    conversionRate: number
  }

PUT /api/admin/bookings/:id/status
  Body: { status: 'confirmed' | 'cancelled' }
  Response: { booking: Booking }

PUT /api/admin/bookings/:id/income
  Body: { income: number }
  Response: { booking: Booking }

POST /api/admin/bookings/block-date
  Body: { date: string (YYYY-MM-DD), reason?: string }
  Response: { blockedDate: BlockedDate }

DELETE /api/admin/bookings/block-date/:id
  Response: { success: boolean }

GET /api/admin/bookings/calendar
  Query: ?month=YYYY-MM
  Response: {
    dates: Array<{
      date: string,
      bookings: Booking[],
      formats: Format[]
    }>
  }
```

### Форматы (Admin)

```
GET /api/admin/formats
  Response: Format[]

POST /api/admin/formats
  Body: { name, description? }
  Response: { format: Format }

PUT /api/admin/formats/:id
  Body: { name?, description? }
  Response: { format: Format }

DELETE /api/admin/formats/:id
  Response: { success: boolean }
```

### Партнеры (Admin)

```
GET /api/admin/partners
  Response: Partner[]

POST /api/admin/partners
  Body: { name, logoUrl?, link? }
  Response: { partner: Partner }

PUT /api/admin/partners/:id
  Body: { name?, logoUrl?, link? }
  Response: { partner: Partner }

DELETE /api/admin/partners/:id
  Response: { success: boolean }
```

### Афиши (Admin)

```
GET /api/admin/posters
  Response: Poster[]

POST /api/admin/posters
  Body: { title, description?, imageUrl?, link? }
  Response: { poster: Poster }

PUT /api/admin/posters/:id
  Body: { title?, description?, imageUrl?, link? }
  Response: { poster: Poster }

DELETE /api/admin/posters/:id
  Response: { success: boolean }
```

### Отзывы (Admin)

```
GET /api/admin/reviews
  Query: ?page=1&limit=10&rating=5
  Response: { reviews: Review[], total: number }

DELETE /api/admin/reviews/:id
  Response: { success: boolean }

GET /api/admin/activity
  Query: ?userId=xxx&actionType=vote&page=1&limit=20
  Response: {
    activities: UserActivityLog[],
    total: number
  }
```

### Агенты (Admin)

```
GET /api/admin/agents
  Query: ?status=active&page=1&limit=20&search=name
  Response: {
    agents: Array<{
      id: string,
      user: User,
      agentCode: string,
      status: string,
      totalReferrals: number,
      totalActiveReferrals: number,
      createdAt: string
    }>,
    total: number
  }

POST /api/admin/agents
  Body: { userId: string, agentCode?: string }
  Response: { agent: Agent }
  Note: Создает агента из существующего пользователя. Если agentCode не указан, генерируется автоматически

PUT /api/admin/agents/:id
  Body: { status?: 'active' | 'inactive' | 'suspended' }
  Response: { agent: Agent }

DELETE /api/admin/agents/:id
  Response: { success: boolean }

GET /api/admin/agents/:id/referrals
  Query: ?page=1&limit=50&status=confirmed&eventType=registration
  Response: {
    referrals: Array<{
      id: string,
      user: User,
      eventType: string,
      status: string,
      createdAt: string,
      metadata: object
    }>,
    total: number,
    stats: {
      totalClicks: number,
      totalRegistrations: number,
      totalBookings: number,
      totalVotes: number
    }
  }

GET /api/admin/agents/:id/stats
  Response: {
    agent: Agent,
    totalReferrals: number,
    activeReferrals: number,
    totalClicks: number,
    totalRegistrations: number,
    totalBookings: number,
    totalVotes: number,
    conversionRate: number, // регистрации / клики
    referralsByDate: Array<{ date: string, count: number }>
  }

GET /api/admin/agents/:id/links
  Response: Array<{
    id: string,
    linkCode: string,
    name: string,
    isActive: boolean,
    clickCount: number,
    conversionCount: number,
    createdAt: string,
    fullUrl: string
  }>

POST /api/admin/agents/:id/links
  Body: { name?: string, expiresAt?: string }
  Response: { link: ReferralLink, fullUrl: string }

PUT /api/admin/agents/:id/links/:linkId
  Body: { name?: string, isActive?: boolean, expiresAt?: string }
  Response: { link: ReferralLink }

DELETE /api/admin/agents/:id/links/:linkId
  Response: { success: boolean }

GET /api/admin/agents/export
  Query: ?agentId=xxx&format=csv&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&status=confirmed
  Response: CSV file download
  Note: Экспорт для админа - просмотр рефералов любого агента. Асинхронная генерация для больших объемов.

GET /api/admin/agents/export/:taskId
  Response: CSV file download или { status: 'processing' | 'ready' | 'error', fileUrl?: string }
```

### Рефералы - общая статистика (Admin)

```
GET /api/admin/referrals/stats
  Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  Response: {
    totalAgents: number,
    totalReferrals: number,
    totalClicks: number,
    totalRegistrations: number,
    totalBookings: number,
    totalVotes: number,
    topAgents: Array<{
      agent: Agent,
      referralCount: number
    }>,
    referralsByDate: Array<{ date: string, count: number }>
  }

GET /api/admin/referrals/export
  Query: ?agentId=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&format=csv
  Response: CSV file download
  Note: Экспорт всех рефералов с фильтрами. Для больших объемов - асинхронная генерация
```

---

## WebSocket Events (Socket.io)

### Подключение

```typescript
// Клиент подключается с токеном
socket.connect({ auth: { token } })
```

### События от клиента → сервер

```typescript
// Присоединиться к комнате голосования (получить текущее состояние)
socket.emit('vote:join', { sessionId?: string })
  // Если sessionId не указан, присоединяется к активной сессии

// Проголосовать за песню
socket.emit('vote:cast', { songId: string })
  // Если пользователь уже голосовал, возвращается ошибка

// Отключиться от голосования
socket.emit('vote:leave')
```

### События от сервера → клиент

```typescript
// Инициализация состояния при подключении
socket.on('vote:state', (state: {
  sessionId: string,
  songs: Song[],
  results: {
    songs: Array<{
      songId: string,
      votes: number,
      percentage: number
    }>,
    totalVotes: number
  },
  myVote: { songId: string } | null
}))

// Обновление списка песен (когда админ добавил/удалил/изменил)
socket.on('vote:songs:updated', (songs: Song[]))

// Обновление результатов голосования (debounced, каждые 1-2 секунды)
socket.on('vote:results:updated', (results: {
  sessionId: string,
  songs: Array<{
    songId: string,
    votes: number,
    percentage: number
  }>,
  totalVotes: number
}))

// Песня включена/выключена из голосования
socket.on('vote:song:toggled', (song: Song))

// Новая сессия голосования началась
socket.on('vote:session:started', (session: VotingSession))

// Голосование завершено админом
socket.on('vote:session:ended', (finalResults: {
  sessionId: string,
  results: Array<{ song: Song, votes: number, percentage: number }>,
  totalVoters: number
}))

// Подтверждение голоса
socket.on('vote:cast:success', (data: { songId: string }))

// Ошибка
socket.on('vote:error', (error: { message: string, code?: string }))
```

---

## Безопасность

### Telegram Mini App авторизация

1. Фронтенд получает `initData` от Telegram WebApp SDK
2. Отправляет на `/api/auth/telegram` с `initData`
3. Бэкенд проверяет подпись через Telegram Bot API
4. Извлекает `user` данные
5. Возвращает JWT токен (опционально) или использует сессию

### Защита от накрутки голосов

1. Один пользователь = один голос на песню (UNIQUE constraint)
2. Проверка `user_id` из токена/сессии
3. Rate limiting: максимум N голосов в минуту
4. Redis для быстрой проверки дубликатов

### Защита админки

1. JWT токены с expiration
2. Refresh tokens
3. Роли в БД (role = 'admin')
4. Middleware проверки роли на всех admin endpoints

### Защита реферальной системы

1. Валидация referral_code при регистрации (проверка существования и активности)
2. Защита от саморефералов (агент не может быть своим рефералом)
3. Один пользователь = один агент (UNIQUE constraint на referrer_id)
4. Rate limiting на создание реферальных событий
5. Логирование IP и User-Agent для анализа подозрительной активности
6. Админ может отклонить подозрительные рефералы

---

## Производительность и оптимизация

### Кеширование (Redis)

```typescript
// Кеш активных песен (TTL: 5 минут)
cache.get('songs:active')

// Активная сессия голосования
cache.get('votes:session:active')

// Счетчики голосов в реальном времени (для текущей сессии)
cache.incr(`votes:session:${sessionId}:song:${songId}`)
cache.sadd(`votes:session:${sessionId}:voters`, userId) // уникальные голосовавшие

// Кеш результатов голосования (TTL: 2 секунды, обновляется при каждом голосе)
cache.set(`votes:session:${sessionId}:results`, results, 'EX', 2)

// Кеш заблокированных дат (TTL: 1 час)
cache.get('bookings:blocked-dates')
```

### Оптимизация запросов

1. Пагинация для списков (отзывы, бронирования, история голосований, рефералы)
2. Индексы БД на часто используемых полях
3. Lazy loading для медиа (обложки, изображения)
4. Оптимизация изображений через Sharp (автоматический ресайз, сжатие)
5. Статические файлы через Express static (локальное хранилище)
6. Кеширование статистики агентов (Redis, TTL: 5 минут)

### Экспорт CSV для больших списков (только для админов)

**Стратегия для админов (экспорт рефералов агентов):**

1. **Синхронная генерация (для малых объемов < 1000 записей):**
   - Генерация сразу в памяти через библиотеку `csv-writer` или `fast-csv`
   - Потоковая отправка клиенту через `res.setHeader('Content-Type', 'text/csv')`
   - Файл генерируется на лету и сразу отправляется админу
   - Подходит для экспорта рефералов одного агента или небольшого периода

2. **Асинхронная генерация (для больших объемов > 1000 записей):**
   - Автоматическое определение: если записей > 1000, переключается на асинхронный режим
   - Админ запрашивает экспорт → создается задача в очереди (Bull/BullMQ)
   - Возвращается `taskId` клиенту
   - Фоновая задача генерирует CSV файл
   - Файл сохраняется во временное хранилище (локально)
   - Клиент периодически проверяет статус через `GET /api/admin/agents/export/:taskId`
   - Когда готово, возвращается URL для скачивания
   - Файлы хранятся 24 часа, затем автоматически удаляются

3. **Оптимизация CSV генерации:**
   - Использовать потоки (streams) для больших файлов
   - Батчинг запросов к БД (по 1000 записей за раз)
   - Индексы на полях фильтрации (agent_id, created_at, status)
   - Очистка старых экспортированных файлов (cron job каждые 6 часов)

4. **Формат CSV для админов:**
   ```csv
   ID,Агент,Имя пользователя,Telegram Username,Telegram ID,Тип события,Статус,Дата регистрации,Дата события,Дополнительная информация
   uuid-1,Агент 1,Иван Иванов,@ivan,123456789,registration,confirmed,2024-01-15,2024-01-15,
   uuid-2,Агент 1,Петр Петров,@petr,987654321,booking,confirmed,2024-01-16,2024-01-20,Формат: MAIN SHOW
   ```

**Библиотеки:**
- `csv-writer` - простая генерация CSV
- `fast-csv` - потоковая генерация для больших объемов
- `bull` или `bullmq` - очереди задач для асинхронной обработки

### Оптимизация real-time голосования

**Стратегия обновления результатов:**
- Голоса сохраняются в БД сразу (для надежности)
- Счетчики обновляются в Redis (для скорости)
- Результаты рассылаются клиентам с debounce: **каждые 1-2 секунды** (не при каждом голосе)
- При подключении клиент получает полное состояние (список песен + текущие результаты + свой голос)
- При переподключении автоматически восстанавливается состояние через `vote:state`

**Почему debounce 1-2 секунды:**
- При 100-300 пользователях одновременные голоса будут частыми
- Отправка при каждом голосе создаст огромную нагрузку на WebSocket
- 1-2 секунды достаточно для "real-time" ощущения
- Снижает нагрузку на сервер и клиентов

### Масштабирование WebSocket

1. Redis Adapter для Socket.io (для нескольких серверов)
2. Pub/Sub для синхронизации между серверами
3. Комнаты (rooms) для группировки клиентов

---

## Структура проекта (Clean Architecture)

```
/
├── backend/
│   ├── src/
│   │   ├── domain/           # Бизнес-логика (чистая, без зависимостей)
│   │   │   ├── entities/     # Сущности (User, Booking, Song, Agent)
│   │   │   ├── services/     # Бизнес-логика (BookingService, VoteService, ReferralService)
│   │   │   └── interfaces/   # Интерфейсы для репозиториев
│   │   │
│   │   ├── infrastructure/   # Внешние зависимости
│   │   │   ├── database/     # Prisma, миграции, репозитории
│   │   │   ├── cache/        # Redis клиент
│   │   │   ├── storage/     # Файловое хранилище
│   │   │   └── external/    # Telegram Bot API
│   │   │
│   │   ├── application/      # Слой приложения
│   │   │   ├── use-cases/   # Use cases (сценарии использования)
│   │   │   ├── dto/         # Data Transfer Objects
│   │   │   └── mappers/     # Преобразование данных
│   │   │
│   │   ├── presentation/     # Слой представления
│   │   │   ├── controllers/ # HTTP контроллеры
│   │   │   ├── routes/      # Маршруты API
│   │   │   ├── middleware/  # Auth, validation, error handling
│   │   │   ├── socket/      # WebSocket handlers
│   │   │   └── validators/ # Валидация входных данных (zod)
│   │   │
│   │   ├── shared/          # Общие утилиты
│   │   │   ├── utils/      # Утилиты
│   │   │   ├── errors/      # Классы ошибок (AppError, NotFoundError)
│   │   │   ├── constants/  # Константы
│   │   │   └── types/      # Общие типы
│   │   │
│   │   ├── config/          # Конфигурация (БД, Redis, Telegram Bots)
│   │   ├── bot/             # Telegram Bot handlers
│   │   │   ├── user-bot.ts  # User Bot (Mini App)
│   │   │   └── admin-bot.ts # Admin Bot (уведомления + ссылка на админку)
│   │   ├── uploads/          # Загруженные файлы (обложки, афиши)
│   │   ├── exports/         # Временно сохраненные CSV файлы
│   │   ├── queues/          # Очереди задач (Bull/BullMQ)
│   │   └── app.ts           # Express app
│   │
│   ├── prisma/              # Prisma схемы и миграции
│   ├── tests/               # Тесты
│   ├── logs/                # Логи
│   ├── .env.example         # Шаблон переменных окружения
│   ├── package.json
│   ├── tsconfig.json
│   ├── .eslintrc.js         # ESLint конфигурация
│   ├── .prettierrc          # Prettier конфигурация
│   └── jest.config.js       # Jest конфигурация
│
├── frontend/                 # Telegram Mini App
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/         # API клиент, Socket.io
│   │   ├── utils/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── admin/                    # Админка
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── shared/                   # Общие типы
│   └── types/
│       ├── api.ts
│       ├── socket.ts
│       └── models.ts
│
└── package.json              # Root workspace
```

---

---

## Дополнительные детали

### Telegram Bots (два бота)

**1. User Bot (бот для пользователей):**
- Содержит Telegram Mini App (приложение)
- Пользователи открывают Mini App через этого бота
- Уведомления пользователям:
  - Подтверждение бронирования
  - Отмена бронирования
  - Напоминания о предстоящих событиях
- Реферальные ссылки: `https://t.me/user_bot?start={referral_code}`

**2. Admin Bot (бот для админов):**
- Содержит ссылку на админку (`your-domain.com/admin`)
- Уведомления админам:
  - Новые бронирования (с деталями: имя, дата, формат, контакты)
  - Новые пользователи (кто зарегистрировался)
  - Статистика (опционально, по запросу)
- Быстрый доступ к админке через кнопку в меню бота

### Реферальная система - логика работы

**Генерация реферальных ссылок:**
1. Агент создается админом (или пользователь получает роль `agent`)
2. Автоматически генерируется уникальный `agent_code` (например: `AGENT-ABC123`)
3. Агент может создать несколько реферальных ссылок через админку
4. Каждая ссылка имеет уникальный `link_code` (например: `REF-XYZ789`)
5. Формат ссылки: `https://t.me/user_bot?start={link_code}` (Telegram deep link через User Bot)

**Отслеживание рефералов:**
1. **Переход по ссылке:**
   - Пользователь переходит по ссылке → создается `ReferralEvent` типа `click`
   - Сохраняется `referral_link_id`, IP, User-Agent
   - В cookie/localStorage сохраняется `referral_code` (на 30 дней)

2. **Регистрация пользователя:**
   - При авторизации через Telegram Mini App проверяется наличие `referral_code` в cookie
   - Если найден → создается `ReferralEvent` типа `registration`
   - Пользователю присваивается `referrer_id` (ID агента)
   - Обновляется счетчик `total_referrals` у агента

3. **Активность реферала:**
   - При создании бронирования → создается `ReferralEvent` типа `booking` (если пользователь был привлечен агентом)
   - При голосовании → создается `ReferralEvent` типа `vote` (если пользователь был привлечен агентом)
   - Обновляется счетчик `total_active_referrals` у агента

**Защита от фрода:**
1. Один пользователь может быть рефералом только одного агента (проверка при регистрации)
2. Агент не может быть рефералом самого себя
3. Rate limiting на создание реферальных событий (максимум 10 кликов/минуту с одного IP)
4. Валидация IP и User-Agent для обнаружения подозрительной активности
5. Админ может отклонить подозрительные рефералы (статус `rejected`)

**Статистика в админке:**
- Список всех агентов с количеством рефералов
- Детальная информация по каждому агенту: кто привел, когда, какая активность
- Фильтры: по дате, по статусу, по типу события
- Экспорт в CSV: все рефералы агента или общая статистика

### Обработка изображений

- Максимальный размер файла: **5MB**
- Автоматический ресайз обложек песен: **800x800px** (с сохранением пропорций)
- Автоматический ресайз афиш: **1200x600px**
- Формат: **WebP** для оптимизации (с fallback на оригинал)
- Качество: **85%**

### Лимиты и ограничения

- Rate limiting для API: **100 запросов/минуту** на пользователя
- Rate limiting для голосования: **1 голос/секунду** на пользователя
- Максимальное количество активных песен в голосовании: **20**
- Максимальная длина текста отзыва: **1000 символов**
- Максимальное количество реферальных ссылок на агента: **10**
- Rate limiting на создание реферальных событий: **10 событий/минуту** с одного IP

### Восстановление состояния при переподключении

При переподключении WebSocket:
1. Клиент отправляет `vote:join` с `sessionId` (если знает) или без него
2. Сервер отправляет `vote:state` с полным состоянием:
   - Активная сессия (или последняя)
   - Список песен
   - Текущие результаты
   - Голос пользователя (если есть)
3. Клиент восстанавливает UI

### Логирование

**Файловые логи (рекомендуется для старта):**
- Простые логи в файлы (winston, pino)
- Хранение на сервере в папке `logs/`
- Ротация логов (старые файлы архивируются)
- Плюсы: просто, бесплатно, полный контроль
- Минусы: нужно самому мониторить, нет алертов

**Sentry (для продакшена, опционально):**
- Облачный сервис для отслеживания ошибок
- Автоматические алерты при ошибках
- Красивые дашборды и аналитика
- Плюсы: удобно, автоматические уведомления, группировка ошибок
- Минусы: платно (есть бесплатный тариф), зависимость от внешнего сервиса

**Рекомендация:** Начать с файловых логов (winston), при необходимости добавить Sentry позже.

### Переменные окружения (.env)

```env
# База данных
DATABASE_URL=postgresql://user:password@localhost:5432/musicians

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Telegram Bots
TELEGRAM_USER_BOT_TOKEN=your_user_bot_token
TELEGRAM_ADMIN_BOT_TOKEN=your_admin_bot_token

# JWT для админки
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Сервер
PORT=3000
NODE_ENV=development

# Домен
DOMAIN=your-domain.com
ADMIN_PATH=/admin

# Файлы
UPLOAD_DIR=./uploads
EXPORT_DIR=./exports
MAX_FILE_SIZE=5242880
```

---

## Качество кода

**Принципы:**
- ✅ DRY (Don't Repeat Yourself) - никакого дублирования
- ✅ SOLID принципы - чистая архитектура
- ✅ KISS - простота решений
- ✅ Clean Code - читаемый, понятный код
- ✅ Repository Pattern - абстракция доступа к данным
- ✅ Service Layer - бизнес-логика в сервисах
- ✅ Dependency Injection - тестируемость
- ✅ Типизированные ошибки - правильная обработка
- ✅ Валидация данных - на всех уровнях
- ✅ Структурированное логирование

**Инструменты:**
- ESLint + Prettier - единый стиль
- TypeScript strict mode - строгая типизация
- Husky + lint-staged - pre-commit hooks
- Jest - тестирование

Подробнее см. `CODE_QUALITY.md`

---

## Следующие шаги

1. ✅ Архитектура готова и обновлена
2. ✅ Принципы качества кода определены
3. ⏭ Настроить структуру backend проекта (Clean Architecture)
4. ⏭ Настроить инструменты качества (ESLint, Prettier, TypeScript)
5. ⏭ Создать модели и миграции БД (Prisma)
6. ⏭ Реализовать API endpoints (с валидацией и обработкой ошибок)
7. ⏭ Настроить WebSocket для голосования с debounce
8. ⏭ Добавить авторизацию (Telegram + Admin)
9. ⏭ Настроить Telegram Bots (User Bot + Admin Bot)
10. ⏭ Добавить обработку изображений (Sharp)
11. ⏭ Создать frontend структуру
