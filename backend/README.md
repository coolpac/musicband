# Backend - Музыканты

Backend для Telegram Mini App с бронированием и голосованием в реальном времени.

## Технологии

- Node.js + TypeScript
- Express
- Prisma (PostgreSQL)
- Redis
- Socket.io
- BullMQ
- Winston (логирование)

## Установка

```bash
# Установить зависимости
npm install

# Настроить переменные окружения
cp .env.example .env
# Отредактировать .env файл

# Сгенерировать Prisma клиент
npm run prisma:generate

# Запустить миграции БД
npm run prisma:migrate

# Запустить в режиме разработки
npm run dev
```

## Структура проекта

```
src/
├── domain/           # Бизнес-логика
├── infrastructure/   # Внешние зависимости
├── application/      # Use cases, DTO
├── presentation/     # Контроллеры, routes, middleware
├── shared/           # Утилиты, ошибки, константы
└── config/           # Конфигурация
```

## Скрипты

- `npm run dev` - запуск в режиме разработки
- `npm run build` - сборка проекта
- `npm run start` - запуск production версии
- `npm run lint` - проверка кода
- `npm run format` - форматирование кода
- `npm test` - запуск тестов

## Принципы качества

См. `CODE_QUALITY.md` в корне проекта.
