-- CreateTable
CREATE TABLE "onboarding_answers" (
    "id" TEXT NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_answers_telegram_id_key" ON "onboarding_answers"("telegram_id");

-- CreateIndex
CREATE INDEX "onboarding_answers_telegram_id_idx" ON "onboarding_answers"("telegram_id");
