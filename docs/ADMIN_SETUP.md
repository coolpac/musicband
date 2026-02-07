# Настройка администраторов

## Как работает авторизация в админке

Для входа в админку (`/admin`) нужно:

1. **Telegram ID** — ваш уникальный ID в Telegram
2. **Пароль** — общий пароль для всех админов (хеш хранится в `.env`)

Пользователь должен быть в базе данных с ролью `admin`.

---

## Шаг 1: Узнать свой Telegram ID

Напишите боту [@userinfobot](https://t.me/userinfobot) — он покажет ваш ID.

**Пример:** `123456789`

---

## Шаг 2: Создать пользователя в базе

Пользователь создаётся автоматически при первом входе в мини-приложение через Telegram.

**Если хотите создать вручную:**

```bash
cd /opt/musicians
docker compose exec backend npx prisma studio
```

Откроется веб-интерфейс Prisma Studio. Создайте запись в таблице `User`:

| Поле | Значение |
|------|----------|
| telegramId | `123456789` (ваш ID) |
| role | `admin` |
| username | `your_username` (опционально) |
| firstName | `Имя` (опционально) |

---

## Шаг 3: Установить роль admin

Если пользователь уже есть в базе, измените его роль:

**Через Prisma Studio:**

```bash
docker compose exec backend npx prisma studio
```

Найдите пользователя по `telegramId` и измените `role` на `admin`.

**Через SQL:**

```bash
docker compose exec postgres psql -U musicians musicians_db
```

```sql
-- Посмотреть всех пользователей
SELECT id, telegram_id, username, role FROM users;

-- Сделать пользователя админом (в БД колонка telegram_id, не telegramId)
UPDATE users SET role = 'admin' WHERE telegram_id = 123456789;

-- Проверить
SELECT * FROM users WHERE role = 'admin';
```

---

## Шаг 4: Создать хеш пароля

Пароль хранится в `.env` в виде bcrypt-хеша.

**Генерация хеша (на сервере):**

```bash
# Запустить Node.js внутри контейнера
docker compose exec backend node

# В консоли Node.js:
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('ваш_секретный_пароль', 10);
console.log(hash);
# Скопируйте результат, например: $2a$10$...
# Выход: .exit
```

**Или одной командой:**

```bash
docker compose exec backend node -e "console.log(require('bcryptjs').hashSync('ваш_секретный_пароль', 10))"
```

---

## Шаг 5: Добавить хеш в .env

Откройте `.env` на сервере:

```bash
nano /opt/musicians/.env
```

Добавьте строку:

```env
ADMIN_PASSWORD_HASH=$2a$10$ваш_хеш_из_предыдущего_шага
```

**Важно:** Если хеш содержит `$`, экранировать НЕ нужно — просто вставьте как есть.

---

## Шаг 6: Перезапустить бэкенд

```bash
cd /opt/musicians
docker compose restart backend
```

---

## Шаг 7: Войти в админку

1. Откройте `https://vgulcover.ru/admin`
2. Введите ваш Telegram ID
3. Введите пароль
4. Нажмите «Войти»

---

## Добавление других админов

Повторите шаги 1-3 для каждого нового админа:

1. Узнать его Telegram ID
2. Он должен зайти в мини-приложение (чтобы создался в базе)
3. Изменить его роль на `admin`

Пароль у всех админов **одинаковый** (из `ADMIN_PASSWORD_HASH`).

---

## Админ до первого запуска бота

Если человек **ещё ни разу не открывал** мини-приложение, его нет в базе. Можно заранее создать запись с ролью `admin` — когда он потом запустит бота, пользователь уже будет найден по `telegram_id`, роль не перезапишется.

**Создать пользователя-админа вручную (одной командой):**

```bash
docker compose exec postgres psql -U musicians musicians_db -c "
INSERT INTO users (id, telegram_id, role, created_at, updated_at)
VALUES (gen_random_uuid()::text, 123456789, 'admin', NOW(), NOW());
"
```

Подставьте нужный Telegram ID вместо `123456789`.

**Или через интерактивный psql:**

```bash
docker compose exec postgres psql -U musicians musicians_db
```

```sql
INSERT INTO users (id, telegram_id, role, created_at, updated_at)
VALUES (gen_random_uuid()::text, 123456789, 'admin', NOW(), NOW());
```

После этого новый админ может:
1. Зайти на `https://ваш-домен.ru/admin`
2. Ввести свой Telegram ID и общий пароль (из `ADMIN_PASSWORD_HASH`)

Когда он позже откроет мини-приложение через Telegram, запись в базе уже будет — обновятся только username/first_name/last_name, роль `admin` сохранится.

---

## Быстрый чек-лист

```bash
cd /opt/musicians

# 1. Проверить, есть ли пользователь в базе
docker compose exec postgres psql -U musicians musicians_db -c "SELECT * FROM users WHERE telegram_id = 123456789;"

# 2. Сделать админом (в БД колонка telegram_id)
docker compose exec postgres psql -U musicians musicians_db -c "UPDATE users SET role = 'admin' WHERE telegram_id = 123456789;"

# 3. Сгенерировать хеш пароля
docker compose exec backend node -e "console.log(require('bcryptjs').hashSync('my_secret_password', 10))"

# 4. Добавить ADMIN_PASSWORD_HASH в .env
echo 'ADMIN_PASSWORD_HASH=$2a$10$...' >> .env

# 5. Перезапустить
docker compose restart backend

# 6. Проверить логи
docker compose logs backend --tail=20
```

---

## Решение проблем

### «Неверный Telegram ID или пароль»

1. Проверьте, есть ли пользователь в базе с этим `telegramId`
2. Проверьте, что его роль = `admin`
3. Проверьте, что `ADMIN_PASSWORD_HASH` установлен в `.env`
4. Проверьте, что бэкенд перезапущен после изменения `.env`

### «ADMIN_PASSWORD_HASH is not set»

Добавьте `ADMIN_PASSWORD_HASH` в `.env` и перезапустите бэкенд.

### Пользователя нет в базе

Он должен сначала зайти в мини-приложение через Telegram — тогда создастся автоматически.

Или создайте вручную через Prisma Studio / SQL.

---

## Безопасность

- Используйте сложный пароль (минимум 12 символов)
- Не храните пароль в открытом виде
- Периодически меняйте пароль
- Ограничьте число админов до минимума
