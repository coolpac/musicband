-- AlterTable
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "winning_song_id" TEXT,
ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);
