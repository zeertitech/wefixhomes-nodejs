-- Search title, description, and keywords for a service category page.

ALTER TABLE "service_categories" ADD COLUMN "seo_title" VARCHAR(70);
ALTER TABLE "service_categories" ADD COLUMN "seo_description" VARCHAR(160);
ALTER TABLE "service_categories" ADD COLUMN "seo_keywords" VARCHAR(255);
