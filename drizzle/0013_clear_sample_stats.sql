-- Remove the made-up sample analytics the seed wrote for the 'main' site.
-- The seed creates the publication and backfills 14 days of fake numbers
-- ending on that day, so everything up to and including the day the
-- publication was created is sample data. Real counts after that are kept.
DELETE FROM "content_daily_stats" s
USING "publications" p
WHERE p."id" = s."publication_id" AND p."slug" = 'main'
  AND s."day" <= (p."created_at" AT TIME ZONE 'UTC')::date;
--> statement-breakpoint
DELETE FROM "traffic_daily_stats" s
USING "publications" p
WHERE p."id" = s."publication_id" AND p."slug" = 'main'
  AND s."day" <= (p."created_at" AT TIME ZONE 'UTC')::date;
