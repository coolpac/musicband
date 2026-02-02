#!/usr/bin/env bash
set -euo pipefail

echo "======================================="
echo "  Музыканты — Первый запуск"
echo "======================================="

# 1. Проверка Docker
if ! command -v docker &>/dev/null; then
    echo "Установка Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "Docker установлен. Перелогиньтесь и запустите скрипт снова."
    exit 0
fi

if ! docker compose version &>/dev/null; then
    echo "Установка Docker Compose plugin..."
    sudo apt-get update -qq && sudo apt-get install -y docker-compose-plugin
fi

# 2. Создание .env из примера
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "⚠️  Файл .env создан из .env.example"
    echo "⚠️  ОБЯЗАТЕЛЬНО отредактируйте .env перед продолжением!"
    echo ""
    echo "Что заполнить:"
    echo "  1. POSTGRES_PASSWORD — сгенерируйте: openssl rand -hex 16"
    echo "  2. REDIS_PASSWORD — сгенерируйте: openssl rand -hex 16"
    echo "  3. JWT_SECRET — сгенерируйте: openssl rand -hex 32"
    echo "  4. TELEGRAM_ADMIN_BOT_TOKEN — получите у @BotFather"
    echo "  5. TELEGRAM_USER_BOT_TOKEN — получите у @BotFather"
    echo "  6. FRONTEND_URL — ваш домен (https://example.com)"
    echo ""
    read -p "Отредактировали .env? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Отредактируйте .env и запустите скрипт снова."
        exit 0
    fi
fi

# 3. Валидация обязательных переменных
set -a
# shellcheck source=/dev/null
. ./.env
set +a

REQUIRED_VARS=(POSTGRES_PASSWORD REDIS_PASSWORD JWT_SECRET TELEGRAM_ADMIN_BOT_TOKEN FRONTEND_URL)
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ] || [[ "${!var}" == *"CHANGE_ME"* ]] || [[ "${!var}" == *"your-"* ]]; then
        echo "❌ Переменная $var не настроена в .env!"
        exit 1
    fi
done
echo "✅ Все обязательные переменные заполнены"

# 4. Создание директорий
mkdir -p backups

# 5. Запуск инфраструктуры (DB + Redis)
echo "Запуск PostgreSQL и Redis..."
docker compose up -d postgres redis

# Ждём готовности
echo "Ожидание готовности PostgreSQL..."
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-musicians}" -d "${POSTGRES_DB:-musicians_db}" 2>/dev/null; then
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "❌ PostgreSQL не готов за 30 секунд"
        exit 1
    fi
    sleep 1
done
echo "✅ PostgreSQL готов"

# 6. Сборка backend
echo "Сборка backend..."
docker compose build backend

# 7. Миграции Prisma (через одноразовый контейнер, чтобы не зависеть от состояния backend)
echo "Применение миграций БД..."
docker compose run --rm backend npx prisma migrate deploy
echo "✅ Миграции применены"

# 8. Запуск backend
echo "Запуск backend..."
docker compose up -d backend

# Ждём готовности backend
echo "Ожидание готовности backend..."
for i in {1..30}; do
    if docker compose exec -T backend wget -qO- http://localhost:3000/health/live 2>/dev/null; then
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "⚠️ Backend долго запускается, продолжаем..."
    fi
    sleep 2
done

# 9. Сборка и запуск frontend
echo "Сборка frontend..."
docker compose build frontend

echo "Запуск frontend..."
docker compose up -d frontend

# 10. Проверка
echo ""
echo "======================================="
echo "  Проверка статуса сервисов"
echo "======================================="
docker compose ps

echo ""
echo "Проверка health endpoints..."
sleep 5
curl -sf "http://localhost:${APP_PORT:-80}/health" >/dev/null && echo "✅ Frontend /health OK" || echo "⚠️ Frontend ещё запускается..."
curl -sf "http://localhost:${APP_PORT:-80}/api/formats" >/dev/null && echo "✅ Backend API OK" || echo "⚠️ Backend API ещё запускается"

echo ""
echo "======================================="
echo "  ✅ Установка завершена!"
echo "======================================="
echo ""
echo "Полезные команды:"
echo "  docker compose logs -f backend    — логи backend"
echo "  docker compose logs -f frontend   — логи frontend"
echo "  docker compose ps                 — статус сервисов"
echo "  ./deploy.sh                       — обновление"
echo "  ./deploy.sh --rollback            — откат"
echo ""
