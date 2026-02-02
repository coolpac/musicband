# 🚀 Руководство по деплою на сервер 89.223.64.110

## Подготовка к деплою

### 🚀 Автоматическая настройка с нуля (рекомендуется)

Для **полностью чистого сервера** используйте `server-provision.sh`:

```bash
# С вашего локального компьютера
chmod +x scripts/*.sh

# Полная автоматическая настройка сервера
REMOTE_HOST=89.223.64.110 ./scripts/server-provision.sh \
  https://github.com/username/musicians.git vgulcover.ru
```

**Что делает скрипт:**
- ✅ Обновляет систему (apt update && upgrade)
- ✅ Устанавливает Docker + Docker Compose
- ✅ Настраивает firewall (UFW: порты 22, 80, 443)
- ✅ Клонирует репозиторий в /opt/musicians
- ✅ Генерирует безопасные пароли (POSTGRES, REDIS, JWT)
- ✅ Создаёт .env файл с автоматически сгенерированными секретами

**После выполнения скрипта:**

```bash
# 1. Подключаемся к серверу
ssh root@89.223.64.110
cd /opt/musicians

# 2. Добавляем Telegram bot tokens в .env
nano .env
# Заполнить:
#   TELEGRAM_ADMIN_BOT_TOKEN=123456:ABC-DEF... (получить у @BotFather)
#   TELEGRAM_USER_BOT_TOKEN=654321:XYZ-ABC... (опционально)

# 3. Запускаем первую установку
./init.sh
```

### 📝 Вариант 2: Ручная установка (если сервер уже настроен)

```bash
# 1. Подключение к серверу
ssh root@89.223.64.110

# 2. Установка зависимостей
apt update && apt upgrade -y
apt install -y git curl wget

# 3. Клонирование проекта
cd /opt
git clone <repository-url> musicians
cd musicians

# 4. Делаем скрипты исполняемыми
chmod +x init.sh deploy.sh scripts/*.sh
```

## Настройка окружения

### 1. Создание .env файла

```bash
# Копируем пример
cp .env.example .env

# Редактируем (используйте nano, vim или vi)
nano .env
```

### 2. Заполнение обязательных переменных

```bash
# Генерация паролей и секретов
POSTGRES_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)

# Добавить в .env:
POSTGRES_DB=musicians_db
POSTGRES_USER=musicians
POSTGRES_PASSWORD=<generated-password>

REDIS_PASSWORD=<generated-password>

JWT_SECRET=<generated-secret>
JWT_EXPIRES_IN=7d

# Telegram боты (получить у @BotFather)
TELEGRAM_ADMIN_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_USER_BOT_TOKEN=654321:XYZ-ABC...
TELEGRAM_USER_BOT_USERNAME=YourBotUsername

# URLs
FRONTEND_URL=http://89.223.64.110
# Или если есть домен:
# FRONTEND_URL=https://musicians.example.com

# Порт (по умолчанию 80)
APP_PORT=80
```

### 3. Генерация хеша пароля админа (опционально)

```bash
# На сервере или локально с Node.js:
node -e "const bcrypt=require('bcrypt'); bcrypt.hash('your-admin-password',10).then(console.log)"

# Добавить в .env:
# ADMIN_PASSWORD_HASH=<generated-hash>
```

## Первый запуск

```bash
# Делаем скрипты исполняемыми
chmod +x init.sh deploy.sh scripts/*.sh

# Запускаем первую установку
./init.sh
```

Скрипт `init.sh`:
- ✅ Установит Docker (если нужно)
- ✅ Создаст .env из примера (если не существует)
- ✅ Проверит обязательные переменные
- ✅ Запустит PostgreSQL и Redis
- ✅ Соберёт и запустит backend
- ✅ Применит миграции БД
- ✅ Соберёт и запустит frontend
- ✅ Проверит health endpoints

### Что делать если init.sh требует Docker перелогин

```bash
# После установки Docker:
exit
ssh root@89.223.64.110
cd /opt/musicians
./init.sh
```

## Обновление (деплой изменений)

```bash
# Полный деплой (backend + frontend + миграции)
./deploy.sh

# Только backend
./deploy.sh --backend

# Только frontend
./deploy.sh --frontend

# Только миграции
./deploy.sh --migrate

# Откат на предыдущую версию
./deploy.sh --rollback
```

## Запуск деплоя с локального компьютера

Скрипты в `scripts/` позволяют запускать `init.sh` и `deploy.sh` по SSH.

```bash
# Первый запуск на сервере
chmod +x scripts/remote-init.sh scripts/remote-deploy.sh
REMOTE_HOST=89.223.64.110 REMOTE_USER=root REMOTE_PATH=/opt/musicians ./scripts/remote-init.sh

# Деплой обновлений
REMOTE_HOST=89.223.64.110 REMOTE_USER=root REMOTE_PATH=/opt/musicians ./scripts/remote-deploy.sh
REMOTE_HOST=89.223.64.110 REMOTE_USER=root REMOTE_PATH=/opt/musicians ./scripts/remote-deploy.sh --backend

# Дополнительно (при необходимости)
# REMOTE_PORT=22
# SSH_KEY=~/.ssh/id_rsa
```

## Проверка работы

```bash
# Статус сервисов
docker compose ps

# Логи backend
docker compose logs -f backend

# Логи frontend
docker compose logs -f frontend

# Проверка health endpoints
curl http://localhost/health
curl http://localhost/api/formats
```

## Управление видео

Видео хранятся в `frontend/public/videos/` и раздаются напрямую через Nginx.

**Размер:** ~107 MB (оптимизированные + превью)

Убедитесь что в `.gitignore` добавлены видео (уже сделано):
```
public/videos/*.mp4
public/videos/*.mov
public/videos/thumbs/*.jpg
```

## Nginx конфигурация (если нужен SSL)

Если у вас есть домен и нужен HTTPS:

```bash
# Установка Certbot
apt install -y certbot

# Получение сертификата
certbot certonly --standalone -d musicians.example.com

# Добавить в docker-compose.yml (frontend):
ports:
  - "80:80"
  - "443:443"
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro

# Обновить frontend/nginx/default.conf для SSL
```

## Бэкапы

Скрипт `deploy.sh` автоматически создаёт бэкап БД перед каждым деплоем в `backups/`.

Ручной бэкап:
```bash
# Создание бэкапа
docker compose exec -T postgres pg_dump -U musicians musicians_db > backup_$(date +%Y%m%d).sql

# Восстановление
docker compose exec -T postgres psql -U musicians musicians_db < backup_20260202.sql
```

## Мониторинг ресурсов

```bash
# Использование ресурсов
docker stats

# Размер образов
docker images

# Размер volumes
docker system df -v
```

## Структура проекта на сервере

```
/opt/musicians/
├── .env                    # Переменные окружения (НЕ коммитить!)
├── docker-compose.yml      # Конфигурация Docker
├── init.sh                 # Первый запуск
├── deploy.sh               # Деплой обновлений
├── backend/                # Backend (Node.js + Prisma)
│   ├── Dockerfile
│   ├── prisma/
│   └── src/
├── frontend/               # Frontend (React + Vite)
│   ├── Dockerfile
│   ├── nginx/
│   ├── public/videos/      # Видео для лайва
│   └── src/
├── backups/                # Бэкапы БД (создаётся автоматически)
└── docs/                   # Документация
```

## Порты

- **80** — Frontend (Nginx) + Backend API (проксируется)
- **443** — HTTPS (если настроен SSL)
- **5432** — PostgreSQL (внутри Docker сети)
- **6379** — Redis (внутри Docker сети)
- **3000** — Backend (внутри Docker сети)

## Troubleshooting

### Backend не запускается

```bash
docker compose logs backend
# Проверить DATABASE_URL, JWT_SECRET, TELEGRAM_ADMIN_BOT_TOKEN
```

### Frontend показывает ошибку API

```bash
# Проверить что backend запущен
docker compose ps backend

# Проверить логи Nginx
docker compose logs frontend
```

### Миграции не применяются

```bash
# Проверить подключение к БД
docker compose exec postgres pg_isready -U musicians -d musicians_db

# Применить вручную
docker compose exec backend npx prisma migrate deploy
```

### Видео не загружаются

```bash
# Проверить наличие файлов
ls -lh frontend/public/videos/

# Проверить Nginx конфиг
docker compose exec frontend cat /etc/nginx/conf.d/default.conf

# Перезапустить frontend
docker compose restart frontend
```

## Рекомендации по безопасности

1. ✅ Используйте сильные пароли (32+ символа)
2. ✅ Настройте firewall:
   ```bash
   ufw allow 22    # SSH
   ufw allow 80    # HTTP
   ufw allow 443   # HTTPS
   ufw enable
   ```
3. ✅ Настройте автообновления:
   ```bash
   apt install -y unattended-upgrades
   dpkg-reconfigure -plow unattended-upgrades
   ```
4. ✅ Регулярные бэкапы БД
5. ✅ Мониторинг логов

## Полезные команды

```bash
# Перезапуск всех сервисов
docker compose restart

# Остановка
docker compose down

# Полная очистка (ОСТОРОЖНО: удалит данные!)
docker compose down -v

# Просмотр логов за последние 100 строк
docker compose logs --tail=100 backend

# Выполнение команды в контейнере
docker compose exec backend sh

# Проверка health check
docker inspect musicians-backend | grep -A 10 Health
```

## Контакты и поддержка

При возникновении проблем:
1. Проверьте логи: `docker compose logs`
2. Проверьте статус: `docker compose ps`
3. Проверьте health: `curl http://localhost/health`

---

**Сервер:** 89.223.64.110  
**Проект:** /opt/musicians  
**Документация:** [SERVER_50_USERS.md](./SERVER_50_USERS.md), [VIDEO_HOSTING_AND_SERVER.md](./VIDEO_HOSTING_AND_SERVER.md)
