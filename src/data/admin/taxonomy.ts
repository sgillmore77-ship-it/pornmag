import { and, asc, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { authors, categories, contentItems, contentTags, entities, media, tags } from "@/db/schema";
import type { Site } from "../site";
import { slugify } from "./content";

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const seo = {
  seoTitle: opt(120),
  metaDescription: opt(320),
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategoriesAdmin(db: Db, s: Site) {
  const used = sql<number>`(select count(*)::int from ${contentItems} where ${contentItems.categoryId} = "categories"."id"
    or exists (select 1 from content_categories cc where cc.content_id = ${contentItems.id} and cc.category_id = "categories"."id"))`;
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      intro: categories.intro,
      position: categories.position,
      indexable: categories.indexable,
      seoTitle: categories.seoTitle,
      metaDescription: categories.metaDescription,
      imageId: categories.imageId,
      parentId: categories.parentId,
      used,
    })
    .from(categories)
    .where(eq(categories.publicationId, s.publicationId))
    .orderBy(asc(categories.position), asc(categories.name));
}

export const categoryInput = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(1, "is required").max(80),
  slug: z.string().trim().max(80).optional(),
  intro: opt(2000),
  position: z.coerce.number().int().min(0).max(10_000).default(0),
  indexable: z.boolean().default(true),
  imageId: z
    .string()
    .max(64)
    .optional()
    .transform((v) => (v ? v : null)),
  ...seo,
});

export async function saveCategory(db: Db, s: Site, raw: z.input<typeof categoryInput>) {
  const i = categoryInput.parse(raw);
  if (i.imageId) {
    const [m] = await db.select({ id: media.id }).from(media).where(and(eq(media.id, i.imageId), eq(media.publicationId, s.publicationId)));
    if (!m) throw new Error("Unknown image");
  }
  const values = {
    publicationId: s.publicationId,
    name: i.name,
    slug: slugify(i.slug || i.name),
    intro: i.intro,
    position: i.position,
    indexable: i.indexable,
    imageId: i.imageId,
    seoTitle: i.seoTitle,
    metaDescription: i.metaDescription,
  };
  if (!values.slug) throw new Error("Slug: is required");
  if (i.id) {
    const r = await db.update(categories).set(values).where(and(eq(categories.id, i.id), eq(categories.publicationId, s.publicationId))).returning({ id: categories.id });
    if (!r.length) throw new Error("Not found");
    return r[0].id;
  }
  const [r] = await db.insert(categories).values(values).returning({ id: categories.id });
  return r.id;
}

export async function deleteCategory(db: Db, s: Site, id: string) {
  // Content in the category keeps existing; it just loses its category.
  const r = await db.delete(categories).where(and(eq(categories.id, id), eq(categories.publicationId, s.publicationId))).returning({ name: categories.name });
  if (!r.length) throw new Error("Not found");
  return r[0];
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function listTagsAdmin(db: Db, s: Site) {
  const used = sql<number>`(select count(*)::int from ${contentTags} where ${contentTags.tagId} = "tags"."id")`;
  return db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      description: tags.description,
      indexable: tags.indexable,
      seoTitle: tags.seoTitle,
      metaDescription: tags.metaDescription,
      used,
    })
    .from(tags)
    .where(eq(tags.publicationId, s.publicationId))
    .orderBy(asc(tags.name));
}

export const tagInput = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(1, "is required").max(60),
  slug: z.string().trim().max(60).optional(),
  description: opt(2000),
  indexable: z.boolean().default(false),
  ...seo,
});

export async function saveTag(db: Db, s: Site, raw: z.input<typeof tagInput>) {
  const i = tagInput.parse(raw);
  const values = {
    publicationId: s.publicationId,
    name: i.name,
    slug: slugify(i.slug || i.name),
    description: i.description,
    indexable: i.indexable,
    seoTitle: i.seoTitle,
    metaDescription: i.metaDescription,
  };
  if (!values.slug) throw new Error("Slug: is required");
  if (i.id) {
    const r = await db.update(tags).set(values).where(and(eq(tags.id, i.id), eq(tags.publicationId, s.publicationId))).returning({ id: tags.id });
    if (!r.length) throw new Error("Not found");
    return r[0].id;
  }
  const [r] = await db.insert(tags).values(values).returning({ id: tags.id });
  return r.id;
}

export async function deleteTag(db: Db, s: Site, id: string) {
  const r = await db.delete(tags).where(and(eq(tags.id, id), eq(tags.publicationId, s.publicationId))).returning({ name: tags.name });
  if (!r.length) throw new Error("Not found");
  return r[0];
}

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

export async function listAuthorsAdmin(db: Db, s: Site) {
  const used = sql<number>`(select count(*)::int from content_authors ca where ca.author_id = "authors"."id")`;
  return db
    .select({ id: authors.id, name: authors.name, slug: authors.slug, role: authors.role, bio: authors.bio, userId: authors.userId, used })
    .from(authors)
    .where(eq(authors.publicationId, s.publicationId))
    .orderBy(asc(authors.name));
}

export const authorInput = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(1, "is required").max(80),
  role: opt(80),
  bio: opt(2000),
});

export async function saveAuthor(db: Db, s: Site, raw: z.input<typeof authorInput>) {
  const i = authorInput.parse(raw);
  const values = { publicationId: s.publicationId, name: i.name, slug: slugify(i.name), role: i.role, bio: i.bio };
  if (i.id) {
    const r = await db.update(authors).set(values).where(and(eq(authors.id, i.id), eq(authors.publicationId, s.publicationId))).returning({ id: authors.id });
    if (!r.length) throw new Error("Not found");
    return r[0].id;
  }
  const [r] = await db.insert(authors).values(values).returning({ id: authors.id });
  return r.id;
}

/** The author profile linked to a user, created on first use, so new pieces get a byline. */
export async function authorForUser(db: Db, s: Site, user: { id: string; name: string }) {
  const [existing] = await db.select({ id: authors.id }).from(authors).where(and(eq(authors.publicationId, s.publicationId), eq(authors.userId, user.id)));
  if (existing) return existing.id;
  let slug = slugify(user.name) || "author";
  const [{ n }] = await db.select({ n: count() }).from(authors).where(and(eq(authors.publicationId, s.publicationId), eq(authors.slug, slug)));
  if (n > 0) slug = `${slug}-${user.id.slice(0, 6).toLowerCase()}`;
  const [r] = await db.insert(authors).values({ publicationId: s.publicationId, userId: user.id, name: user.name, slug }).returning({ id: authors.id });
  return r.id;
}

export async function deleteAuthor(db: Db, s: Site, id: string) {
  // Refuse while credited on content, so no story silently loses its byline.
  const [{ n }] = await db.select({ n: count() }).from(sql`content_authors`).where(sql`author_id = ${id}`);
  if (n > 0) throw new Error(`This author is credited on ${n} piece${n === 1 ? "" : "s"}. Reassign them first.`);
  const r = await db.delete(authors).where(and(eq(authors.id, id), eq(authors.publicationId, s.publicationId))).returning({ name: authors.name });
  if (!r.length) throw new Error("Not found");
  return r[0];
}

// ---------------------------------------------------------------------------
// Studios, creators, websites, products and services (what content covers)
// ---------------------------------------------------------------------------

export const ENTITY_KINDS = ["studio", "creator", "website", "product", "service"] as const;

export async function listEntitiesAdmin(db: Db, s: Site) {
  const used = sql<number>`(
    (select count(*)::int from content_entities ce where ce.entity_id = "entities"."id")
  )`;
  return db
    .select({ id: entities.id, kind: entities.kind, name: entities.name, slug: entities.slug, description: entities.description, websiteUrl: entities.websiteUrl, used })
    .from(entities)
    .where(eq(entities.publicationId, s.publicationId))
    .orderBy(asc(entities.kind), asc(entities.name));
}

export const entityInput = z.object({
  id: z.string().max(64).optional(),
  kind: z.enum(ENTITY_KINDS),
  name: z.string().trim().min(1, "is required").max(120),
  description: opt(2000),
  websiteUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https:\/\//.test(v), "must start with https://"),
});

export async function saveEntity(db: Db, s: Site, raw: z.input<typeof entityInput>) {
  const i = entityInput.parse(raw);
  const values = { publicationId: s.publicationId, kind: i.kind, name: i.name, slug: slugify(i.name), description: i.description, websiteUrl: i.websiteUrl };
  if (!values.slug) throw new Error("Name: needs letters or numbers");
  if (i.id) {
    const r = await db.update(entities).set(values).where(and(eq(entities.id, i.id), eq(entities.publicationId, s.publicationId))).returning({ id: entities.id });
    if (!r.length) throw new Error("Not found");
    return r[0].id;
  }
  const [r] = await db.insert(entities).values(values).returning({ id: entities.id });
  return r.id;
}

export async function deleteEntity(db: Db, s: Site, id: string) {
  const r = await db.delete(entities).where(and(eq(entities.id, id), eq(entities.publicationId, s.publicationId))).returning({ name: entities.name });
  if (!r.length) throw new Error("Not found");
  return r[0];
}
