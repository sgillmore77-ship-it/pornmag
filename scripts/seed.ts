/**
 * Seeds a development publication with sample content.
 *
 *   npm run db:seed
 *
 * Re-running replaces the "main" publication and everything in it. Set
 * SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to also create a platform-owner
 * account you can sign in with.
 *
 * All copy and images are placeholders: fictional brands, abstract artwork,
 * nothing explicit.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
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

function longform(topic: string): RichTextDoc {
  return {
    type: "doc",
    content: [
      p(`This is placeholder copy for ${topic}. It stands in for the finished piece so the layout, typography and reading rhythm can be judged with realistic length.`),
      p("Editorial pages are designed to be read, not skimmed: generous measure, clear hierarchy and room for images and quotes to breathe. Real articles will replace this text before launch."),
      h2("Why it matters"),
      p("A second section shows how subheadings break up longer reads. Good features mix reporting, interviews and analysis, and the template needs to carry all three without feeling cramped on a phone."),
      quote("The best stories here should feel like they belong in a magazine, not a feed.", "Placeholder pull quote"),
      p("Lists and tables are supported too, for buying guides, comparisons and rankings."),
      {
        type: "bulletList",
        content: ["Clear, scannable structure", "Fast on mobile connections", "Room for affiliate and ad placements without clutter"].map(
          (x) => ({ type: "listItem", content: [p(x)] }),
        ),
      },
      h2("What comes next"),
      p("The closing section wraps up the piece and points readers towards related stories, which appear automatically underneath."),
    ],
  };
}

type Item = {
  type: "article" | "review" | "news";
  title: string;
  standfirst: string;
  category: string;
  tags: string[];
  author: number;
  daysAgo: number;
  image: number;
  featured?: boolean;
  review?: { score: number; pros: string[]; cons: string[]; verdict: string; pricing: string };
};

const CATEGORIES = [
  { name: "Culture", slug: "culture", image: 3 },
  { name: "Industry", slug: "industry", image: 6 },
  { name: "Creators", slug: "creators", image: 9 },
  { name: "Tech", slug: "tech", image: 12 },
  { name: "Wellness", slug: "wellness", image: 4 },
  { name: "Style", slug: "style", image: 13 },
];

const AUTHORS = [
  { name: "Alex Mercer", slug: "alex-mercer", role: "Features Editor" },
  { name: "Sam Okafor", slug: "sam-okafor", role: "Reviews Editor" },
  { name: "Jo Lindqvist", slug: "jo-lindqvist", role: "News Reporter" },
];

const ITEMS: Item[] = [
  { type: "article", title: "The new auteurs: how independent creators rewrote the rules", standfirst: "A generation of self-made producers has turned a studio business into a creator economy. Placeholder feature.", category: "creators", tags: ["creator economy", "independents"], author: 0, daysAgo: 0, image: 1, featured: true },
  { type: "article", title: "Inside the studio betting everything on ethical production", standfirst: "Consent-first sets, fair pay and transparent contracts: can doing it properly also be good business?", category: "industry", tags: ["ethics", "studios"], author: 0, daysAgo: 1, image: 2 },
  { type: "article", title: "Age checks are coming for the whole internet", standfirst: "New laws from London to Louisiana are changing how adult sites — and everyone else — verify who's visiting.", category: "tech", tags: ["regulation", "privacy"], author: 2, daysAgo: 2, image: 6, featured: true },
  { type: "article", title: "Paywalls, platforms and the creator middle class", standfirst: "Subscription sites made a few stars rich. What about everyone else?", category: "creators", tags: ["creator economy"], author: 0, daysAgo: 3, image: 9 },
  { type: "article", title: "The quiet return of the erotic novel", standfirst: "Publishers can't print romance fast enough. A look at the books, the readers and the backlash.", category: "culture", tags: ["books"], author: 0, daysAgo: 5, image: 3 },
  { type: "article", title: "What good sex education looks like in 2026", standfirst: "Educators on the gaps young adults still fall through, and the resources that actually help.", category: "wellness", tags: ["education"], author: 2, daysAgo: 6, image: 4 },
  { type: "article", title: "Lingerie's slow-fashion moment", standfirst: "Small labels are swapping fast drops for made-to-last design. Placeholder style story.", category: "style", tags: ["fashion"], author: 0, daysAgo: 8, image: 13 },
  { type: "review", title: "Lumen review: a subscription platform that respects its creators", standfirst: "Clean design, fair splits and the best discovery tools we've tested. Fictional platform, placeholder review.", category: "tech", tags: ["platforms"], author: 1, daysAgo: 1, image: 5, featured: true, review: { score: 8.6, pros: ["Generous creator revenue share", "Excellent search and discovery", "Strong privacy controls"], cons: ["Smaller catalogue than rivals", "No offline viewing"], verdict: "The platform to beat for anyone who cares where their money goes.", pricing: "From $9.99/month" } },
  { type: "review", title: "Velvet Room review: premium, polished — and pricey", standfirst: "Gorgeous production values with a price tag to match. Fictional studio, placeholder review.", category: "industry", tags: ["studios"], author: 1, daysAgo: 4, image: 7, review: { score: 7.8, pros: ["Cinematic production", "Regular weekly releases"], cons: ["Expensive annual plan", "Clunky mobile site"], verdict: "Worth it if production value is your priority.", pricing: "$24.99/month" } },
  { type: "review", title: "Afterhours+ review: big library, small ambitions", standfirst: "Plenty to watch, little that surprises. Fictional service, placeholder review.", category: "tech", tags: ["platforms"], author: 1, daysAgo: 9, image: 10, review: { score: 6.4, pros: ["Huge back catalogue", "Low price"], cons: ["Dated interface", "Aggressive upsells"], verdict: "Fine for browsing, hard to love.", pricing: "$7.99/month" } },
  { type: "review", title: "Halcyon review: the wellness app that takes intimacy seriously", standfirst: "Guided audio and couples exercises, done with real care. Fictional app, placeholder review.", category: "wellness", tags: ["apps"], author: 1, daysAgo: 12, image: 8, review: { score: 8.1, pros: ["Expert-led content", "Thoughtful onboarding"], cons: ["Limited free tier"], verdict: "A rare app in this space that feels genuinely helpful.", pricing: "Free; premium $59.99/year" } },
  { type: "news", title: "Awards shortlist announced for 2027 ceremony", standfirst: "Independent creators dominate this year's nominations. Placeholder news story.", category: "industry", tags: ["awards"], author: 2, daysAgo: 0, image: 11 },
  { type: "news", title: "Payment processor tightens rules for adult merchants", standfirst: "New verification requirements take effect next quarter. Placeholder news story.", category: "industry", tags: ["payments", "regulation"], author: 2, daysAgo: 1, image: 14 },
  { type: "news", title: "Survey: most adults now use privacy tools when browsing", standfirst: "VPN and private-browsing use has doubled in two years. Placeholder news story.", category: "tech", tags: ["privacy"], author: 2, daysAgo: 2, image: 12 },
  { type: "news", title: "Berlin's adult film festival returns this autumn", standfirst: "The programme leans heavily into documentary this year. Placeholder news story.", category: "culture", tags: ["festivals"], author: 2, daysAgo: 3, image: 3 },
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export async function seed(db: Db) {
  await db.delete(t.publications).where(eq(t.publications.slug, SLUG));

  const [pub] = await db
    .insert(t.publications)
    .values({
      slug: SLUG,
      name: process.env.SEED_PUBLICATION_NAME ?? "Working Title",
      tagline: "Culture, creators and the business of desire",
      description: "An editorial magazine about adult culture, creators and industry. Placeholder description.",
      theme: { primaryColor: "#e4002b", fontPairing: "editorial" },
      settings: { commentsEnabled: true, ageGate: { enabled: false, provider: null }, locale: "en-GB" },
    })
    .returning();

  if (process.env.SEED_DOMAIN) {
    await db.insert(t.publicationDomains).values({ publicationId: pub.id, hostname: process.env.SEED_DOMAIN, isPrimary: true, kind: "custom" });
  }

  const images = await db
    .insert(t.media)
    .values(
      Array.from({ length: 14 }, (_, i) => ({
        publicationId: pub.id,
        storageKey: `seed/cover-${String(i + 1).padStart(2, "0")}.svg`,
        mimeType: "image/svg+xml",
        width: 1600,
        height: 1000,
        alt: "Abstract colour-field artwork (placeholder image)",
      })),
    )
    .returning({ id: t.media.id });

  const cats = await db
    .insert(t.categories)
    .values(CATEGORIES.map((c, i) => ({ publicationId: pub.id, name: c.name, slug: c.slug, position: i, imageId: images[c.image - 1].id })))
    .returning();
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));

  const authorRows = await db
    .insert(t.authors)
    .values(AUTHORS.map((a) => ({ ...a, publicationId: pub.id })))
    .returning();

  const tagNames = [...new Set(ITEMS.flatMap((i) => i.tags))];
  const tagRows = await db
    .insert(t.tags)
    .values(tagNames.map((name) => ({ publicationId: pub.id, name, slug: slugify(name) })))
    .returning();
  const tagByName = new Map(tagRows.map((x) => [x.name, x.id]));

  const now = Date.now();
  const contentIds: string[] = [];
  for (const [i, item] of ITEMS.entries()) {
    const body = longform(item.title);
    const [row] = await db
      .insert(t.contentItems)
      .values({
        publicationId: pub.id,
        type: item.type,
        status: "published",
        title: item.title,
        slug: slugify(item.title),
        standfirst: item.standfirst,
        body,
        bodyText: docToText(body),
        heroImageId: images[item.image - 1].id,
        categoryId: catBySlug.get(item.category),
        isFeatured: !!item.featured,
        publishedAt: new Date(now - item.daysAgo * 86_400_000 - i * 3_600_000),
      })
      .returning({ id: t.contentItems.id });
    contentIds.push(row.id);

    await db.insert(t.contentAuthors).values({ contentId: row.id, authorId: authorRows[item.author].id });
    await db.insert(t.contentTags).values(item.tags.map((name) => ({ contentId: row.id, tagId: tagByName.get(name)! })));
    if (item.review) {
      await db.insert(t.reviewDetails).values({
        contentId: row.id,
        score: item.review.score.toFixed(1),
        pros: item.review.pros,
        cons: item.review.cons,
        verdict: item.review.verdict,
        pricing: item.review.pricing,
        reviewedAt: new Date(now - item.daysAgo * 86_400_000).toISOString().slice(0, 10),
      });
    }
  }

  // A draft and a future-dated item, which must never appear publicly.
  await db.insert(t.contentItems).values([
    { publicationId: pub.id, type: "article", status: "draft", title: "Unpublished draft", slug: "unpublished-draft" },
    {
      publicationId: pub.id,
      type: "article",
      status: "published",
      title: "Embargoed story",
      slug: "embargoed-story",
      publishedAt: new Date(now + 7 * 86_400_000),
    },
  ]);

  // Some view counts so "Trending" has data.
  const today = new Date().toISOString().slice(0, 10);
  await db.insert(t.contentDailyStats).values(
    [3, 7, 11, 1, 12].map((idx, rank) => ({ publicationId: pub.id, contentId: contentIds[idx], day: today, views: 1000 - rank * 150 })),
  );

  const kinds: (typeof t.homepageSections.$inferInsert)["kind"][] = [
    "hero",
    "latest",
    "trending",
    "featured_reviews",
    "editors_picks",
    "featured_videos",
    "categories",
    "latest_news",
    "newsletter",
  ];
  const sections = await db
    .insert(t.homepageSections)
    .values(kinds.map((kind, position) => ({ publicationId: pub.id, kind, position, enabled: kind !== "newsletter" })))
    .returning();
  const picks = sections.find((s) => s.kind === "editors_picks")!;
  await db.insert(t.homepageSectionItems).values(
    [4, 5, 6, 10].map((idx, position) => ({ sectionId: picks.id, contentId: contentIds[idx], position })),
  );

  // Example ad slots: present but switched off until real code is pasted in.
  await db.insert(t.adPlacements).values(
    (["header_leaderboard", "in_content", "sidebar", "between_grid", "footer"] as const).map((slot) => ({
      publicationId: pub.id,
      slot,
      name: slot.replace(/_/g, " "),
    })),
  );

  return { publicationId: pub.id, contentIds };
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
  seed(db)
    .then(async ({ publicationId, contentIds }) => {
      await createAdmin(db, publicationId);
      console.log(`Seeded publication "${SLUG}" with ${contentIds.length} published items.`);
    })
    .finally(close);
}
