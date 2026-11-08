-- Links the real domain to the "main" publication (Ass to Mouth).
-- asstomouth.net is the primary host; www.asstomouth.net is mapped too, though
-- the Worker redirects it to the primary (CANONICAL_HOSTS in wrangler.jsonc).
-- Safe to run more than once, and a no-op where "main" doesn't exist
-- (fresh or test databases).
INSERT INTO "publication_domains" ("id", "publication_id", "hostname", "kind", "is_primary", "verified_at")
SELECT gen_random_uuid()::text, p."id", d.hostname, 'custom', d.is_primary, now()
FROM "publications" p
CROSS JOIN (VALUES ('asstomouth.net', true), ('www.asstomouth.net', false)) AS d(hostname, is_primary)
WHERE p."slug" = 'main'
ON CONFLICT ("hostname") DO NOTHING;
