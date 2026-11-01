-- Short public note for a service category. Existing rows stay null.

ALTER TABLE "service_categories" ADD COLUMN "note" TEXT;
