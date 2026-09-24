-- Generalize identity from telegram_id to (platform, platform_id).
-- Data-preserving: existing rows keep their id (now platform_id) and default to platform = 'telegram'.

CREATE TYPE "Platform" AS ENUM ('telegram', 'max');

-- users
ALTER TABLE "users" ADD COLUMN "platform" "Platform" NOT NULL DEFAULT 'telegram';
ALTER TABLE "users" ADD COLUMN "photo_url" TEXT;
ALTER TABLE "users" RENAME COLUMN "telegram_id" TO "platform_id";
DROP INDEX IF EXISTS "users_telegram_id_key";
CREATE UNIQUE INDEX "users_platform_platform_id_key" ON "users"("platform", "platform_id");

-- onboarding_answers
ALTER TABLE "onboarding_answers" ADD COLUMN "platform" "Platform" NOT NULL DEFAULT 'telegram';
ALTER TABLE "onboarding_answers" RENAME COLUMN "telegram_id" TO "platform_id";
DROP INDEX IF EXISTS "onboarding_answers_telegram_id_key";
DROP INDEX IF EXISTS "onboarding_answers_telegram_id_idx";
CREATE UNIQUE INDEX "onboarding_answers_platform_platform_id_key" ON "onboarding_answers"("platform", "platform_id");
CREATE INDEX "onboarding_answers_platform_id_idx" ON "onboarding_answers"("platform_id");
