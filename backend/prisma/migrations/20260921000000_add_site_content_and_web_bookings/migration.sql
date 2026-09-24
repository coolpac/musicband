-- Публичный сайт «ВГУЛ»: хранилище контента + заявки без Telegram-аккаунта + даты афиши.
--
-- Миграция написана вручную (локальной БД нет, `prisma migrate dev` здесь не запускается).
-- Она аддитивная и безопасна для живой таблицы:
--   * ALTER COLUMN ... DROP NOT NULL и ADD COLUMN ... DEFAULT в PostgreSQL 11+ не переписывают таблицу;
--   * все шаги идемпотентны (IF NOT EXISTS / DROP NOT NULL на уже nullable колонке — no-op),
--     поэтому повторный прогон на частично применённой БД не падает.
-- Внешний ключ bookings_user_id_fkey НЕ пересоздаётся: ON DELETE CASCADE сохраняется
-- (удаление Telegram-пользователя по-прежнему удаляет его заявки), меняется только NOT NULL.

-- AlterTable: bookings — заявки с сайта (userId = NULL) + поля формы сайта
ALTER TABLE "bookings" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'miniapp';
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "booking_time" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "comment" TEXT;

-- CreateIndex: фильтр «Заявки с сайта» в админке
CREATE INDEX IF NOT EXISTS "bookings_origin_booking_date_idx" ON "bookings"("origin", "booking_date" DESC);

-- AlterTable: posters — афиша сайта (дата события и площадка)
ALTER TABLE "posters" ADD COLUMN IF NOT EXISTS "event_date" DATE;
ALTER TABLE "posters" ADD COLUMN IF NOT EXISTS "venue" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "posters_event_date_idx" ON "posters"("event_date");

-- CreateTable: контент сайта, по строке на секцию
CREATE TABLE IF NOT EXISTS "site_content" (
    "section" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("section")
);
