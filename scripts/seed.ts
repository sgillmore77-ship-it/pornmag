/**
 * Seeds a development publication with the design's sample content.
 *
 *   npm run db:seed
 *
 * Re-running replaces the "main" publication and everything in it. Set
 * SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to also create a platform-owner
 * account. SEED_LAYOUT=feed|issue picks the homepage direction.
 *
 * Copy and studios are fictional. Images are placeholders: a tone plus an
 * art-direction caption (storage key "placeholder:<hex>"), rendered as the
 * design's striped blocks until real photos are uploaded.
 */
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { createNodeDb, type Db } from "../src/db/client";
import * as t from "../src/db/schema";
import type { RichTextDoc, RichTextNode } from "../src/db/schema";
import { docToText } from "../src/lib/doc-text";

const SLUG = "main";

const p = (text: string): RichTextNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const h2 = (text: string): RichTextNode => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const quote = (text: string, attribution: string): RichTextNode => ({
  type: "pullQuote",
  attrs: { attribution },
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

function longform(dek: string): RichTextDoc {
  return {
    type: "doc",
    content: [
      p(`${dek} This is placeholder copy that stands in for the finished piece, so layout, typography and reading rhythm can be judged at a realistic length.`),
      p("Editorial pages are designed to be read, not skimmed: a generous measure, clear hierarchy and room for images and quotes to breathe. Real reporting replaces this text before launch."),
      p("A third paragraph gives the page some weight. Features here mix reporting, interviews and criticism, and the template has to carry all three without feeling cramped on a phone."),
      p("The fourth paragraph is where an in-article advertisement can sit, clearly labelled and never inside a headline or pull quote."),
      h2("What changes on set"),
      p("Subheadings break up longer reads. They use the display face, so the page keeps the magazine's voice all the way down."),
      quote("The best work here should feel like it belongs in a magazine, not a feed.", "Placeholder pull quote"),
      p("Lists and tables are supported for rankings, buying guides and comparisons."),
      {
        type: "bulletList",
        content: ["Clear, scannable structure", "Fast on mobile connections", "Ads and affiliate links that never crowd the story"].map((x) => ({
          type: "listItem",
          content: [p(x)],
        })),
      },
      h2("What comes next"),
      p("The closing section wraps up the piece and points readers to related stories, which appear automatically underneath."),
    ],
  };
}

type Img = { tone: string; caption: string };
type Item = {
  type: "article" | "review" | "video" | "news";
  title: string;
  dek: string;
  category: string;
  author: string;
  hoursAgo: number;
  img: Img;
  featured?: boolean;
  views?: number;
  review?: { score: number; studio: string; year: number; verdict: string; badge?: string; pros?: string[]; cons?: string[]; pricing?: string };
  video?: { duration: string; studio: string; score?: number };
};

const AUTHORS = ["Mara Okafor", "Jonah Reyes", "Priya Lal", "Theo Marsh", "Ada Brooks", "Lumen Ortiz", "Kai Ndlovu", "The Editors", "Newsdesk"];
const STUDIOS = ["Halcyon Pictures", "Blue Hour Films", "Atelier Noir", "Sunday Studio"];
const NAV_CATEGORIES = ["Best Of", "Brunette", "Blonde", "Black", "AI"];

const ITEMS: Item[] = [
  // Cover story
  { type: "article", title: "The Auteurs of After Dark", dek: "A new generation of directors is shooting adult film like cinema: long takes, real scripts, performers with final say. We spent a month on set to see what changes when the camera actually cares.", category: "Feature", author: "Mara Okafor", hoursAgo: 2, img: { tone: "#3A2226", caption: "Editorial portrait. Red silk, low-key light" }, featured: true },
  // Latest stories
  { type: "article", title: "The studio betting everything on slow, cinematic 4K", dek: "Halcyon Pictures cut its output in half. Its revenue doubled.", category: "Industry", author: "Jonah Reyes", hoursAgo: 20, img: { tone: "#2A2B30", caption: "Film set, cropped. Dolly track, soft focus" } },
  { type: "article", title: "The AI performer problem: who owns a face?", dek: "Synthetic stars are here. The contracts haven't caught up.", category: "Opinion", author: "Priya Lal", hoursAgo: 22, img: { tone: "#23272B", caption: "Abstract. Chrome mannequin in profile" }, views: 900 },
  { type: "article", title: "Sienna Vale on directing her first feature", dek: "Ten years in front of the camera, one year behind it.", category: "Interview", author: "Theo Marsh", hoursAgo: 44, img: { tone: "#33282A", caption: "Portrait, blurred. Backlit window" }, views: 600 },
  { type: "article", title: "Why the best scenes now start with a conversation", dek: "Consent-forward filmmaking has become an aesthetic, not just a policy.", category: "Culture", author: "Ada Brooks", hoursAgo: 46, img: { tone: "#2E2924", caption: "Two hands, cropped. Linen sheets" } },
  { type: "article", title: "Lighting desire: a cinematographer's notebook", dek: "Practicals, gels and the art of the flattering shadow.", category: "Craft", author: "Lumen Ortiz", hoursAgo: 70, img: { tone: "#24222E", caption: "Abstract. Neon spill on wet glass" } },
  { type: "article", title: "Ten years of performer-owned platforms", dek: "What changed when the talent started owning the means of distribution.", category: "Business", author: "Kai Ndlovu", hoursAgo: 94, img: { tone: "#2B2622", caption: "Fashion still. Velvet chair, empty room" } },
  // Editor's picks
  { type: "article", title: "In praise of the unhurried scene", dek: "The case for slowness in an industry built on speed.", category: "Essay", author: "Ada Brooks", hoursAgo: 120, img: { tone: "#2D2A2F", caption: "Silhouette behind frosted glass" } },
  { type: "article", title: "The 25 best scenes of 2026 (so far)", dek: "Our critics' running list, ranked and argued over.", category: "Best Of", author: "The Editors", hoursAgo: 130, img: { tone: "#3A2224", caption: "Abstract. Red light leak on film" }, views: 700 },
  { type: "article", title: "The costume designer dressing adult cinema", dek: "How one atelier turned wardrobe into narrative.", category: "Profile", author: "Theo Marsh", hoursAgo: 140, img: { tone: "#2B2823", caption: "Tailoring detail, pins and chalk" } },
  // Reviews (scores out of 5)
  { type: "review", title: "Velour Hours", dek: "A languid two-hander from Halcyon Pictures.", category: "Brunette", author: "Mara Okafor", hoursAgo: 26, img: { tone: "#3B1F25", caption: "Still. Velvet, deep red, out of focus" }, review: { score: 4.5, studio: "Halcyon Pictures", year: 2026, badge: "Best New Release", verdict: "A languid, gorgeously lit two-hander that trusts its audience. The year’s most confident release.", pros: ["Beautiful tungsten lighting", "Performances with real chemistry", "Restrained, confident editing"], cons: ["Slow first act"], pricing: "Rent $7.99 · Buy $14.99" } },
  { type: "review", title: "Night Swim", dek: "Blue Hour Films goes after dark.", category: "Blonde", author: "Mara Okafor", hoursAgo: 50, img: { tone: "#1E2733", caption: "Abstract. Rippled water at night" }, review: { score: 4, studio: "Blue Hour Films", year: 2026, verdict: "Moody and quietly assured. The pool sequence is a career best." } },
  { type: "review", title: "Second Skin", dek: "Atelier Noir's most fashion-forward release.", category: "Black", author: "Jonah Reyes", hoursAgo: 74, img: { tone: "#2C2C2E", caption: "Fashion. Latex glove, studio white" }, review: { score: 3.5, studio: "Atelier Noir", year: 2026, verdict: "Stunning wardrobe, thin script. Worth it for the final act." } },
  { type: "review", title: "Afterglow, Vol. 2", dek: "Sunday Studio returns.", category: "Best Of", author: "Priya Lal", hoursAgo: 98, img: { tone: "#3A2E22", caption: "Golden hour. Sheer curtain, silhouette" }, review: { score: 5, studio: "Sunday Studio", year: 2026, verdict: "The rare sequel that improves on everything. An instant classic." } },
  // Screening room
  { type: "video", title: "Velour Hours", dek: "The year’s most talked-about release, presented in full 4K with a director’s commentary track.", category: "Brunette", author: "The Editors", hoursAgo: 3, img: { tone: "#3B1F25", caption: "Hotel corridor, tungsten light" }, video: { duration: "32:10", studio: "Halcyon Pictures", score: 4.5 }, featured: true },
  { type: "video", title: "Night Swim", dek: "Full feature.", category: "Blonde", author: "The Editors", hoursAgo: 8, img: { tone: "#1E2733", caption: "Abstract. Pool light" }, video: { duration: "28:45", studio: "Blue Hour Films", score: 4 } },
  { type: "video", title: "Gilded", dek: "Full feature.", category: "Blonde", author: "The Editors", hoursAgo: 12, img: { tone: "#3A3022", caption: "Gold fabric, macro" }, video: { duration: "24:18", studio: "Atelier Noir", score: 4 } },
  { type: "video", title: "Low Tide", dek: "Full feature.", category: "Black", author: "The Editors", hoursAgo: 16, img: { tone: "#223033", caption: "Seascape, long exposure" }, video: { duration: "19:52", studio: "Sunday Studio", score: 3.5 } },
  { type: "video", title: "The Fitting Room", dek: "Full feature.", category: "Black", author: "The Editors", hoursAgo: 30, img: { tone: "#2C2A2E", caption: "Mirror, cropped reflection" }, video: { duration: "26:30", studio: "Atelier Noir", score: 4.5 } },
  { type: "video", title: "Slow Burn", dek: "Full feature.", category: "Brunette", author: "The Editors", hoursAgo: 34, img: { tone: "#3A2620", caption: "Candlelight bokeh" }, video: { duration: "41:07", studio: "Halcyon Pictures", score: 5 } },
  { type: "video", title: "Neon Hours", dek: "Full feature.", category: "AI", author: "The Editors", hoursAgo: 38, img: { tone: "#2A2036", caption: "Neon sign, blurred" }, video: { duration: "22:15", studio: "Blue Hour Films", score: 3.5 } },
  { type: "video", title: "Linen", dek: "Full feature.", category: "AI", author: "The Editors", hoursAgo: 42, img: { tone: "#34302B", caption: "White sheets, morning light" }, video: { duration: "30:02", studio: "Sunday Studio", score: 4 } },
  // Trending videos
  { type: "video", title: "Velour Hours: official trailer", dek: "First look at Halcyon's new release.", category: "Brunette", author: "The Editors", hoursAgo: 60, img: { tone: "#3B1F25", caption: "Trailer still, red curtain" }, video: { duration: "2:14", studio: "Halcyon Pictures" }, views: 1000 },
  { type: "video", title: "Behind the lens with Lumen Ortiz", dek: "A cinematographer at work.", category: "AI", author: "The Editors", hoursAgo: 80, img: { tone: "#24222E", caption: "Camera rig, backlit" }, video: { duration: "11:02", studio: "Blue Hour Films" }, views: 800 },
  { type: "video", title: "Night Swim: first look", dek: "Ninety seconds from the pool sequence.", category: "Blonde", author: "The Editors", hoursAgo: 100, img: { tone: "#1E2733", caption: "Pool edge, night" }, video: { duration: "1:48", studio: "Blue Hour Films" }, views: 500 },
  // The Wire
  { type: "news", title: "Halcyon Pictures signs three-picture deal with Atelier Noir", dek: "The two studios will co-produce through 2027.", category: "Industry", author: "Newsdesk", hoursAgo: 1, img: { tone: "#2A2B30", caption: "Studio lot, dusk" } },
  { type: "news", title: "New EU age-verification rules: what changes in January", dek: "A plain-English guide for readers.", category: "Legal", author: "Newsdesk", hoursAgo: 2.5, img: { tone: "#22283A", caption: "Abstract. Lock icon, blurred" } },
  { type: "news", title: "Nominations announced for the 2027 Independent Adult Film Awards", dek: "Independents dominate the shortlist.", category: "Awards", author: "Newsdesk", hoursAgo: 25, img: { tone: "#3A2E1E", caption: "Award still, gold" } },
  { type: "news", title: "Major platform bans unlabelled synthetic performers", dek: "Labels become mandatory from next month.", category: "AI", author: "Newsdesk", hoursAgo: 27, img: { tone: "#22283A", caption: "Abstract render, iridescent" } },
  { type: "news", title: "Berlin's after-dark film festival returns with a record programme", dek: "Documentary leads this year's selection.", category: "Festivals", author: "Newsdesk", hoursAgo: 50, img: { tone: "#2B2B2B", caption: "Cinema seats, empty" } },
  { type: "news", title: "Performer collective launches its own streaming co-op", dek: "Members keep 85% of revenue.", category: "Creators", author: "Newsdesk", hoursAgo: 53, img: { tone: "#2E2422", caption: "Portrait, cropped, warm light" } },
  { type: "news", title: "The 8K cinema camera everyone on set is talking about", dek: "Small body, big sensor.", category: "Tech", author: "Newsdesk", hoursAgo: 75, img: { tone: "#223033", caption: "Camera body, macro" } },
];

const CATEGORY_IMAGES: Record<string, Img> = {
  Brunette: { tone: "#2E2422", caption: "Portrait, dark hair, cropped" },
  Blonde: { tone: "#3A3326", caption: "Portrait, sunlit, overexposed" },
  Black: { tone: "#262224", caption: "Portrait, profile, rim light" },
  AI: { tone: "#22283A", caption: "Abstract render, iridescent" },
  "Best Of": { tone: "#3A2E1E", caption: "Award still, gold" },
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

function parseDuration(d: string): number {
  return d.split(":").map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

export async function seed(db: Db, opts: { layout?: "feed" | "issue" } = {}) {
  await db.delete(t.publications).where(eq(t.publications.slug, SLUG));
  const name = process.env.SEED_PUBLICATION_NAME ?? "Ass to Mouth";

  const nav: t.NavLink[] = [
    { label: "Latest videos", href: "/videos" },
    ...NAV_CATEGORIES.map((c) => ({ label: c, href: `/category/${slugify(c)}` })),
  ];

  const [pub] = await db
    .insert(t.publications)
    .values({
      slug: SLUG,
      name,
      tagline: "Adult film, culture and criticism",
      description: "An independent magazine of adult film, culture and criticism.",
      theme: { primaryColor: "#7A1F3D", fontPairing: "couture", layout: opts.layout ?? "issue", mode: "system" },
      settings: {
        commentsEnabled: true,
        ageGate: { enabled: true, provider: null },
        locale: "en-GB",
        timeZone: "Europe/London",
        nav,
        footerBlurb: "An independent magazine of adult film, culture and criticism.",
        issueLabel: "Issue 047 · The After Dark Issue",
        footer: [
          { title: "Watch", links: [{ label: "Latest videos", href: "/videos" }, { label: "Best Of", href: "/category/best-of" }, { label: "AI", href: "/category/ai" }] },
          { title: "Read", links: [{ label: "Reviews", href: "/reviews" }, { label: "Features", href: "/features" }, { label: "The Wire", href: "/news" }] },
          { title: "Magazine", links: [{ label: "Your account", href: "/account" }] },
        ],
        ads: { previewPlaceholders: true },
      },
    })
    .returning();

  if (process.env.SEED_DOMAIN) {
    await db.insert(t.publicationDomains).values({ publicationId: pub.id, hostname: process.env.SEED_DOMAIN, isPrimary: true, kind: "custom" });
  }

  const placeholder = async (img: Img) => {
    const [m] = await db
      .insert(t.media)
      .values({ publicationId: pub.id, storageKey: `placeholder:${img.tone}`, mimeType: "image/placeholder", caption: img.caption, alt: `Placeholder image: ${img.caption}`, blurColor: img.tone, width: 1600, height: 1200 })
      .returning({ id: t.media.id });
    return m.id;
  };

  // Categories: nav categories first (they get images), then editorial kickers.
  const catNames = [...NAV_CATEGORIES, ...new Set(ITEMS.map((i) => i.category).filter((c) => !NAV_CATEGORIES.includes(c)))];
  const catBySlug = new Map<string, string>();
  for (const [position, c] of catNames.entries()) {
    const imageId = CATEGORY_IMAGES[c] ? await placeholder(CATEGORY_IMAGES[c]) : null;
    const [row] = await db
      .insert(t.categories)
      .values({ publicationId: pub.id, name: c, slug: slugify(c), position, imageId, indexable: NAV_CATEGORIES.includes(c) })
      .returning({ id: t.categories.id });
    catBySlug.set(slugify(c), row.id);
  }

  const authorRows = await db
    .insert(t.authors)
    .values(AUTHORS.map((a) => ({ publicationId: pub.id, name: a, slug: slugify(a) })))
    .returning();
  const authorByName = new Map(authorRows.map((a) => [a.name, a.id]));

  const studios = await db
    .insert(t.entities)
    .values(STUDIOS.map((s) => ({ publicationId: pub.id, kind: "studio" as const, name: s, slug: slugify(s) })))
    .returning();
  const studioByName = new Map(studios.map((s) => [s.name, s.id]));

  const now = Date.now();
  const idByTitle = new Map<string, string>();
  const usedSlugs = new Set<string>();
  const viewRows: { contentId: string; views: number }[] = [];

  for (const item of ITEMS) {
    const body = item.type === "video" ? { type: "doc" as const, content: [p(item.dek)] } : longform(item.dek);
    const heroImageId = await placeholder(item.img);
    let slug = slugify(item.title);
    if (usedSlugs.has(slug)) slug = `${slug}-${item.type}`;
    usedSlugs.add(slug);
    const [row] = await db
      .insert(t.contentItems)
      .values({
        publicationId: pub.id,
        type: item.type,
        status: "published",
        title: item.title,
        slug,
        standfirst: item.dek,
        body,
        bodyText: docToText(body),
        heroImageId,
        categoryId: catBySlug.get(slugify(item.category)),
        isFeatured: !!item.featured,
        publishedAt: new Date(now - item.hoursAgo * 3_600_000),
      })
      .returning({ id: t.contentItems.id });
    idByTitle.set(item.title + item.type, row.id);
    if (item.views) viewRows.push({ contentId: row.id, views: item.views });

    await db.insert(t.contentAuthors).values({ contentId: row.id, authorId: authorByName.get(item.author)! });

    const rating = item.review ?? (item.video?.score ? { score: item.video.score } : null);
    if (rating) {
      await db.insert(t.reviewDetails).values({
        contentId: row.id,
        score: rating.score.toFixed(1),
        scoreMax: 5,
        badge: item.review?.badge ?? null,
        verdict: item.review?.verdict ?? null,
        pros: item.review?.pros ?? [],
        cons: item.review?.cons ?? [],
        pricing: item.review?.pricing ?? null,
        releaseYear: item.review?.year ?? null,
        subjectEntityId: item.review ? studioByName.get(item.review.studio) : null,
      });
    }
    const studioName = item.review?.studio ?? item.video?.studio;
    if (studioName) await db.insert(t.contentEntities).values({ contentId: row.id, entityId: studioByName.get(studioName)! });
    if (item.video) {
      await db.insert(t.videoDetails).values({
        contentId: row.id,
        // Placeholder until licensed embed partners are configured (Phase 1C).
        provider: "pending",
        embedUrl: "",
        durationSeconds: parseDuration(item.video.duration),
        studioEntityId: studioByName.get(item.video.studio),
      });
    }
  }

  // A draft and a future-dated item, which must never appear publicly.
  await db.insert(t.contentItems).values([
    { publicationId: pub.id, type: "article", status: "draft", title: "Unpublished draft", slug: "unpublished-draft" },
    { publicationId: pub.id, type: "article", status: "published", title: "Embargoed story", slug: "embargoed-story", publishedAt: new Date(now + 7 * 86_400_000) },
  ]);

  // Sample analytics for the last 14 days, so Trending and the Analytics
  // page have something to show. Story views and page views agree.
  const DAYS = 14;
  const dayOf = (back: number) => new Date(now - back * 86_400_000).toISOString().slice(0, 10);
  const statRows: (typeof t.contentDailyStats.$inferInsert)[] = [];
  const perDay = new Array<number>(DAYS).fill(0);
  for (const v of viewRows) {
    for (let back = 0; back < DAYS; back++) {
      // Newer days get more views; a gentle wobble keeps the chart honest-looking.
      const views = Math.max(1, Math.round(((v.views / DAYS) * (1.6 - back / DAYS)) * (0.85 + ((back * 7 + v.views) % 5) * 0.06)));
      statRows.push({ publicationId: pub.id, contentId: v.contentId, day: dayOf(back), views });
      perDay[back] += views;
    }
  }
  await db.insert(t.contentDailyStats).values(statRows);
  const split = { direct: 0.3, internal: 0.32, search: 0.22, social: 0.12, referral: 0.04 };
  await db.insert(t.trafficDailyStats).values(
    perDay.flatMap((storyViews, back) =>
      Object.entries(split).map(([source, share]) => ({ publicationId: pub.id, day: dayOf(back), source, views: Math.round(storyViews * 1.5 * share) })),
    ),
  );

  const kinds: (typeof t.homepageSections.$inferInsert)["kind"][] = [
    "hero", "latest", "featured_reviews", "trending", "featured_videos", "editors_picks", "categories", "latest_news", "newsletter",
  ];
  const sections = await db
    .insert(t.homepageSections)
    .values(kinds.map((kind, position) => ({ publicationId: pub.id, kind, position, enabled: kind !== "newsletter" })))
    .returning();
  const section = (k: string) => sections.find((s) => s.kind === k)!;
  const id = (title: string, type: Item["type"]) => idByTitle.get(title + type)!;

  await db.insert(t.homepageSectionItems).values([
    { sectionId: section("hero").id, contentId: id("The Auteurs of After Dark", "article"), position: 0 },
    ...["In praise of the unhurried scene", "The 25 best scenes of 2026 (so far)", "The costume designer dressing adult cinema"].map((title, position) => ({
      sectionId: section("editors_picks").id,
      contentId: id(title, "article"),
      position,
    })),
    ...["Velour Hours", "Night Swim", "Gilded", "Low Tide", "The Fitting Room", "Slow Burn", "Neon Hours", "Linen"].map((title, position) => ({
      sectionId: section("featured_videos").id,
      contentId: id(title, "video"),
      position,
    })),
    ...NAV_CATEGORIES.slice(1).concat("Best Of").map((c, position) => ({
      sectionId: section("categories").id,
      categoryId: catBySlug.get(slugify(c))!,
      position,
    })),
  ]);

  await seedCommunity(db, pub.id, id("Velour Hours", "review"));

  return { publicationId: pub.id, contentIds: [...idByTitle.values()] };
}

/** Sample readers and a short comment thread (these accounts can't sign in). */
async function seedCommunity(db: Db, publicationId: string, contentId: string) {
  const readers = [
    { id: "seed-reader-1", name: "Sample Reader One", handle: "night_owl", displayName: "Night Owl", bio: "Sample profile. Watches everything twice." },
    { id: "seed-reader-2", name: "Sample Reader Two", handle: "tungsten", displayName: null, bio: null },
    { id: "seed-reader-3", name: "Sample Reader Three", handle: "first_timer", displayName: null, bio: null },
  ];
  await db.delete(t.users).where(inArray(t.users.id, readers.map((r) => r.id)));
  await db.insert(t.users).values(readers.map((r) => ({ id: r.id, name: r.name, email: `${r.id}@example.invalid` })));
  await db.insert(t.memberships).values(readers.map((r) => ({ publicationId, userId: r.id, role: "user" as const, handle: r.handle, displayName: r.displayName, bio: r.bio })));
  const at = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000);
  const [top] = await db
    .insert(t.comments)
    .values({ publicationId, contentId, userId: "seed-reader-1", body: "The lighting in the second half is unreal. Sample comment, replace before launch.", status: "approved", createdAt: at(180), updatedAt: at(180) })
    .returning();
  await db.insert(t.comments).values([
    { publicationId, contentId, userId: "seed-reader-2", parentId: top.id, body: "Agreed — the tungsten practicals do a lot of work.", status: "approved", createdAt: at(120), updatedAt: at(120) },
    { publicationId, contentId, userId: "seed-reader-2", body: "Slow first act is fair, but it pays off.", status: "approved", createdAt: at(60), updatedAt: at(60) },
    { publicationId, contentId, userId: "seed-reader-3", body: "First comment here, waiting for a moderator. Sample.", status: "pending", createdAt: at(10), updatedAt: at(10) },
  ]);
}

async function createAdmin(db: Db, publicationId: string) {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;
  const { createAuth } = await import("../src/lib/auth");
  const [pub] = await db.select().from(t.publications).where(eq(t.publications.id, publicationId));
  const auth = createAuth(db, { ...pub, primaryHost: null }, "localhost:3000");

  let [user] = await db.select().from(t.users).where(eq(t.users.email, email.toLowerCase()));
  if (!user) {
    await auth.api.signUpEmail({ body: { email, password, name: "Admin" } });
    [user] = await db.select().from(t.users).where(eq(t.users.email, email.toLowerCase()));
  }
  await db.update(t.users).set({ isSuperAdmin: true }).where(eq(t.users.id, user.id));
  await db
    .insert(t.memberships)
    .values({ publicationId, userId: user.id, role: "admin" })
    .onConflictDoUpdate({ target: [t.memberships.publicationId, t.memberships.userId], set: { role: "admin" } });
  console.log(`Admin account ready: ${email}`);
}

if (process.argv[1]?.endsWith("seed.ts")) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const { db, close } = createNodeDb(url);
  const layout = process.env.SEED_LAYOUT === "feed" ? "feed" : "issue";
  seed(db, { layout })
    .then(async ({ publicationId, contentIds }) => {
      await createAdmin(db, publicationId);
      console.log(`Seeded publication "${SLUG}" (${layout} layout) with ${contentIds.length} published items.`);
    })
    .finally(close);
}
