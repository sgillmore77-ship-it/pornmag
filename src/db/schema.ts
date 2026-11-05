/**
 * Database schema.
 *
 * Covers every phase of the roadmap so later phases add UI, not migrations
 * that reshape existing data. See docs/ARCHITECTURE.md for the reasoning.
 *
 * Tenancy rule: every table that holds publisher data has a non-null
 * `publicationId`. Application code must only reach those tables through the
 * publication-scoped data layer in `src/db/tenant.ts`.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const publicationId = () =>
  text("publication_id")
    .notNull()
    .references(() => publications.id, { onDelete: "cascade" });

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

/** Shared SEO columns for anything that renders as its own page. */
const seoColumns = () => ({
  seoTitle: text("seo_title"),
  metaDescription: text("meta_description"),
  canonicalUrl: text("canonical_url"),
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const memberRole = pgEnum("member_role", [
  "admin",
  "editor",
  "author",
  "moderator",
  "user",
]);
export const domainKind = pgEnum("domain_kind", ["platform", "custom"]);
export const publicationStatus = pgEnum("publication_status", [
  "active",
  "suspended",
]);
export const contentType = pgEnum("content_type", [
  "article",
  "review",
  "video",
  "news",
]);
export const contentStatus = pgEnum("content_status", [
  "draft",
  "scheduled",
  "published",
  "archived",
]);
export const entityKind = pgEnum("entity_kind", [
  "studio",
  "creator",
  "website",
  "product",
  "service",
]);
export const homepageSectionKind = pgEnum("homepage_section_kind", [
  "hero",
  "latest",
  "featured_reviews",
  "trending",
  "featured_videos",
  "editors_picks",
  "categories",
  "latest_news",
  "newsletter",
]);
export const adSlot = pgEnum("ad_slot", [
  "header_leaderboard",
  "in_content",
  "sidebar",
  "between_grid",
  "footer",
]);
export const commentStatus = pgEnum("comment_status", [
  "pending",
  "approved",
  "rejected",
  "removed",
  "spam",
]);

// ---------------------------------------------------------------------------
// Platform: publications and domains
// ---------------------------------------------------------------------------

export type PublicationTheme = {
  /** Primary brand colour as a hex string. */
  primaryColor: string;
  /** One of the controlled typography pairings in src/lib/theme.ts. */
  fontPairing: string;
  /** Homepage/header direction: "feed" (grid-led) or "issue" (cover-led). */
  layout?: "feed" | "issue";
  /** Force a colour mode; otherwise follows the reader's device. */
  mode?: "light" | "dark" | "system";
  logoMediaId?: string | null;
  faviconMediaId?: string | null;
};

export type PublicationSettings = {
  commentsEnabled: boolean;
  /** Hook for age assurance; the provider is chosen before launch. */
  ageGate: { enabled: boolean; provider: string | null };
  locale: string;
  timeZone?: string;
  /** Main navigation, in order. Only link to pages that exist. */
  nav?: NavLink[];
  /** Footer link columns. */
  footer?: { title: string; links: NavLink[] }[];
  /** Short description shown under the footer wordmark. */
  footerBlurb?: string;
  /** Dateline for the "issue" layout, e.g. "Issue 047 · The After Dark Issue". */
  issueLabel?: string;
  ads?: {
    /** Show labelled empty ad boxes so layouts can be reviewed. Turn off for launch. */
    previewPlaceholders?: boolean;
  };
};

export type NavLink = { label: string; href: string };

export const publications = pgTable("publications", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  status: publicationStatus("status").notNull().default("active"),
  theme: jsonb("theme").$type<PublicationTheme>().notNull(),
  settings: jsonb("settings").$type<PublicationSettings>().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const publicationDomains = pgTable(
  "publication_domains",
  {
    id: id(),
    publicationId: publicationId(),
    hostname: text("hostname").notNull(),
    kind: domainKind("kind").notNull().default("platform"),
    isPrimary: boolean("is_primary").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("publication_domains_hostname_uq").on(t.hostname)],
);

// ---------------------------------------------------------------------------
// Auth (tables follow Better Auth's expected shape)
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** Platform owner. Never granted through the UI. */
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Auth rate-limit counters (shared across Worker isolates via Postgres). */
export const rateLimits = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/**
 * A user's role within one publication. Login identity is platform-wide;
 * everything a user can do or see is decided per publication by this row.
 */
export const memberships = pgTable(
  "memberships",
  {
    publicationId: publicationId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("user"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.publicationId, t.userId] })],
);

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export const media = pgTable(
  "media",
  {
    id: id(),
    publicationId: publicationId(),
    /** Object-storage key (R2). Public URL is derived, never stored. */
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: integer("size_bytes"),
    alt: text("alt").notNull().default(""),
    caption: text("caption"),
    credit: text("credit"),
    /** Dominant colour for image placeholders. */
    blurColor: text("blur_color"),
    uploadedBy: text("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("media_publication_idx").on(t.publicationId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// People and taxonomy
// ---------------------------------------------------------------------------

export const authors = pgTable(
  "authors",
  {
    id: id(),
    publicationId: publicationId(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    role: text("role"),
    bio: text("bio"),
    avatarId: text("avatar_id").references(() => media.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("authors_pub_slug_uq").on(t.publicationId, t.slug)],
);

export const categories = pgTable(
  "categories",
  {
    id: id(),
    publicationId: publicationId(),
    parentId: text("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    intro: text("intro"),
    imageId: text("image_id").references(() => media.id, {
      onDelete: "set null",
    }),
    position: integer("position").notNull().default(0),
    /** Only index category pages with enough content (see src/lib/seo.ts). */
    indexable: boolean("indexable").notNull().default(true),
    ...seoColumns(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("categories_pub_slug_uq").on(t.publicationId, t.slug)],
);

export const tags = pgTable(
  "tags",
  {
    id: id(),
    publicationId: publicationId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    /** Tag pages are noindex until an editor opts them in. */
    indexable: boolean("indexable").notNull().default(false),
    ...seoColumns(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("tags_pub_slug_uq").on(t.publicationId, t.slug)],
);

/** Studios, creators, websites, products and services that content covers. */
export const entities = pgTable(
  "entities",
  {
    id: id(),
    publicationId: publicationId(),
    kind: entityKind("kind").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    websiteUrl: text("website_url"),
    imageId: text("image_id").references(() => media.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("entities_pub_kind_slug_uq").on(t.publicationId, t.kind, t.slug),
  ],
);

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/** Rich text is stored as the editor's JSON document (TipTap/ProseMirror). */
export type RichTextDoc = { type: "doc"; content?: RichTextNode[] };
export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

export const contentItems = pgTable(
  "content_items",
  {
    id: id(),
    publicationId: publicationId(),
    type: contentType("type").notNull(),
    status: contentStatus("status").notNull().default("draft"),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    standfirst: text("standfirst"),
    body: jsonb("body").$type<RichTextDoc>(),
    heroImageId: text("hero_image_id").references(() => media.id, {
      onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    isFeatured: boolean("is_featured").notNull().default(false),
    commentsEnabled: boolean("comments_enabled").notNull().default(true),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    ...seoColumns(),
    ogImageId: text("og_image_id").references(() => media.id, {
      onDelete: "set null",
    }),
    robotsIndex: boolean("robots_index").notNull().default(true),
    /** Plain-text copy of the body, maintained on save, used for search. */
    bodyText: text("body_text").notNull().default(""),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(standfirst, '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(body_text, '')), 'C')`,
    ),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("content_pub_slug_uq").on(t.publicationId, t.slug),
    index("content_pub_status_published_idx").on(
      t.publicationId,
      t.status,
      t.publishedAt,
    ),
    index("content_category_idx").on(t.categoryId),
    index("content_search_idx").using("gin", t.searchVector),
  ],
);

export const contentAuthors = pgTable(
  "content_authors",
  {
    contentId: text("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.contentId, t.authorId] })],
);

export const contentTags = pgTable(
  "content_tags",
  {
    contentId: text("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.contentId, t.tagId] }),
    index("content_tags_tag_idx").on(t.tagId),
  ],
);

export const contentEntities = pgTable(
  "content_entities",
  {
    contentId: text("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.contentId, t.entityId] }),
    index("content_entities_entity_idx").on(t.entityId),
  ],
);

/** Editor-chosen related content; automatic suggestions fill any gaps. */
export const relatedContent = pgTable(
  "related_content",
  {
    contentId: text("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    relatedId: text("related_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.contentId, t.relatedId] })],
);

export const reviewDetails = pgTable("review_details", {
  contentId: text("content_id")
    .primaryKey()
    .references(() => contentItems.id, { onDelete: "cascade" }),
  /** 0–5 in half steps by default (scoreMax sets the scale). */
  score: numeric("score", { precision: 3, scale: 1 }).notNull(),
  scoreMax: integer("score_max").notNull().default(5),
  /** Optional editorial label, e.g. "Best New Release". */
  badge: text("badge"),
  releaseYear: integer("release_year"),
  pros: text("pros").array().notNull().default(sql`'{}'::text[]`),
  cons: text("cons").array().notNull().default(sql`'{}'::text[]`),
  verdict: text("verdict"),
  subjectEntityId: text("subject_entity_id").references(() => entities.id, {
    onDelete: "set null",
  }),
  affiliateUrl: text("affiliate_url"),
  pricing: text("pricing"),
  reviewedAt: date("reviewed_at"),
});

export const videoDetails = pgTable("video_details", {
  contentId: text("content_id")
    .primaryKey()
    .references(() => contentItems.id, { onDelete: "cascade" }),
  /** Approved embed provider key, validated against an allowlist. */
  provider: text("provider").notNull(),
  embedUrl: text("embed_url").notNull(),
  providerVideoId: text("provider_video_id"),
  durationSeconds: integer("duration_seconds"),
  studioEntityId: text("studio_entity_id").references(() => entities.id, {
    onDelete: "set null",
  }),
  thumbnailId: text("thumbnail_id").references(() => media.id, {
    onDelete: "set null",
  }),
  /** Reserved for direct hosting later; null while videos are embeds. */
  hostedMediaId: text("hosted_media_id").references(() => media.id, {
    onDelete: "set null",
  }),
});

/** Daily view counts, used for "trending" and the analytics dashboard. */
export const contentDailyStats = pgTable(
  "content_daily_stats",
  {
    publicationId: publicationId(),
    contentId: text("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    views: integer("views").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.contentId, t.day] }),
    index("stats_pub_day_idx").on(t.publicationId, t.day),
  ],
);

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

export type HomepageSectionConfig = {
  limit?: number;
  contentTypes?: ("article" | "review" | "video" | "news")[];
  categoryId?: string;
};

export const homepageSections = pgTable(
  "homepage_sections",
  {
    id: id(),
    publicationId: publicationId(),
    kind: homepageSectionKind("kind").notNull(),
    title: text("title"),
    position: integer("position").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config").$type<HomepageSectionConfig>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("homepage_sections_pub_idx").on(t.publicationId, t.position)],
);

/** Hand-picked items for a section (hero, editor's picks, categories). */
export const homepageSectionItems = pgTable(
  "homepage_section_items",
  {
    id: id(),
    sectionId: text("section_id")
      .notNull()
      .references(() => homepageSections.id, { onDelete: "cascade" }),
    contentId: text("content_id").references(() => contentItems.id, {
      onDelete: "cascade",
    }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "cascade",
    }),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("section_items_section_idx").on(t.sectionId, t.position)],
);

// ---------------------------------------------------------------------------
// Advertising
// ---------------------------------------------------------------------------

export const adPlacements = pgTable(
  "ad_placements",
  {
    id: id(),
    publicationId: publicationId(),
    slot: adSlot("slot").notNull(),
    name: text("name").notNull(),
    /** Third-party ad code. Rendered inside a sandboxed container. */
    code: text("code").notNull().default(""),
    enabled: boolean("enabled").notNull().default(false),
    devices: text("devices").array().notNull().default(sql`'{mobile,desktop}'::text[]`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("ad_placements_pub_slot_idx").on(t.publicationId, t.slot)],
);

// ---------------------------------------------------------------------------
// Community
// ---------------------------------------------------------------------------

export const comments = pgTable(
  "comments",
  {
    id: id(),
    publicationId: publicationId(),
    contentId: text("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    status: commentStatus("status").notNull().default("pending"),
    /** Hashed, never the raw IP. Used for spam and rate limiting. */
    ipHash: text("ip_hash"),
    moderatedBy: text("moderated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("comments_content_idx").on(t.contentId, t.status, t.createdAt),
    index("comments_pub_status_idx").on(t.publicationId, t.status),
    index("comments_user_idx").on(t.userId),
  ],
);

export const commentReports = pgTable(
  "comment_reports",
  {
    id: id(),
    publicationId: publicationId(),
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("comment_reports_pub_idx").on(t.publicationId, t.resolvedAt)],
);

/** Reports about content itself (not comments), e.g. takedown requests. */
export const contentReports = pgTable(
  "content_reports",
  {
    id: id(),
    publicationId: publicationId(),
    contentId: text("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reporterEmail: text("reporter_email"),
    reason: text("reason").notNull(),
    details: text("details"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("content_reports_pub_idx").on(t.publicationId, t.resolvedAt)],
);

export const favourites = pgTable(
  "favourites",
  {
    publicationId: publicationId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentId: text("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.contentId] })],
);

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export const redirects = pgTable(
  "redirects",
  {
    id: id(),
    publicationId: publicationId(),
    fromPath: text("from_path").notNull(),
    toPath: text("to_path").notNull(),
    statusCode: integer("status_code").notNull().default(301),
    hits: integer("hits").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("redirects_pub_from_uq").on(t.publicationId, t.fromPath)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    /** Null for platform-level actions taken by a super admin. */
    publicationId: text("publication_id").references(() => publications.id, {
      onDelete: "cascade",
    }),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_pub_idx").on(t.publicationId, t.createdAt)],
);
