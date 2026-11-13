-- Our Works portfolio. Additive only: does not alter existing tables.

CREATE TYPE "WorkStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "WorkImageKind" AS ENUM ('GALLERY', 'BEFORE', 'AFTER');

CREATE TABLE "works" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "short_description" VARCHAR(300),
    "description" TEXT,
    "cover_image" TEXT,
    "location" VARCHAR(120),
    "property_type" VARCHAR(80),
    "completion_date" DATE,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "WorkStatus" NOT NULL DEFAULT 'DRAFT',
    "seo_title" VARCHAR(70),
    "seo_description" VARCHAR(160),
    "seo_keywords" VARCHAR(255),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "works_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_images" (
    "id" TEXT NOT NULL,
    "work_id" TEXT NOT NULL,
    "image_key" TEXT NOT NULL,
    "alt_text" VARCHAR(160),
    "kind" "WorkImageKind" NOT NULL DEFAULT 'GALLERY',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "works_slug_key" ON "works"("slug");
CREATE INDEX "works_category_id_status_idx" ON "works"("category_id", "status");
CREATE INDEX "works_status_is_featured_sort_order_idx" ON "works"("status", "is_featured", "sort_order");
CREATE INDEX "works_completion_date_idx" ON "works"("completion_date");
CREATE INDEX "work_images_work_id_kind_sort_order_idx" ON "work_images"("work_id", "kind", "sort_order");
CREATE INDEX "work_images_image_key_idx" ON "work_images"("image_key");

ALTER TABLE "works"
  ADD CONSTRAINT "works_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "service_categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "work_images"
  ADD CONSTRAINT "work_images_work_id_fkey"
  FOREIGN KEY ("work_id") REFERENCES "works"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "works" ADD CONSTRAINT "works_sort_order_check" CHECK ("sort_order" >= 0);
ALTER TABLE "work_images" ADD CONSTRAINT "work_images_sort_order_check" CHECK ("sort_order" >= 0);
