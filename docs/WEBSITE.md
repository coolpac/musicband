# Публичный сайт vgulcover.ru — эксплуатация

Операционное руководство по публичному сайту «ВГУЛ»: как он устроен, как разрабатывать,
собирать, выкатывать, проверять и откатывать. Дизайн и контракты — в
[`docs/plans/2026-09-21-website-design.md`](plans/2026-09-21-website-design.md).

---

## 1. Архитектура

```
                    Internet :443
                         │
              ┌──────────▼───────────┐
              │  host nginx (на ВМ)  │  TLS, certbot, www → apex 301
              │  /etc/nginx/sites-*  │  шаблон: infra/host-nginx/vgulcover.ru.conf.example
              └──────────┬───────────┘
                         │ proxy_pass 127.0.0.1:8084
        ┌────────────────▼──────────────────────────────────────────────┐
        │ контейнер frontend  (nginx:1.27-alpine)                       │
        │   конфиг: frontend/nginx/nginx-behind-proxy.conf              │
        │   + include frontend/nginx/site-locations.conf  ← вся маршрут-│
        │   + conf.d/00-site-maps.conf (map, http-уровень)    изация    │
        │                                                               │
        │  /  /booking* /privacy /terms /offer /robots.txt /sitemap.xml │
        │        └─► site:4000 ──5xx/недоступен──► /site-static/*.html  │
        │  /?screen= /?tgWebAppStartParam= /?startapp=  ─► index.html   │
        │  /app, /app/*                                 ─► index.html   │
        │  /site/*            иконки, манифест, og      ─► статика, 7d  │
        │  /assets/ /js/      хешированные бандлы       ─► статика, 1y  │
        │  /api/ /uploads/ /socket.io/                  ─► backend:3000 │
        │  всё остальное (в т.ч. /admin)                ─► index.html   │
        └───────────────┬──────────────────────┬────────────────────────┘
                        │                      │
        ┌───────────────▼────────┐   ┌─────────▼──────────────────────┐
        │ site (node:22-alpine)  │   │ backend (Node/Express)         │
        │ server/site-server.mjs │──►│ GET /api/public/site           │
        │ dist/site.html         │   │ PUT /api/admin/site/content/…  │
        │ dist-ssr/entry-server  │◄──│   → POST site:4000/__purge     │
        └────────────────────────┘   └────────────────────────────────┘
```

**Ключевые свойства.**

* `frontend` и `site` собираются из **одного** build-стейджа `frontend/Dockerfile`. `dist-ssr/`
  ссылается на хешированные файлы из `dist/`, поэтому их нельзя выкатывать порознь —
  `deploy.sh --frontend` всегда обновляет оба.
* ⚠️ В `frontend/Dockerfile` теперь **два** финальных стейджа. Оба сервиса задают `target:` явно
  (`production` для `frontend`, `site-ssr` для `site`), а стейдж `production` обязан оставаться
  **последним** в файле: `docker compose build frontend`, `init.sh` и часть документации собирают
  образ без `--target`, и тогда docker берёт последний стейдж. Если сюда добавляется новый стейдж —
  только выше `production`. CI проверяет оба инварианта (job `images`, шаг «Compose files parse»).
* `site` **не** зависит от здоровья backend. Если API лежит, SSR отдаёт контент-дефолты,
  вшитые в бандл (`src/site/content/sections/*.ts`), и ставит заголовок `X-Site-Data: fallback`.
* Если лежит сам `site`, nginx отдаёт **предрендеренные снапшоты** `dist/site-static/*.html`
  со статусом 200 (`X-Site-Data: snapshot`). Лендинг переживает падение обоих сервисов.
* `proxy_pass` на `site` идёт через переменную + docker-resolver, поэтому **nginx стартует,
  даже если контейнера `site` нет вообще**. Литеральный `proxy_pass http://site:4000` уронил бы
  конфиг и вместе с ним Mini App.

---

## 2. Два хоста: сайт на vgulcover.ru, Mini App на vgul.cyberslon.ru

С 2026-09-24 сайт и Mini App живут на разных хостах, но обслуживаются **одним** контейнером
`frontend` — nginx внутри него роутит по `Host` (`frontend/nginx/nginx-behind-proxy.conf`):

| Хост | Что отдаёт | Индексация |
|---|---|---|
| `vgulcover.ru` (default server) | сайт: `/`, `/booking*`, `/privacy`… → SSR-контейнер `site`, снапшот при сбое; всё остальное — 404 сайта | index |
| `vgul.cyberslon.ru` | Mini App и `/admin`: SPA-оболочка `dist/index.html`; `robots.txt` = `Disallow: /` | `X-Robots-Tag: noindex` на всё |

Общие для обоих хостов location (`/assets`, `/js`, `/api`, `/socket.io`, `/uploads`, `/health`) —
в `frontend/nginx/common-locations.conf`.

**Старые ссылки на Mini App** (кнопки ботов и реферальные ссылки, созданные до переезда,
закладки на `/admin`) продолжают работать за счёт редиректов на хосте сайта
(`frontend/nginx/site-locations.conf`):

* `/?screen=…`, `/?start=…`, `/?tgWebAppStartParam=…`, `/?startapp=…`, `/?sessionId=…` и т.п.
  (`map $args $mini_app_launch` в `site-maps.conf`) → **302** на `https://vgul.cyberslon.ru/?…`,
  query сохраняется;
* `/app`, `/app/*`, `/admin`, `/admin/*` → **301** на тот же путь на хосте Mini App.
* Запуск из Telegram/Max, у которого данные только в **hash** (`#tgWebAppData=…`, `#WebAppData=…`),
  сервер не видит — его ловит инлайн-шим в начале `frontend/site.html` и делает
  `location.replace(VITE_MINI_APP_URL + '/' + search + hash)`. Адрес подставляется при сборке
  (`VITE_MINI_APP_URL`, build-arg в `docker-compose.yml`); без него шим уводит на `/app/` того же хоста.

Хост Mini App задаётся в трёх местах, и они должны совпадать: `map "" $mini_app_origin`
(`site-maps.conf`), `MINI_APP_URL`/`ADMIN_PANEL_URL` в `.env` (кнопки ботов) и build-arg
`VITE_MINI_APP_URL` (по умолчанию берётся из `MINI_APP_URL`). `FRONTEND_URL` теперь —
CORS-список через запятую: `https://vgulcover.ru,https://vgul.cyberslon.ru`.

Хостовый nginx (вне docker) держит по одному vhost на домен, оба проксируют на
`127.0.0.1:8084` — шаблоны в `infra/host-nginx/`. Сертификат для `vgul.cyberslon.ru`
выпускается как у соседних поддоменов на этой машине: `certbot --nginx -d vgul.cyberslon.ru`.

После переезда в **BotFather** (Bot Settings → Menu Button / Web App URL) и в настройках
Max-бота адрес Mini App должен быть `https://vgul.cyberslon.ru` — это делается руками.

---

## 3. Локальная разработка

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

| URL | Что открывается |
|---|---|
| `/`, `/booking`, `/booking/form`, `/booking/success`, `/privacy`, `/terms`, `/offer` | сайт, **server-side rendered** тем же `entry-server.tsx`, что и в проде |
| `/robots.txt`, `/sitemap.xml` | генерируются на лету |
| `/app`, `/app/*` | Telegram Mini App |
| `/admin` | админка (внутри — переключатель «Приложение / Сайт») |
| `/?screen=…` | Mini App, как в проде |

Плагин `frontend/plugins/site-ssr-dev.ts` повторяет продовую маршрутизацию, поэтому расхождения
гидратации видны сразу, а не после деплоя. Бэкенд не обязателен: без него данные берутся из
дефолтов (ровно как продовый fallback). С бэкендом — `cd backend && npm run dev` (порт 3000,
`vite.config.ts` проксирует `/api`, `/uploads`, `/socket.io`).

---

## 4. Сборка

```bash
cd frontend && npm run build
```

Три шага одной командой:

1. `vite build` → `dist/` — два HTML-входа (`index.html` для Mini App, `site.html` для сайта),
   общий `vendor-react`, хешированные `assets/`, `js/`, плюс `public/` (включая `public/site/`).
2. `vite build --ssr src/site/entry-server.tsx --outDir dist-ssr` → `dist-ssr/entry-server.js`,
   самодостаточный бандл (React внутри) — контейнеру `site` не нужен `node_modules`.
3. `node scripts/prerender-site.mjs` → `dist/site-static/{index,booking,booking-form,booking-success,404}.html`,
   `robots.txt`, `sitemap.xml` — аварийные снапшоты для nginx.

Отдельно (**вручную, результат коммитится**):

```bash
node scripts/generate-site-icons.mjs   # public/site/*: favicon, иконки, манифест, og-default.jpg
npm run optimize:site                  # src/site/assets/opt/*: AVIF/WebP + manifest.ts
npm run typecheck                      # tsc --noEmit
```

`generate-site-icons.mjs` детерминирован: знак «В» вырезается из настоящего экспорта логотипа
(`src/site/assets/repertoire-collapsed/vgul-wordmark-large.svg`) по измеренному bounding box,
OG-картинка — кроп `src/site/assets/hero/hero-poster-bg.png` до 1200×630 с лёгким затемнением
снизу. Скрипт падает с внятной ошибкой, если экспорт логотипа изменил структуру.

---

## 5. Переменные окружения

Все — в `/opt/musicians/.env` на сервере, шаблон в `.env.example`.

| Переменная | Кто читает | Значение |
|---|---|---|
| `SITE_PURGE_TOKEN` | backend + site | Общий секрет для `POST /__purge`. Генерировать: `openssl rand -hex 32`. Пусто = хук без авторизации. |
| `SITE_SSR_URL` | backend | Куда слать purge. По умолчанию `http://site:4000`. |
| `SITE_API_ORIGIN` | site | Откуда брать контент. По умолчанию `http://backend:3000`. |
| `SITE_CACHE_TTL_MS` | site | Сколько мс данные API считаются свежими (по умолчанию 30000). Дальше — stale-while-revalidate. |
| `COMPOSE_FILE` / `DEPLOY_MODE` | deploy.sh | Обязательный явный выбор режима, см. ниже. |
| `FRONTEND_URL` | backend | **Один** origin без слэша. Из него выводятся `ADMIN_PANEL_URL` и `MINI_APP_URL` — список через запятую ломает кнопки ботов. |

> **`COMPOSE_FILE` — главный источник простоя.** `deploy.sh` вызывает `docker compose` без `-f`,
> поэтому режим задаётся только переменной. Без неё frontend пересобирается с TLS-конфигом,
> пытается занять `:80`/`:443` и конфликтует с host nginx. С этой выкатки `deploy.sh` отказывается
> работать, пока в `.env` нет либо
> `COMPOSE_FILE=docker-compose.yml:docker-compose.host-proxy.yml`, либо `DEPLOY_MODE=standalone`.
>
> `scripts/server-provision.sh` генерирует `.env` **без** этих переменных, поэтому на свежей машине
> первый `./deploy.sh` остановится с этим сообщением — допишите нужную строку в `.env` и повторите.

---

## 6. Деплой

**Порядок обязателен: сначала backend (миграция + API), затем frontend + site.** SSR-сервер
опрашивает `GET /api/public/site`; если выкатить сайт раньше эндпоинта, он несколько минут будет
работать на дефолтах — не фатально, но заявки с сайта уйдут в 404.

```bash
ssh -i ~/.ssh/id_ed25519_deploy root@<PROD_IP>
cd /opt/musicians
git status                 # дерево должно быть чистым, иначе git pull в deploy.sh упадёт
git pull origin main

./deploy.sh --backend      # бэкап БД + prisma migrate deploy + рестарт backend
./deploy.sh --frontend     # пересобирает и перезапускает frontend И site (общий build-стейдж)
```

Полный деплой (`./deploy.sh` без аргументов) делает то же самое одной командой:
`git pull` → бэкап БД → `docker compose build --pull` → backend (+миграции) → frontend + site →
`docker image prune -f`.

`--frontend` **не** делает бэкап БД и **не** применяет миграции — для чисто фронтовой выкатки это
правильно, но если в релизе есть изменения бэкенда, идите полным деплоем.

Окно недоступности: несколько секунд на подмену контейнеров (blue/green нет). Для `site` оно
невидимо — nginx в это время отдаёт снапшоты.

---

## 7. Проверка после деплоя

```bash
BASE=https://vgulcover.ru

# 1. Главная отдаётся SSR, а не снапшотом и не Mini App
curl -sI $BASE/ | grep -iE '^(HTTP|x-site-data|cache-control)'
#   HTTP/2 200 … X-Site-Data: api        ← «api» = данные из бэкенда
#   «fallback» = сайт жив, бэкенд не отвечает; «snapshot» = лежит контейнер site
curl -s $BASE/ | grep -c '<h1'                       # 1 — разметка пришла с сервера

# 2. Маршруты и статусы
for p in / /booking /booking/form /booking/success; do
  printf '%-20s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' $BASE$p)"      # 200
done
curl -s -o /dev/null -w '%{http_code}\n' $BASE/booking/                              # 301
curl -s -o /dev/null -w '%{http_code}\n' $BASE/definitely-not-a-page                 # 404
curl -s -o /dev/null -w '%{http_code}\n' $BASE/privacy                               # 404 пока
                                                                                     # текст не заполнен в админке

# 3. SEO-файлы
curl -s $BASE/robots.txt | head -5                    # Sitemap: https://vgulcover.ru/sitemap.xml
curl -s $BASE/sitemap.xml | head -3                   # <urlset …>
curl -sI $BASE/site/og-default.jpg | grep -i '^content-type'   # image/jpeg
curl -sI $BASE/site/manifest.webmanifest | grep -i '^content-type'  # application/manifest+json

# 4. Снапшоты и SSR-шаблон недостижимы напрямую (иначе это дубли главной в индексе)
curl -s -o /dev/null -w '%{http_code}\n' $BASE/site-static/index.html                # 404
curl -s -o /dev/null -w '%{http_code}\n' $BASE/site.html                             # 404

# 5. Старые ссылки Mini App уводят на новый хост, а сам сайт — нет
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$BASE/?screen=home"   # 302 https://vgul.cyberslon.ru/?screen=home
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$BASE/admin"          # 301 https://vgul.cyberslon.ru/admin
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$BASE/app/"           # 301 https://vgul.cyberslon.ru/app/
curl -s $BASE/ | grep -c 'telegram-web-app.js'                                       # 0

# 5a. КРИТИЧНО: на страницах сайта не должно быть X-Robots-Tag
curl -sI $BASE/ | grep -i x-robots-tag                                               # пусто!
curl -s $BASE/ | grep -o '<meta name="robots"[^>]*>'   # index, follow, max-image-preview:large

# 6. Mini App и админка на своём хосте
APP=https://vgul.cyberslon.ru
curl -s $APP/ | grep -c 'telegram-web-app.js'                                        # 1
curl -s -o /dev/null -w '%{http_code}\n' $APP/admin                                  # 200
curl -sI $APP/ | grep -i x-robots-tag                                                # noindex, nofollow
curl -s $APP/robots.txt                                                              # Disallow: /
curl -sI $APP/ | grep -i content-security-policy                                     # frame-ancestors … telegram … max
curl -s $APP/api/formats | head -c 80                                                # {"success":true,…

# 7. Контейнеры
docker compose ps                     # frontend, site, backend, postgres, redis — healthy
docker compose logs --tail=50 site
```

Реальный запуск из Telegram проверяется только руками: открыть бота, нажать кнопку Mini App
(после смены URL в BotFather), затем отсканировать один из напечатанных QR-кодов (они ведут через
`t.me/…?startapp=` и не зависят от домена). В обоих случаях должно открыться приложение, а не лендинг.

---

## 8. Откат

```bash
./deploy.sh --rollback     # git checkout <предыдущий commit> + пересборка backend/frontend/site
```

Помните: после `--rollback` репозиторий на сервере в **detached HEAD**, и следующий
`git pull origin <ветка>` упадёт. Вернитесь на ветку явно:

```bash
git checkout main && git pull origin main && ./deploy.sh
```

Образы старых версий не хранятся (`docker image prune -f` в конце полного деплоя), откат — это
всегда пересборка из исходников.

Быстрые частичные откаты:

* **Сайт отдаёт мусорный контент** — не нужен деплой: откатите раздел в админке («Сайт → Контент»),
  бэкенд сам дёрнет `/__purge`. Либо вручную:
  `docker compose exec backend wget -qO- --post-data= --header="Authorization: Bearer $SITE_PURGE_TOKEN" http://site:4000/__purge`
* **Сломался SSR** — `docker compose stop site`. nginx немедленно начнёт отдавать снапшоты
  (`X-Site-Data: snapshot`), сайт останется доступным, только без свежего контента из админки.

---

## 9. Индексация: Яндекс.Вебмастер, Search Console, Метрика

Коды подтверждения и счётчики **не хардкодятся** — они вводятся в админке
(«Сайт → SEO») и попадают в `<head>` через `src/site/seo/head.ts`.

1. **Яндекс.Вебмастер** → «Добавить сайт» → `https://vgulcover.ru` → способ «Мета-тег» →
   скопировать значение `content` → админка «Сайт → SEO → Код подтверждения Яндекс.Вебмастера» →
   сохранить → дождаться `/__purge` (или подождать `SITE_CACHE_TTL_MS`) → нажать «Проверить».
   Дальше: «Индексирование → Файлы Sitemap» → добавить `https://vgulcover.ru/sitemap.xml`;
   «Переезд сайта» не трогать; в «Региональность» указать город(а) выступлений.
2. **Google Search Console** → «Добавить ресурс» → «Ресурс с префиксом URL» →
   `https://vgulcover.ru` → «HTML-тег» → значение `content` в «Код подтверждения Google Search
   Console» → сохранить → «Подтвердить». Затем «Файлы Sitemap» → `sitemap.xml`.
3. **Яндекс.Метрика** → создать счётчик на `vgulcover.ru` → номер счётчика (только цифры) в
   «ID счётчика Яндекс.Метрики». Счётчик загружается лениво и сам не считает переходы внутри SPA —
   их отправляет `trackPageView`. Цели создавайте с идентификаторами `booking_started` и
   `booking_submitted` (их шлёт форма бронирования).
4. **Google Analytics 4** — поле «ID Google Analytics 4», формат `G-XXXXXXXXXX`.
5. Пустое поле = скрипт **не грузится вообще**. Это и есть выключатель.
6. Тумблер «Закрыть сайт от индексации» ставит `noindex` на все страницы и превращает
   `robots.txt` в `Disallow: /`. Включайте только на время наполнения и **не забудьте выключить**.

`www.vgulcover.ru` должен 301-редиректить на апекс — блок для host nginx лежит в
`infra/host-nginx/vgulcover.ru.conf.example`, **на сервере его нужно добавить руками**
(`nginx -t && systemctl reload nginx`). Сертификат уже покрывает оба имени.

Mini App и админка закрыты от индексации двумя способами: `<meta name="robots" content="noindex,
nofollow">` в `frontend/index.html` и заголовок `X-Robots-Tag` на `/app`, `/app/*` и на
Mini-App-ответ по «/». Сайт этих заголовков не получает никогда.

---

## 10. Регенерация картинок и иконок

```bash
cd frontend
npm run optimize:site                   # src/site/assets/<slug>/*.png|jpg → assets/opt/*.avif|webp
                                        # + перезаписывает assets/opt/manifest.ts
node scripts/generate-site-icons.mjs    # public/site/*
```

Оба скрипта детерминированы, результат **коммитится** — в Docker-образе они не запускаются.
`public/site/` намеренно не в `.gitignore`.

Иконки завязаны на два исходника; при их замене перегенерируйте и посмотрите глазами:

| Выход | Источник |
|---|---|
| `favicon.ico`, `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `icon-maskable-512.png` | первый `<path>` из `src/site/assets/repertoire-collapsed/vgul-wordmark-large.svg` (буква «В») на красной плашке `#ff3135` |
| `og-default.jpg` | `src/site/assets/hero/hero-poster-bg.png`, кроп 1200×630 |

`og-default.jpg` обязан оставаться **JPEG ≤ 200 КБ**: скрейперы соцсетей не читают AVIF/WebP,
а Telegram обрезает большие файлы. Скрипт сам подбирает качество.

---

## 11. Merge surface — `feature/max-integration`

Ветка на ~49 коммитов впереди и правит те же файлы. Конфликты будут точечными, если не
расширять диффы:

| Файл | Что делает Max | Как разрешать |
|---|---|---|
| `frontend/index.html` | telegram SDK → `async`, добавляет `max-web-app.js`, меняет инлайн-скрипт | Сайт добавил только `<meta name="robots">` (плюс комментарий) сразу после `<meta charset>`. Берите обе стороны. |
| `frontend/nginx/*.conf` | меняет `add_header X-Frame-Options` на CSP `frame-ancestors …` | Сайт добавил **одну** строку `include …/site-locations.conf;` перед `location /`. Берите обе. |
| `infra/host-nginx/*.example` | та же замена XFO → CSP | Берите CSP от Max, блок `www → apex` от сайта. |
| `docker-compose.yml` | добавляет `MAX_*` в `environment` backend | Берите обе стороны; сервис `site` аддитивный. **Не потеряйте `target: production` у `frontend`** — без него соберётся SSR-образ вместо nginx. |
| `frontend/src/main.tsx` | `platform/platform`, временный debug-beacon `/api/debug/clientinfo` | Сайт этот файл **не трогал**. Убедитесь, что beacon не уедет в прод — он бьёт на каждой загрузке. |
| `frontend/package.json` | `"test": "vitest run"`, devDeps | Аддитивно. |

**Отдельно про framing-заголовки.** `add_header` не наследуется, если уровень объявил свой,
поэтому `X-Frame-Options` из `server {}` контейнера сегодня молча теряется, и реально работает
только заголовок host nginx. В `site-locations.conf` XFO продублирован **только для страниц
сайта** (его никто не встраивает) и намеренно **не** выставлен на `/app`, `/app/*` и на
Mini-App-ответ по «/»: политика встраивания Mini App должна оставаться в одном месте, иначе
CSP `frame-ancestors` от Max и XFO от host nginx столкнутся и сломают Telegram Web.
При мердже Max проверьте `curl -sI https://vgulcover.ru/app/ | grep -iE 'frame|content-security'` —
должен быть ровно один источник правды.

---

## 12. Где что лежит

| Путь | Что |
|---|---|
| `frontend/site.html` | HTML-шаблон сайта, маркеры `<!--site-head-->`, `<!--site-html-->`, `/*site-data*/ undefined` |
| `frontend/src/site/**` | React-приложение сайта (SSR + гидратация) |
| `frontend/server/site-server.mjs` | продовый SSR-сервер, без зависимостей |
| `frontend/scripts/prerender-site.mjs` | шаг сборки: аварийные снапшоты |
| `frontend/scripts/generate-site-icons.mjs` | иконки, манифест, OG |
| `frontend/nginx/site-locations.conf` | вся маршрутизация сайта (server-уровень, один include) |
| `frontend/nginx/site-maps.conf` | `map`-директивы (http-уровень, `conf.d/00-site-maps.conf`) |
| `frontend/public/site/**` | favicon, иконки, `manifest.webmanifest`, `og-default.jpg` |
| `infra/host-nginx/*.example` | шаблон vhost хоста (живой файл правится руками) |
| `.github/workflows/ci.yml` | typecheck, сборка, `nginx -t` в собранном образе, smoke-тест SSR |
