# ============================
# Stage 1: Dependencies
# ============================
FROM node:20-alpine AS deps

# Native зависимости для sharp, bcrypt и Prisma (OpenSSL для linux-musl)
RUN apk add --no-cache python3 make g++ vips-dev openssl

WORKDIR /app

# Копируем только package files для кеширования
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Устанавливаем ВСЕ зависимости (нужны dev для build)
RUN npm ci

# Генерируем Prisma client
RUN npx prisma generate

# ============================
# Stage 2: Build
# ============================
FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY . .

# Регенерируем Prisma client под текущую схему (важно при изменении schema.prisma)
RUN npx prisma generate

# Компилируем TypeScript
RUN npm run build

# ============================
# Stage 3: Production
# ============================
FROM node:20-alpine AS production

# Runtime зависимости для sharp и Prisma (OpenSSL)
RUN apk add --no-cache vips-dev openssl

# Безопасность: не root пользователь
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Только production зависимости
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

# Копируем скомпилированный код
COPY --from=build /app/dist ./dist

# Создаём директории для runtime
RUN mkdir -p uploads/original uploads/webp uploads/avif uploads/thumb \
    uploads/video/original uploads/video/optimized uploads/video/thumb \
    logs \
    && chown -R appuser:appgroup /app

USER appuser

# Health check для Docker/K8s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

EXPOSE 3000

# Используем node напрямую (не npm) для получения SIGTERM
CMD ["node", "dist/app.js"]
