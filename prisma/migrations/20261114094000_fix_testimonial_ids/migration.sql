-- Shorten the seeded review ids so they match the admin id format (25 characters).

UPDATE "testimonials" SET "id" = 'cmseedreview0000000000002' WHERE "id" = 'cmseedreview00000000000002';
UPDATE "testimonials" SET "id" = 'cmseedreview0000000000003' WHERE "id" = 'cmseedreview00000000000003';
UPDATE "testimonials" SET "id" = 'cmseedreview0000000000004' WHERE "id" = 'cmseedreview00000000000004';
