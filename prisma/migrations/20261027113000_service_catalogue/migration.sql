-- Home-service catalogue. Does not alter enquiries, users, roles, or commerce tables.

CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image_key" TEXT,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "short_description" TEXT,
    "description" TEXT,
    "mrp" DECIMAL(10,2) NOT NULL,
    "selling_price" DECIMAL(10,2) NOT NULL,
    "image_key" TEXT,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");
CREATE INDEX "service_categories_is_active_sort_order_idx" ON "service_categories"("is_active", "sort_order");
CREATE INDEX "service_categories_deleted_at_idx" ON "service_categories"("deleted_at");

CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");
CREATE INDEX "services_category_id_idx" ON "services"("category_id");
CREATE INDEX "services_is_active_sort_order_idx" ON "services"("is_active", "sort_order");
CREATE INDEX "services_deleted_at_idx" ON "services"("deleted_at");

ALTER TABLE "services"
  ADD CONSTRAINT "services_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "service_categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_categories"
  ADD CONSTRAINT "service_categories_sort_order_check" CHECK ("sort_order" >= 0);

ALTER TABLE "services"
  ADD CONSTRAINT "services_sort_order_check" CHECK ("sort_order" >= 0);

ALTER TABLE "services"
  ADD CONSTRAINT "services_price_check"
  CHECK ("mrp" >= 0 AND "selling_price" >= 0 AND "selling_price" <= "mrp");
