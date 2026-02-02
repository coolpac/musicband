#!/usr/bin/env bash
set -euo pipefail

# ===================================
# Музыканты — Deploy Script
# ===================================
# Использование:
#   ./deploy.sh              — полный деплой
#   ./deploy.sh --backend    — только backend
#   ./deploy.sh --frontend   — только frontend
#   ./deploy.sh --migrate    — только миграции БД
#   ./deploy.sh --rollback   — откат на предыдущую версию

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Переход в директорию проекта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Проверка зависимостей
command -v docker >/dev/null 2>&1 || { error "Docker не установлен"; exit 1; }
command -v docker compose >/dev/null 2>&1 || { error "Docker Compose не установлен"; exit 1; }
command -v git >/dev/null 2>&1 || { error "Git не установлен"; exit 1; }

# Проверка .env файла
if [ ! -f .env ]; then
    error ".env файл не найден! Скопируйте .env.example → .env и заполните"
    exit 1
fi

# Загрузка .env для использования в скрипте (backup_db и т.д.)
set -a
# shellcheck source=/dev/null
. ./.env
set +a

# Сохраняем текущий commit для rollback
PREV_COMMIT=$(git rev-parse HEAD)
CURRENT_BRANCH=$(git branch --show-current)

log "Текущий commit: ${PREV_COMMIT:0:8}"
log "Ветка: $CURRENT_BRANCH"

# ===== Функции =====

backup_db() {
    log "Создание бэкапа БД..."
    BACKUP_FILE="backups/db_$(date +%Y%m%d_%H%M%S).sql"
    mkdir -p backups
    docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-musicians}" \
        "${POSTGRES_DB:-musicians_db}" > "$BACKUP_FILE"
    log "Бэкап сохранён: $BACKUP_FILE"
}

run_migrations() {
    log "Запуск миграций Prisma (новый образ backend)..."
    docker compose run --rm backend npx prisma migrate deploy
    log "Миграции применены"
}

deploy_backend() {
    log "Деплой backend..."
    # Обновляем код если не полный деплой
    if [ "${FULL_DEPLOY:-false}" != "true" ]; then
        log "Получение обновлений из git..."
        git pull origin "$CURRENT_BRANCH"
    fi
    
    docker compose up -d --no-deps --build backend

    # Ждём пока health check пройдёт
    log "Ожидание health check..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if docker compose exec -T backend wget -qO- http://localhost:3000/health/live 2>/dev/null; then
            log "Backend готов!"
            return 0
        fi
        retries=$((retries - 1))
        sleep 2
    done
    error "Backend не прошёл health check за 60 секунд!"
    return 1
}

deploy_frontend() {
    log "Деплой frontend..."
    # Обновляем код если не полный деплой
    if [ "${FULL_DEPLOY:-false}" != "true" ]; then
        log "Получение обновлений из git..."
        git pull origin "$CURRENT_BRANCH"
    fi
    
    docker compose up -d --no-deps --build frontend
    log "Frontend обновлён"
}

rollback() {
    warn "Откат на commit: ${PREV_COMMIT:0:8}"
    git checkout "$PREV_COMMIT"
    docker compose build backend frontend
    docker compose up -d backend frontend
    log "Откат завершён"
}

full_deploy() {
    log "===== Полный деплой ====="
    export FULL_DEPLOY=true

    # 1. Получаем обновления
    log "Получение обновлений из git..."
    git pull origin "$CURRENT_BRANCH"

    # 2. Бэкап БД
    backup_db

    # 3. Собираем новые образы (с кешем для ускорения)
    log "Сборка Docker образов..."
    docker compose build --pull

    # 4. Миграции (из нового образа backend)
    run_migrations

    # 5. Перезапуск backend
    deploy_backend || { rollback; exit 1; }

    # 6. Перезапуск frontend
    deploy_frontend

    # 7. Очистка
    log "Очистка старых образов..."
    docker image prune -f

    log "===== Деплой завершён успешно! ====="
    docker compose ps
    
    unset FULL_DEPLOY
}

# ===== Main =====

case "${1:-}" in
    --backend)
        backup_db
        deploy_backend
        ;;
    --frontend)
        deploy_frontend
        ;;
    --migrate)
        backup_db
        run_migrations
        ;;
    --rollback)
        rollback
        ;;
    *)
        full_deploy
        ;;
esac
