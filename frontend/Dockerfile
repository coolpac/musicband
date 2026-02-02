# ============================
# Stage 1: Build
# ============================
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time env переменные
ARG VITE_API_URL
ARG VITE_USE_MOCK=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_USE_MOCK=$VITE_USE_MOCK

RUN npm run build

# ============================
# Stage 2: Nginx Production
# ============================
FROM nginx:1.27-alpine AS production

# Удаляем дефолтный конфиг
RUN rm /etc/nginx/conf.d/default.conf

# Копируем наш конфиг
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

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
