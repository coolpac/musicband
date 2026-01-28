# Инструкция по настройке

## Шаг 1: Установка зависимостей

```bash
cd backend
npm install
```

## Шаг 2: Настройка переменных окружения

```bash
cp .env.example .env
```

Отредактируйте `.env` файл и укажите:
- `DATABASE_URL` - строка подключения к PostgreSQL
- `REDIS_HOST`, `REDIS_PORT` - настройки Redis
- `TELEGRAM_USER_BOT_TOKEN` - токен User Bot (создайте через @BotFather)
- `TELEGRAM_ADMIN_BOT_TOKEN` - токен Admin Bot (создайте через @BotFather)
- `JWT_SECRET` - секретный ключ для JWT (используйте сильный ключ в продакшене)

## Шаг 3: Настройка базы данных

```bash
# Сгенерировать Prisma клиент
npm run prisma:generate

# Создать миграцию и применить её
npm run prisma:migrate

# (Опционально) Открыть Prisma Studio для просмотра данных
npm run prisma:studio
```

## Шаг 4: Запуск

```bash
# Режим разработки (с hot reload)
npm run dev

# Production сборка
npm run build
npm start
```

## Проверка работы

После запуска сервера откройте:
- `http://localhost:3000/health` - проверка здоровья сервера
- `http://localhost:3000/api` - информация об API

## Создание первого админа

После настройки БД, создайте первого админа через Prisma Studio или SQL:

```sql
INSERT INTO users (id, telegram_id, username, first_name, role, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  123456789, -- ваш Telegram ID
  'your_username',
  'Your Name',
  'admin',
  NOW(),
  NOW()
);
```

## Структура проекта

```
backend/
├── src/
│   ├── domain/          # Бизнес-логика
│   ├── infrastructure/  # БД, Redis, внешние сервисы
│   ├── application/     # Use cases, DTO
│   ├── presentation/    # Контроллеры, routes, middleware
│   ├── shared/          # Утилиты, ошибки, константы
│   └── config/          # Конфигурация
├── prisma/              # Prisma схемы
└── tests/               # Тесты
```

## Следующие шаги

1. ✅ Базовая структура создана
2. ⏭ Реализовать авторизацию (Telegram + Admin)
3. ⏭ Реализовать API endpoints
4. ⏭ Настроить WebSocket для голосования
5. ⏭ Настроить Telegram Bots
6. ⏭ Добавить обработку изображений
