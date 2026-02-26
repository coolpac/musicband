-- AlterTable
ALTER TABLE "voting_follow_ups" ADD COLUMN IF NOT EXISTS "campaign_day" INTEGER NOT NULL DEFAULT 1;
