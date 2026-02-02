-- AlterTable
ALTER TABLE "formats" ADD COLUMN "short_description" TEXT,
ADD COLUMN "image_url" TEXT,
ADD COLUMN "suitable_for" JSONB,
ADD COLUMN "performers" JSONB,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'available',
ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
