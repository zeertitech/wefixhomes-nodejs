-- Customer reviews for the homepage. Additive only: does not alter existing tables.

CREATE TYPE "TestimonialStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "customer_name" VARCHAR(80) NOT NULL,
    "location" VARCHAR(120),
    "quote" VARCHAR(600) NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "avatar_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "TestimonialStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "testimonials_status_sort_order_idx" ON "testimonials"("status", "sort_order");

-- Keep the review that was previously hardcoded on the homepage.
INSERT INTO "testimonials" (
    "id",
    "customer_name",
    "location",
    "quote",
    "rating",
    "sort_order",
    "status",
    "published_at",
    "created_at",
    "updated_at"
) VALUES (
    'cmseedtestimonial00000001',
    'Arun Kumar',
    'Chennai',
    'Excellent service and very professional team. The painting work was completed on time with great quality. Highly recommended!',
    5,
    0,
    'PUBLISHED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
