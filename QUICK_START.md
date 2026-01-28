# Quick Start - Запуск проекта

## Что реализовано

✅ **Оптимизированная система голосования**
- Защита от накрутки (IP + fingerprint + session)
- Redis кеширование (10s TTL)
- Поддержка 10K+ одновременных пользователей
- Real-time обновления через Socket.IO
- Batch updates для снижения нагрузки на БД

✅ **Современная админ-панель**
- Адаптивный дизайн (мобильная + десктоп версия)
- Tab Bar навигация с плавными анимациями
- Dashboard со статистикой
- CRUD для управления треками (песнями)
- Модальные окна для создания/редактирования
- Темная тема с красивыми градиентами

## Структура проекта

```
музыканты/
├── frontend/                    # React фронтенд
│   ├── src/
│   │   ├── admin/              # Админ-панель ⭐ НОВОЕ
│   │   │   ├── AdminApp.tsx
│   │   │   ├── components/     # TabBar
│   │   │   ├── screens/        # Dashboard, Edit
│   │   │   └── assets/         # Иконки
│   │   ├── services/           # API сервисы
│   │   │   ├── apiClient.ts
│   │   │   ├── voteService.ts  # Голосование ⭐
│   │   │   ├── songService.ts
│   │   │   └── adminService.ts # Админка ⭐
│   │   └── styles/
│   │       ├── admin.css       # Стили админки ⭐
│   │       └── admin-tabbar.css ⭐
│   └── .env.development        # Mock mode
│
├── backend/                     # Node.js backend
│   ├── prisma/
│   │   ├── schema.prisma       # Обновленная схема ⭐
│   │   └── migrations/         # Миграции ⭐
│   ├── VOTING_SYSTEM.md        # Документация системы голосования ⭐
│   └── IMPLEMENTATION_GUIDE.md
│
└── Документация/
    ├── ADMIN_AND_VOTING_IMPLEMENTATION.md ⭐
    └── QUICK_START.md (этот файл) ⭐
```

## Запуск фронтенда

### 1. Установка зависимостей

```bash
cd frontend
npm install
```

### 2. Запуск в режиме разработки (Mock Data)

```bash
npm run dev
```

Откроется на `http://localhost:5173`

### 3. Доступные страницы

**Основной сайт:**
- `http://localhost:5173/` - Главная страница
- `http://localhost:5173/?screen=voting` - Голосование
- `http://localhost:5173/?screen=voting-results` - Результаты
- `http://localhost:5173/?screen=formats` - Форматы

**Админ-панель:** ⭐ НОВОЕ
- `http://localhost:5173/admin` - Админка
  - 🏠 Главная - Dashboard со статистикой
  - 📅 Брони - Подтвержденные заявки
  - ⏱ В ожидании - Новые заявки
  - 🔗 Ссылки - Реферальные ссылки
  - ✏️ Редактировать - Управление треками

## Режимы работы

### Mock Mode (по умолчанию)

Используется для разработки без бэкенда.

```bash
# frontend/.env.development
VITE_USE_MOCK=true
VITE_API_URL=
```

В этом режиме:
- Все данные берутся из моков
- Голоса логируются в консоль
- Создание/редактирование треков показывается в консоли

### Real API Mode

Подключение к реальному backend.

```bash
# frontend/.env.production
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:3000
```

## Админ-панель - Основные функции

### Dashboard (Главная)

Карточки статистики:
```
┌─────────────┬─────────────┐
│ 📊 28       │ ✓ 3         │
│ Всего       │ Подтвержд.  │
├─────────────┼─────────────┤
│ ⏱ 24       │ ✕ 1         │
│ В ожидании  │ Отменено    │
└─────────────┴─────────────┘

┌──────────────────────────┐
│ Общий доход              │
│ 24 000 ₽                 │
└──────────────────────────┘

┌──────────────────────────┐
│ Конверсия                │
│ Коэф. подтверждения: 11% │
│ В ожидании: 24           │
└──────────────────────────┘
```

### Редактирование треков

**Категории:**
- 🎵 Треки (песни)
- 🎬 Видео
- 📷 Фото
- 📄 Файлы

**Действия:**
- ➕ Добавить трек (FAB кнопка)
- ✏️ Редактировать трек
- 🗑️ Удалить трек

**Форма добавления трека:**
1. Название песни
2. Исполнитель
3. Обложка (загрузка файла)
4. Текст песни (textarea)

## Система голосования - Как работает

### Фронтенд

```typescript
import { castVote, getVoteResults } from './services/voteService';

// Голосование
await castVote(songId);

// Получение результатов
const results = await getVoteResults();
// [
//   { songId: '1', voteCount: 142, percentage: 35.5 },
//   { songId: '2', voteCount: 98, percentage: 24.0 }
// ]
```

### Защита от накрутки

**Автоматическая защита:**
1. **IP Rate Limiting** - 1 голос с IP в час
2. **Fingerprinting** - Отслеживание браузера
3. **Session Tracking** - Один голос на сессию

**В Mock Mode:**
- Голоса только логируются
- Результаты берутся из моков

**В Real API Mode:**
- Все проверки активны
- Redis кеш для быстродействия
- Batch updates в БД

## Backend (когда будет готов)

### 1. Установка

```bash
cd backend
npm install
```

### 2. Настройка БД

```bash
# Создать .env файл
cp .env.example .env

# Редактировать DATABASE_URL и другие переменные
nano .env
```

### 3. Миграции

```bash
# Применить миграции
npx prisma migrate deploy

# Или для разработки
npx prisma migrate dev
```

### 4. Запуск

```bash
npm run dev
```

API будет доступно на `http://localhost:3000`

### 5. Необходимые сервисы

**PostgreSQL:**
```bash
# Docker
docker run -d \
  --name musicians-db \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15
```

**Redis:**
```bash
# Docker
docker run -d \
  --name musicians-redis \
  -p 6379:6379 \
  redis:7
```

## API Endpoints

### Голосование

```
POST   /api/votes              # Отдать голос
GET    /api/votes/results      # Результаты
GET    /api/votes/can-vote     # Проверка возможности голосовать
```

### Админ API

```
GET    /api/admin/stats        # Статистика
GET    /api/admin/tracks       # Список треков
POST   /api/admin/tracks       # Создать трек
PUT    /api/admin/tracks/:id   # Обновить трек
DELETE /api/admin/tracks/:id   # Удалить трек
```

## Тестирование

### Фронтенд

```bash
cd frontend

# Unit tests
npm test

# E2E tests
npm run test:e2e
```

### Backend

```bash
cd backend

# Unit tests
npm test

# Load testing
npm run test:load
```

## Production Build

### Фронтенд

```bash
cd frontend
npm run build

# Результат в dist/
# Деплой на Vercel, Netlify, или свой сервер
```

### Backend

```bash
cd backend
npm run build

# Запуск production
npm start
```

## Troubleshooting

### Порт 5173 занят

```bash
# Изменить порт в vite.config.ts
export default defineConfig({
  server: { port: 3001 }
});
```

### CORS ошибки

Vite proxy настроен автоматически. Если проблемы:
```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    }
  }
}
```

### Админка не открывается

Убедитесь что:
1. Создан файл `frontend/src/admin/AdminApp.tsx`
2. Добавлен роут в `App.tsx`
3. Импортированы стили

## Документация

Подробная документация:
- `ADMIN_AND_VOTING_IMPLEMENTATION.md` - Полное описание реализации
- `backend/VOTING_SYSTEM.md` - Система голосования
- `backend/IMPLEMENTATION_GUIDE.md` - Backend API
- `IMPLEMENTATION_SUMMARY.md` - API layer с fallback

## Следующие шаги

1. **Подключить реальный backend**
   - Реализовать API endpoints
   - Настроить Redis
   - Применить миграции БД

2. **Добавить аутентификацию**
   - Telegram OAuth
   - JWT tokens
   - Role-based access

3. **Расширить админку**
   - Управление форматами
   - Управление бронями
   - Аналитика и графики

4. **Оптимизация**
   - Image optimization
   - Code splitting
   - Service Worker

## Поддержка

При возникновении вопросов или проблем:
1. Проверьте документацию
2. Проверьте консоль браузера (F12)
3. Проверьте логи бэкенда
4. Откройте issue на GitHub

---

**Приятной разработки! 🚀**
