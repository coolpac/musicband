# Быстрые команды для сервера

## Проверка статуса

```bash
cd /opt/musicians
docker compose ps
```

## Просмотр логов

Имя контейнера бэкенда — **musicians-backend** (не `backend`). Через compose можно вызывать по имени сервиса:

```bash
# Все сервисы
docker compose logs --tail=100 -f

# Только бэкенд (по имени сервиса из docker-compose)
docker compose logs backend --tail=100 -f

# То же по имени контейнера
docker logs musicians-backend --tail 100 -f
```

**Проверка бота и отзывов** (после «Выполнено» в админке, если отзыв не пришёл):

```bash
# Все последние логи бэкенда
docker logs musicians-backend --tail 200

# Только про отзыв / UserBot / ошибки
docker logs musicians-backend --tail 500 2>&1 | grep -i -E "review|UserBot|Booking completed|WARN|ERROR"
```

## Перезапуск сервисов

```bash
# Все
docker compose restart

# Только бэкенд
docker compose restart backend

# Только фронтенд
docker compose restart frontend
```

## Работа с базой данных

```bash
# Применить миграции
docker compose exec backend npm run migrate

# Заполнить базу тестовыми данными
docker compose exec backend npm run seed

# Открыть Prisma Studio (админка БД)
docker compose exec backend npx prisma studio
```

## Проверка API

```bash
# Форматы
curl http://localhost/api/formats

# Партнёры
curl http://localhost/api/partners

# Health-check
curl http://localhost/health
```

## Деплой обновлений

```bash
cd /opt/musicians
git pull
docker compose build --no-cache
docker compose up -d
```

## Очистка и пересборка

```bash
# Остановить всё
docker compose down

# Удалить неиспользуемые образы
docker image prune -a

# Пересоздать и запустить
docker compose up -d --build
```

## SSL и сертификаты

```bash
# Проверить срок действия сертификата
sudo certbot certificates

# Продлить сертификат вручную
sudo systemctl stop docker  # или docker compose stop frontend
sudo certbot renew
sudo systemctl start docker
docker compose up -d
```

## Полный сброс базы (осторожно!)

```bash
cd /opt/musicians
docker compose down
docker volume rm musicians_postgres_data
docker compose up -d postgres
sleep 10
docker compose exec backend npm run migrate
docker compose exec backend npm run seed
docker compose up -d
```

**Внимание:** удаляет все данные!

## Мониторинг ресурсов

```bash
# Использование CPU/RAM
docker stats

# Размер томов
docker system df -v

# Список томов
docker volume ls
```

## Бэкап базы данных

```bash
# Создать дамп
docker compose exec -T postgres pg_dump -U musicians musicians_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить из дампа
docker compose exec -T postgres psql -U musicians musicians_db < backup_20260202_120000.sql
```

## Быстрые проверки после деплоя

```bash
# 1. Статус
docker compose ps

# 2. Логи бэкенда
docker compose logs backend --tail=20

# 3. API отвечает?
curl http://localhost/api/formats

# 4. Форматы в базе?
docker compose exec backend npm run seed

# 5. Всё ОК!
```
