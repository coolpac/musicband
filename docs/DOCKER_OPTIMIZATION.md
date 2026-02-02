# 🐳 Docker Optimization Guide

## Оптимизации в проекте

### 1. Multi-Stage Builds

Все Dockerfile используют multi-stage сборку для минимизации размера финальных образов:

#### Backend (3 стадии)
```
Stage 1 (deps):    node:20-alpine + все зависимости + Prisma → ~500MB
Stage 2 (build):   копируем node_modules + компилируем TS → ~600MB
Stage 3 (prod):    только production deps + compiled JS → ~250MB ✓
```

**Результат:** Финальный образ в 2-3 раза меньше чем с одностадийной сборкой.

#### Frontend (2 стадии)
```
Stage 1 (build):   node:20-alpine + сборка Vite → ~400MB
Stage 2 (prod):    nginx:alpine + static files → ~25MB ✓
```

**Результат:** Финальный образ всего 25MB против 400MB+.

### 2. Layer Caching Strategy

Dockerfile структурированы для максимального использования кеша:

```dockerfile
# ✅ Правильный порядок (от редко меняющихся к часто меняющимся)
COPY package.json package-lock.json ./   # Меняется редко
RUN npm ci                                # Кешируется пока package.json не изменился
COPY . .                                  # Меняется часто (код)
RUN npm run build                         # Пересобирается только при изменении кода
```

**Результат при изменении только кода:**
- ❌ Без оптимизации: 5-10 минут (переустановка всех зависимостей)
- ✅ С оптимизацией: 30-60 секунд (только компиляция)

### 3. .dockerignore

Исключаем ненужные файлы из контекста сборки:

```
node_modules    # Переустановим через npm ci
dist            # Пересоберём
*.md            # Документация не нужна в образе
.git            # История не нужна
tests/          # Тесты не нужны в production
coverage/       # Coverage отчёты не нужны
```

**Результат:**
- Контекст сборки: ~50MB вместо ~500MB
- Скорость передачи контекста: 1 сек вместо 10+ сек

### 4. npm ci vs npm install

Используем `npm ci` вместо `npm install`:

```dockerfile
RUN npm ci  # ✅ Чище, быстрее, детерминировано
```

**Преимущества:**
- Удаляет node_modules перед установкой (чистая установка)
- Использует package-lock.json строго
- На 2x быстрее в CI окружении
- Fail fast если package.json и lock расходятся

### 5. npm cache clean

```dockerfile
RUN npm ci --omit=dev && npm cache clean --force
```

**Результат:** Экономия ~100MB на финальном образе.

### 6. Alpine Linux Base Images

```dockerfile
FROM node:20-alpine    # ~50MB базовый образ
# vs
FROM node:20           # ~900MB базовый образ
```

**Преимущества:**
- Меньше размер (в 18 раз!)
- Меньше поверхность атаки
- Быстрее pull/push

**Недостатки:**
- Нужны дополнительные пакеты для native модулей (python3, make, g++)

### 7. BuildKit Optimizations

Docker Compose использует BuildKit автоматически (Docker 19.03+):

```bash
docker compose build --pull  # ✅ С кешем, обновляет base images
# vs
docker compose build --no-cache  # ❌ Без кеша, долго
```

**Команды в deploy.sh:**
- Full deploy: `docker compose build --pull` (обновляет базовые образы, использует кеш слоёв)
- Partial deploy: `docker compose up -d --build` (использует максимум кеша)

### 8. Non-root User Security

Backend запускается от непривилегированного пользователя:

```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

**Безопасность:**
- Эксплойт не даёт root доступ к контейнеру
- Best practice для production

### 9. Health Checks

Встроенные health checks для всех сервисов:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1
```

**Используется:**
- Docker Compose (depends_on с condition: service_healthy)
- Kubernetes (readinessProbe/livenessProbe)
- AWS ECS, Azure Container Instances и т.д.

## Сравнение размеров образов

| Сервис | Без оптимизации | С оптимизацией | Экономия |
|--------|----------------|----------------|----------|
| Backend | ~800MB | ~250MB | **68%** |
| Frontend | ~450MB | ~25MB | **94%** |
| PostgreSQL | 245MB | 245MB | - |
| Redis | 40MB | 40MB | - |
| **Итого** | ~1535MB | ~560MB | **63%** |

## Build Performance

### Первая сборка (холодный кеш)
```bash
time docker compose build
# Без оптимизации: 8-12 минут
# С оптимизацией:  5-7 минут
```

### Пересборка после изменения кода
```bash
time docker compose build
# Без оптимизации: 8-12 минут (пересобирает всё)
# С оптимизацией:  1-2 минуты (использует кеш npm)
```

### Пересборка после изменения зависимости
```bash
npm install new-package
time docker compose build
# Без оптимизации: 8-12 минут
# С оптимизацией:  5-7 минут (инвалидирует кеш npm)
```

## Deploy Script Optimizations

### До оптимизации

```bash
full_deploy() {
    docker compose build              # Сборка всех образов
    run_migrations
    docker compose build --no-cache backend   # ❌ Двойная сборка!
    docker compose up -d backend
    docker compose build --no-cache frontend  # ❌ Двойная сборка!
    docker compose up -d frontend
}
```

**Проблема:** Backend и frontend собираются дважды → 2x время.

### После оптимизации

```bash
full_deploy() {
    git pull
    docker compose build --pull       # ✅ Одна сборка с кешем
    run_migrations
    docker compose up -d backend      # ✅ Использует уже собранный образ
    docker compose up -d frontend     # ✅ Использует уже собранный образ
}

deploy_backend() {
    git pull                          # ✅ Обновляем код
    docker compose up -d --build backend  # ✅ Сборка + старт за один шаг
}
```

**Результат:**
- Full deploy: ~7 мин → ~5 мин (**28% быстрее**)
- Partial deploy: добавлен git pull, но сборка быстрее благодаря кешу

## Best Practices Checklist

- ✅ Multi-stage builds для минимизации размера
- ✅ Правильный порядок COPY для кеширования
- ✅ .dockerignore для уменьшения контекста
- ✅ npm ci вместо npm install
- ✅ npm cache clean для уменьшения размера
- ✅ Alpine base images
- ✅ Non-root user для безопасности
- ✅ Health checks для orchestration
- ✅ BuildKit для параллельной сборки
- ✅ Избегаем двойных сборок в скриптах

## Дополнительные оптимизации (опционально)

### 1. External Cache для CI/CD

```bash
docker buildx build --cache-from type=registry,ref=myregistry/cache \
                    --cache-to type=registry,ref=myregistry/cache \
                    --push -t myapp .
```

### 2. BuildKit Secret Mounts

```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci
```

### 3. Parallel Builds

```bash
docker compose build --parallel  # Собирает сервисы параллельно
```

### 4. Prune Regular Cleanup

```bash
docker image prune -f            # Удаляет dangling images
docker system prune -af --volumes  # Полная очистка (осторожно!)
```

## Мониторинг размера образов

```bash
# Размер образов
docker images | grep musicians

# Детальная информация
docker image inspect musicians-backend:latest | grep Size

# История слоёв
docker history musicians-backend:latest
```

---

**Документация:**
- [Docker Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Optimize cache usage](https://docs.docker.com/build/cache/optimize/)
- [Best practices](https://docs.docker.com/develop/dev-best-practices/)
