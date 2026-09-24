# ============================
# Stage 1: Build (shared)
# ============================
# Both final targets are produced from THIS stage, so the nginx image and the SSR image always
# carry the same asset hashes (`dist-ssr/entry-server.js` references `/assets/<name>-<hash>`
# files that only `dist/` contains — a mismatch would break every image on the site).
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time env переменные
ARG VITE_API_URL
ARG VITE_USE_MOCK=false
# Absolute origin of the Telegram/Max Mini App: the site's Telegram shim redirects launches there.
ARG VITE_MINI_APP_URL=https://vgul.cyberslon.ru
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_USE_MOCK=$VITE_USE_MOCK
ENV VITE_MINI_APP_URL=$VITE_MINI_APP_URL

# client build (dist/) + SSR build (dist-ssr/) + prerendered fallback snapshots (dist/site-static/)
RUN npm run build

# ============================
# Stage 2a: Public site SSR
# ============================
# Zero-dependency Node service: server/site-server.mjs renders dist-ssr/entry-server.js into the
# dist/site.html template. nginx proxies the site's routes here and falls back to
# dist/site-static/*.html when this container is down, so the landing page survives an outage.
FROM node:22-alpine AS site-ssr

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000

COPY --from=build /app/dist/site.html ./dist/site.html
COPY --from=build /app/dist-ssr ./dist-ssr
COPY --from=build /app/server ./server

# node:*-alpine ships an unprivileged `node` user (uid 1000); nothing here is written at runtime.
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/__health || exit 1

CMD ["node", "server/site-server.mjs"]

# ============================
# Stage 2b: Nginx Production
# ============================
# MUST STAY LAST. `docker compose build frontend`, `init.sh` and the docs all build this file
# WITHOUT --target, and docker then builds the final stage. If site-ssr were last, the frontend
# container would start the Node SSR server instead of nginx — an instant outage. The compose
# services also pin `target:` explicitly; this ordering is the second line of defence.
FROM nginx:1.27-alpine AS production

# Удаляем дефолтный конфиг
RUN rm /etc/nginx/conf.d/default.conf

# Копируем наш конфиг
ARG NGINX_CONF=nginx/nginx.conf
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf

# Public-site routing. `map` is only valid at http level, so it ships as its own conf.d drop-in
# (loaded before default.conf); the location blocks are `include`d from inside each server block.
COPY nginx/site-maps.conf /etc/nginx/conf.d/00-site-maps.conf
COPY nginx/site-locations.conf /etc/nginx/snippets/site-locations.conf
COPY nginx/common-locations.conf /etc/nginx/snippets/common-locations.conf

# Копируем собранный фронтенд
COPY --from=build /app/dist /usr/share/nginx/html

# Права доступа
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html

# Health check (127.0.0.1 — избегаем IPv6 при резолве localhost в Alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

EXPOSE 80 443

# Для SSL: каталог для ACME challenge (certbot renew --webroot)
RUN mkdir -p /var/www/acme

CMD ["nginx", "-g", "daemon off;"]
