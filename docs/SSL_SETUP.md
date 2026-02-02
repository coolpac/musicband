# SSL для vgulcover.ru (Let's Encrypt)

Пошаговая настройка HTTPS для vgulcover.ru через Let's Encrypt (Certbot).

## Предусловия

- Домен **vgulcover.ru** указывает на IP сервера (A-запись).
- На сервере открыты порты **80** и **443** (UFW уже настроен в provision).
- Backend и frontend уже работают по HTTP.

---

## Шаг 1: Получить сертификат на сервере

Подключитесь к серверу и выполните:

```bash
ssh root@89.223.64.110
cd /opt/musicians
```

Временно освободите порт 80 (остановите frontend):

```bash
docker compose stop frontend
```

Установите Certbot (если ещё не установлен):

```bash
apt update && apt install -y certbot
```

Получите сертификат (standalone займёт порт 80 на 1–2 минуты).

**Вариант 1 — только основной домен** (если для www.vgulcover.ru приходит 502 или другой IP):

```bash
certbot certonly --standalone -d vgulcover.ru --non-interactive --agree-tos -m your@email.com
```

**Вариант 2 — домен и www** (если и vgulcover.ru, и www.vgulcover.ru указывают на этот сервер):

```bash
certbot certonly --standalone -d vgulcover.ru -d www.vgulcover.ru --non-interactive --agree-tos -m your@email.com
```

Замените `your@email.com` на свой email. Если Certbot ругается на www (502 / другой IP), используйте вариант 1.

Запустите frontend снова:

```bash
docker compose start frontend
```

Сертификаты появятся в каталоге:
`/etc/letsencrypt/live/vgulcover.ru/` (fullchain.pem, privkey.pem).

---

## Шаг 2: Включить SSL в проекте

На сервере в `/opt/musicians`:

**2.1. Подключить порт 443 и каталог с сертификатами**

В `docker-compose.yml` у сервиса **frontend** должно быть:

```yaml
frontend:
  # ... остальное без изменений ...
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
```

Если секции `volumes` у frontend ещё нет — добавьте только эти две строки (ports и volumes).

**2.2. Использовать Nginx-конфиг с SSL**

Замените конфиг Nginx в образе на вариант с HTTPS:

```bash
cd /opt/musicians
cp frontend/nginx/nginx.conf frontend/nginx/nginx.conf.bak
cp frontend/nginx/nginx-ssl.conf frontend/nginx/nginx.conf
```

**2.3. Проброс 443 в контейнер**

В `frontend/Dockerfile` Nginx слушает только 80. Нужно, чтобы он слушал и 443. В `nginx-ssl.conf` уже есть `listen 443 ssl http2;`, поэтому достаточно пробросить порт в `docker-compose.yml` (шаг 2.1). Проверьте, что в образе копируется именно тот конфиг, который вы подменили (обычно `COPY nginx/nginx.conf`).

**2.4. Пересобрать и перезапустить frontend**

```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

**2.5. Проверить**

```bash
docker compose ps
curl -sI https://vgulcover.ru | head -5
```

Должен быть ответ с `HTTP/2 200` и без ошибок SSL.

---

## Шаг 3: FRONTEND_URL в .env

В `/opt/musicians/.env` укажите HTTPS:

```bash
FRONTEND_URL=https://vgulcover.ru
```

Перезапустите backend, чтобы подхватить переменную:

```bash
docker compose up -d backend
```

---

## Если Certbot выдал 502 для www.vgulcover.ru

Значит, **www** указывает на другой IP (прокси/CDN) или порт 80 там занят. Сделайте так:

1. Взять сертификат **только для vgulcover.ru** (без www):
   ```bash
   docker compose stop frontend
   certbot certonly --standalone -d vgulcover.ru --non-interactive --agree-tos -m your@email.com
   docker compose start frontend
   ```
2. В `frontend/nginx/nginx-ssl.conf` в блоках `server_name` оставить только `vgulcover.ru` (убрать `www.vgulcover.ru`) или позже настроить DNS для www на этот сервер и перевыпустить сертификат с `-d www.vgulcover.ru`.

## Если после включения SSL сайт не открывается

Вы включили SSL-конфиг до получения сертификата: Nginx редиректит HTTP → HTTPS, а сертификата нет. Верните обычный конфиг и снова включите SSL после получения сертификата:

```bash
cd /opt/musicians
cp frontend/nginx/nginx.conf.bak frontend/nginx/nginx.conf
docker compose build --no-cache frontend
docker compose up -d frontend
```

После этого http://vgulcover.ru снова будет открываться. Получите сертификат (см. выше), добавьте в docker-compose порт 443 и volume `/etc/letsencrypt`, снова подмените конфиг на `nginx-ssl.conf`, пересоберите frontend.

## Шаг 4: Автообновление сертификата

Сертификаты Let's Encrypt действуют 90 дней. Настройте обновление по cron:

```bash
crontab -e
```

Добавьте строку (обновление раз в месяц, в 3:00):

```
0 3 1 * * certbot renew --quiet --deploy-hook "cd /opt/musicians && docker compose exec -T frontend nginx -s reload"
```

Либо без перезагрузки Nginx (контейнер подмонтирует обновлённые файлы с хоста):

```
0 3 1 * * certbot renew --quiet && docker compose -f /opt/musicians/docker-compose.yml exec -T frontend nginx -s reload
```

---

## Проверка сайта http://vgulcover.ru/

После настройки SSL проверьте:

| Проверка | Команда / действие |
|----------|---------------------|
| Сайт открывается по HTTPS | https://vgulcover.ru |
| Редирект HTTP → HTTPS | http://vgulcover.ru → https://vgulcover.ru |
| API отвечает | https://vgulcover.ru/api/formats |
| Админка | https://vgulcover.ru/admin |
| Сертификат валиден | В браузере: замок рядом с адресом, сертификат от Let's Encrypt |

Локально с сервера:

```bash
curl -sI https://vgulcover.ru
curl -s https://vgulcover.ru/api/formats | head -c 200
```

---

## Если что-то пошло не так

- **Nginx не стартует** — проверьте пути к сертификатам:  
  `ls -la /etc/letsencrypt/live/vgulcover.ru/`  
  В контейнер они попадают через volume `/etc/letsencrypt:/etc/letsencrypt:ro`.

- **Ошибка сертификата в браузере** — убедитесь, что в браузере открываете именно https://vgulcover.ru и что в `FRONTEND_URL` указан `https://vgulcover.ru`.

- **Редирект не работает** — убедитесь, что в работе конфиг с редиректом (скопирован `nginx-ssl.conf` в `nginx.conf`) и контейнер пересобран.

- **Certbot: "Address already in use"** — перед `certbot certonly --standalone` обязательно выполните `docker compose stop frontend`.
