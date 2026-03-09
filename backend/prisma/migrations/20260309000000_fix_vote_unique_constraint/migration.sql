-- DropIndex: старый constraint (userId, songId, sessionId) позволял 2 голоса за разные песни
DROP INDEX IF EXISTS "votes_user_id_song_id_session_id_key";

-- CreateIndex: один голос на пользователя в сессии
CREATE UNIQUE INDEX "votes_user_id_session_id_key" ON "votes"("user_id", "session_id");

-- AlterTable: добавляем поле для хранения финальных результатов (JSON снимок)
ALTER TABLE "voting_sessions" ADD COLUMN "final_results" JSONB;
