-- CreateTable
CREATE TABLE "voting_follow_ups" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "telegram_ids" JSONB NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voting_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voting_follow_ups_scheduled_at_sent_at_idx" ON "voting_follow_ups"("scheduled_at", "sent_at");
