-- Archive the design-sample stories loaded by the seed on the live 'main' site.
-- Archived items are hidden from readers but kept in Admin -> Content (status
-- "Archived"), so this is reversible. Matches exact sample title + type only;
-- safe to re-run.
UPDATE "content_items" ci
SET "status" = 'archived', "updated_at" = now()
FROM "publications" p,
(VALUES
  ('article', 'The Auteurs of After Dark'),
  ('article', 'The studio betting everything on slow, cinematic 4K'),
  ('article', 'The AI performer problem: who owns a face?'),
  ('article', 'Sienna Vale on directing her first feature'),
  ('article', 'Why the best scenes now start with a conversation'),
  ('article', 'Lighting desire: a cinematographer''s notebook'),
  ('article', 'Ten years of performer-owned platforms'),
  ('article', 'In praise of the unhurried scene'),
  ('article', 'The 25 best scenes of 2026 (so far)'),
  ('article', 'The costume designer dressing adult cinema'),
  ('review', 'Velour Hours'),
  ('review', 'Night Swim'),
  ('review', 'Second Skin'),
  ('review', 'Afterglow, Vol. 2'),
  ('video', 'Velour Hours'),
  ('video', 'Night Swim'),
  ('video', 'Gilded'),
  ('video', 'Low Tide'),
  ('video', 'The Fitting Room'),
  ('video', 'Slow Burn'),
  ('video', 'Neon Hours'),
  ('video', 'Linen'),
  ('video', 'Velour Hours: official trailer'),
  ('video', 'Behind the lens with Lumen Ortiz'),
  ('video', 'Night Swim: first look'),
  ('news', 'Halcyon Pictures signs three-picture deal with Atelier Noir'),
  ('news', 'New EU age-verification rules: what changes in January'),
  ('news', 'Nominations announced for the 2027 Independent Adult Film Awards'),
  ('news', 'Major platform bans unlabelled synthetic performers'),
  ('news', 'Berlin''s after-dark film festival returns with a record programme'),
  ('news', 'Performer collective launches its own streaming co-op'),
  ('news', 'The 8K cinema camera everyone on set is talking about'),
  ('article', 'Unpublished draft'),
  ('article', 'Embargoed story')
) AS s("type", "title")
WHERE p."id" = ci."publication_id"
  AND p."slug" = 'main'
  AND ci."type"::text = s."type"
  AND ci."title" = s."title"
  AND ci."status" <> 'archived';
