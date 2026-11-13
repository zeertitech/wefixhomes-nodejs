-- Search title, description, and keywords for a service page.

ALTER TABLE "services" ADD COLUMN "seo_title" VARCHAR(70);
ALTER TABLE "services" ADD COLUMN "seo_description" VARCHAR(160);
ALTER TABLE "services" ADD COLUMN "seo_keywords" VARCHAR(255);
