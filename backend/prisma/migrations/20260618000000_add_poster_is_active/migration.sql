-- Add visibility flag to posters: hide/show without deleting.
-- Data-preserving: existing posters default to visible (true).
ALTER TABLE "posters" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "posters_is_active_idx" ON "posters"("is_active");
