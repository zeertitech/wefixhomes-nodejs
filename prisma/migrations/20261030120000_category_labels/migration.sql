-- Category-owned labels and service assignments.
-- Does not alter existing categories, services, enquiries, users, roles, or audit logs.

CREATE TABLE "category_labels" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_labels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_labels" (
    "service_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_labels_pkey" PRIMARY KEY ("service_id", "label_id")
);

CREATE UNIQUE INDEX "category_labels_category_id_slug_key" ON "category_labels"("category_id", "slug");
CREATE UNIQUE INDEX "category_labels_category_id_name_lower_key" ON "category_labels"("category_id", lower("name"));
CREATE INDEX "category_labels_category_id_is_active_sort_order_idx" ON "category_labels"("category_id", "is_active", "sort_order");
CREATE INDEX "service_labels_label_id_idx" ON "service_labels"("label_id");

ALTER TABLE "category_labels"
  ADD CONSTRAINT "category_labels_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "service_categories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_labels"
  ADD CONSTRAINT "service_labels_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_labels"
  ADD CONSTRAINT "service_labels_label_id_fkey"
  FOREIGN KEY ("label_id") REFERENCES "category_labels"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "category_labels"
  ADD CONSTRAINT "category_labels_sort_order_check" CHECK ("sort_order" >= 0);
