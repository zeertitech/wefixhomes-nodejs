-- Marks a service category as featured (Most popular on the home page).
-- Painting stays featured so the current home highlight does not change.

ALTER TABLE "service_categories" ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;

UPDATE "service_categories"
SET "is_featured" = true
WHERE "slug" = 'painting' AND "deleted_at" IS NULL;
