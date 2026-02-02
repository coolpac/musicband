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

Получите сертификат (standalone займёт порт 80 на 1–2 минуты):

```bash
certbot certonly --standalone -d vgulcover.ru -d www.vgulcover.ru --non-interactive --agree-tos -m your@email.com
```

Замените `your@email.com` на свой email (нужен для уведомлений Let's Encrypt).

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
