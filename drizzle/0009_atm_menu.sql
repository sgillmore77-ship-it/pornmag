-- ATM menu for the "main" publication (Ass to Mouth), 14 Nov 2026.
-- Renames Brunette/Blonde/Black/Double Anal to their ATM versions (keeping the
-- stories in them), adds Triple Anal, Redhead and Asian ATM, removes the empty
-- ATM Compilations, redirects old category addresses and sets the menu.
-- Every step is guarded, so it's safe to re-run and does nothing without "main".

-- 1. Rename (only when the new address isn't already taken).
UPDATE "categories" c SET "slug" = r.new_slug, "updated_at" = now()
FROM "publications" p, (VALUES ('brunette', 'brunette-atm'), ('blonde', 'blonde-atm'), ('black', 'ebony-atm'), ('double-anal', 'double-anal-atm')) AS r(old_slug, new_slug)
WHERE p."slug" = 'main' AND c."publication_id" = p."id" AND c."slug" = r.old_slug
  AND NOT EXISTS (SELECT 1 FROM "categories" x WHERE x."publication_id" = p."id" AND x."slug" = r.new_slug);
--> statement-breakpoint

-- 2. Create any that don't exist yet.
INSERT INTO "categories" ("id", "publication_id", "name", "slug", "intro", "seo_title", "meta_description", "position", "indexable")
SELECT gen_random_uuid()::text, p."id", v.name, v.slug, v.intro, v.seo, v.meta, v.pos, true
FROM "publications" p
CROSS JOIN (VALUES
  ('Double Anal ATM', 'double-anal-atm', 'Two at once, then straight ass to mouth. The best double anal ATM porn videos, hand-picked and updated daily.', 'Double Anal ATM Porn – DAP Ass to Mouth Videos', 'Watch the best double anal ATM porn: DAP scenes that finish ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 1),
  ('Triple Anal ATM', 'triple-anal-atm', 'The most extreme ass to mouth there is: triple anal scenes, hand-picked and updated daily.', 'Triple Anal ATM Porn – Extreme Ass to Mouth Videos', 'Triple anal ATM porn at its most extreme: TAP scenes that go ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 2),
  ('Brunette ATM', 'brunette-atm', 'Brunettes going ass to mouth. The best brunette ATM porn videos, hand-picked and updated daily.', 'Brunette ATM Porn – Ass to Mouth Brunette Videos', 'Watch the best brunette ATM porn: gorgeous brunettes taking it ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 5),
  ('Blonde ATM', 'blonde-atm', 'Blondes going ass to mouth. The best blonde ATM porn videos, hand-picked and updated daily.', 'Blonde ATM Porn – Ass to Mouth Blonde Videos', 'Watch the best blonde ATM porn: hot blondes taking it ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 6),
  ('Redhead ATM', 'redhead-atm', 'Redheads going ass to mouth. The best redhead ATM porn videos, hand-picked and updated daily.', 'Redhead ATM Porn – Ass to Mouth Redhead Videos', 'Watch the best redhead ATM porn: fiery redheads taking it ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 7),
  ('Ebony ATM', 'ebony-atm', 'Ebony stars going ass to mouth. The best ebony ATM porn videos, hand-picked and updated daily.', 'Ebony ATM Porn – Ass to Mouth Ebony Videos', 'Watch the best ebony ATM porn: stunning ebony stars taking it ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 8),
  ('Asian ATM', 'asian-atm', 'Asian stars going ass to mouth. The best Asian ATM porn videos, hand-picked and updated daily.', 'Asian ATM Porn – Ass to Mouth Asian Videos', 'Watch the best Asian ATM porn: gorgeous Asian stars taking it ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 9)
) AS v(name, slug, intro, seo, meta, pos)
WHERE p."slug" = 'main'
ON CONFLICT ("publication_id", "slug") DO NOTHING;
--> statement-breakpoint

-- 3. Names, copy and menu order for the ATM categories.
UPDATE "categories" c SET
  "name" = coalesce(v.name, c."name"), "intro" = coalesce(v.intro, c."intro"),
  "seo_title" = coalesce(v.seo, c."seo_title"), "meta_description" = coalesce(v.meta, c."meta_description"),
  "position" = v.pos, "indexable" = true, "updated_at" = now()
FROM "publications" p, (VALUES
  ('atm-anal', NULL, NULL, NULL, NULL, 0),
  ('double-anal-atm', 'Double Anal ATM', 'Two at once, then straight ass to mouth. The best double anal ATM porn videos, hand-picked and updated daily.', 'Double Anal ATM Porn – DAP Ass to Mouth Videos', 'Watch the best double anal ATM porn: DAP scenes that finish ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 1),
  ('triple-anal-atm', 'Triple Anal ATM', 'The most extreme ass to mouth there is: triple anal scenes, hand-picked and updated daily.', 'Triple Anal ATM Porn – Extreme Ass to Mouth Videos', 'Triple anal ATM porn at its most extreme: TAP scenes that go ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 2),
  ('amateur-atm', NULL, NULL, NULL, NULL, 3),
  ('atm-threesomes', NULL, NULL, NULL, NULL, 4),
  ('brunette-atm', 'Brunette ATM', 'Brunettes going ass to mouth. The best brunette ATM porn videos, hand-picked and updated daily.', 'Brunette ATM Porn – Ass to Mouth Brunette Videos', 'Watch the best brunette ATM porn: gorgeous brunettes taking it ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 5),
  ('blonde-atm', 'Blonde ATM', 'Blondes going ass to mouth. The best blonde ATM porn videos, hand-picked and updated daily.', 'Blonde ATM Porn – Ass to Mouth Blonde Videos', 'Watch the best blonde ATM porn: hot blondes taking it ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 6),
  ('redhead-atm', 'Redhead ATM', 'Redheads going ass to mouth. The best redhead ATM porn videos, hand-picked and updated daily.', 'Redhead ATM Porn – Ass to Mouth Redhead Videos', 'Watch the best redhead ATM porn: fiery redheads taking it ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 7),
  ('ebony-atm', 'Ebony ATM', 'Ebony stars going ass to mouth. The best ebony ATM porn videos, hand-picked and updated daily.', 'Ebony ATM Porn – Ass to Mouth Ebony Videos', 'Watch the best ebony ATM porn: stunning ebony stars taking it ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 8),
  ('asian-atm', 'Asian ATM', 'Asian stars going ass to mouth. The best Asian ATM porn videos, hand-picked and updated daily.', 'Asian ATM Porn – Ass to Mouth Asian Videos', 'Watch the best Asian ATM porn: gorgeous Asian stars taking it ass to mouth. Free videos, hand-picked and updated daily. 18+ only.', 9)
) AS v(slug, name, intro, seo, meta, pos)
WHERE p."slug" = 'main' AND c."publication_id" = p."id" AND c."slug" = v.slug;
--> statement-breakpoint
UPDATE "categories" c SET "position" = 20 + (c."slug" = 'ai')::int
FROM "publications" p WHERE p."slug" = 'main' AND c."publication_id" = p."id" AND c."slug" IN ('best-of', 'ai');
--> statement-breakpoint

-- 4. Remove ATM Compilations, only if nothing is in it.
DELETE FROM "categories" c USING "publications" p
WHERE p."slug" = 'main' AND c."publication_id" = p."id" AND c."slug" = 'atm-compilations'
  AND NOT EXISTS (SELECT 1 FROM "content_items" ci WHERE ci."category_id" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "content_categories" cc WHERE cc."category_id" = c."id");
--> statement-breakpoint

-- 5. Old addresses keep working.
INSERT INTO "redirects" ("id", "publication_id", "from_path", "to_path", "status_code")
SELECT gen_random_uuid()::text, p."id", v.from_path, v.to_path, 301
FROM "publications" p
CROSS JOIN (VALUES ('/category/brunette', '/category/brunette-atm'), ('/category/blonde', '/category/blonde-atm'), ('/category/black', '/category/ebony-atm'), ('/category/double-anal', '/category/double-anal-atm'), ('/category/atm-compilations', '/category/atm-anal')) AS v(from_path, to_path)
WHERE p."slug" = 'main'
  AND NOT EXISTS (SELECT 1 FROM "categories" x WHERE x."publication_id" = p."id" AND '/category/' || x."slug" = v.from_path)
ON CONFLICT ("publication_id", "from_path") DO NOTHING;
--> statement-breakpoint

-- 6. The menu.
UPDATE "publications" SET "settings" = jsonb_set("settings", '{nav}', '[{"label": "Latest videos", "href": "/videos"}, {"label": "ATM Anal", "href": "/category/atm-anal"}, {"label": "Double Anal ATM", "href": "/category/double-anal-atm"}, {"label": "Triple Anal ATM", "href": "/category/triple-anal-atm"}, {"label": "Amateur ATM", "href": "/category/amateur-atm"}, {"label": "ATM Threesomes", "href": "/category/atm-threesomes"}, {"label": "Brunette ATM", "href": "/category/brunette-atm"}, {"label": "Blonde ATM", "href": "/category/blonde-atm"}, {"label": "Redhead ATM", "href": "/category/redhead-atm"}, {"label": "Ebony ATM", "href": "/category/ebony-atm"}, {"label": "Asian ATM", "href": "/category/asian-atm"}]'::jsonb)
WHERE "slug" = 'main';
