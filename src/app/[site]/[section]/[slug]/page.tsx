import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentCard } from "@/components/content-card";
import { JsonLd } from "@/components/json-ld";
import { MediaImage } from "@/components/media-image";
import { RichText } from "@/components/rich-text";
import { ShareBar } from "@/components/share-bar";
import { getDb } from "@/db/client";
import { getPublishedBySlug, listRelated, SECTION_FOR_TYPE, TYPE_FOR_SECTION, contentPath } from "@/data/content";
import { formatDate } from "@/lib/format";
import { absoluteUrl, articleJsonLd, breadcrumbJsonLd, contentMetadata } from "@/lib/seo";
import { getSiteContext } from "@/lib/site-context";

export const revalidate = 300;

// Rendered on first request, then cached and refreshed (ISR).
export async function generateStaticParams() {
  return [];
}

const SECTION_NAMES: Record<string, string> = { features: "Features", reviews: "Reviews", videos: "Videos", news: "News" };

async function load(params: PageProps<"/[site]/[section]/[slug]">["params"]) {
  const { site, section, slug } = await params;
  const type = TYPE_FOR_SECTION[section];
  if (!type) notFound();
  const ctx = await getSiteContext(site);
  const item = await getPublishedBySlug(await getDb(), ctx.site, type, decodeURIComponent(slug));
  if (!item) notFound();
  return { ctx, item, section };
}

export async function generateMetadata({ params }: PageProps<"/[site]/[section]/[slug]">) {
  const { ctx, item } = await load(params);
  return contentMetadata(ctx, item);
}

export default async function ContentPage({ params }: PageProps<"/[site]/[section]/[slug]">) {
  const { ctx, item, section } = await load(params);
  const related = await listRelated(await getDb(), ctx.site, item.id, 4);
  const url = absoluteUrl(ctx, contentPath(item));
  const crumbs = [
    { name: ctx.publication.name, path: "/" },
    { name: SECTION_NAMES[section], path: `/${SECTION_FOR_TYPE[item.type]}` },
    { name: item.title, path: contentPath(item) },
  ];

  return (
    <>
      <JsonLd data={[articleJsonLd(ctx, item), breadcrumbJsonLd(ctx, crumbs)]} />
      <article>
        <header className="mx-auto max-w-4xl px-4 pt-10 text-center sm:px-6 sm:pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
            {item.category?.name ?? SECTION_NAMES[section]}
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.05] font-bold text-balance sm:text-6xl">{item.title}</h1>
          {item.standfirst && (
            <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600 sm:text-xl dark:text-neutral-300">{item.standfirst}</p>
          )}
          <p className="mt-6 text-sm text-neutral-500">
            {item.authorDetails.length > 0 && (
              <>
                By <span className="font-semibold text-foreground">{item.authorDetails.map((a) => a.name).join(" & ")}</span> ·{" "}
              </>
            )}
            <time dateTime={item.publishedAt.toISOString()}>{formatDate(item.publishedAt)}</time>
          </p>
        </header>

        {item.heroImage && (
          <figure className="mx-auto mt-10 max-w-6xl sm:px-6">
            <MediaImage image={item.heroImage} ratio={16 / 9} sizes="(min-width: 1152px) 1152px, 100vw" priority />
            {(item.heroImage.caption || item.heroImage.credit) && (
              <figcaption className="mt-2 px-4 text-sm text-neutral-500 sm:px-0">
                {item.heroImage.caption} {item.heroImage.credit && <span className="uppercase tracking-wide">{item.heroImage.credit}</span>}
              </figcaption>
            )}
          </figure>
        )}

        <div className="mx-auto mt-10 grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_minmax(0,720px)_1fr]">
          <aside className="lg:sticky lg:top-8 lg:self-start" aria-label="Share">
            <ShareBar url={url} title={item.title} />
          </aside>
          <div>
            <RichText doc={item.body} />
            {item.tags.length > 0 && (
              <ul aria-label="Tags" className="mt-12 flex flex-wrap gap-2">
                {item.tags.map((t) => (
                  <li key={t.id} className="border border-[var(--rule)] px-3 py-1 text-sm">
                    {t.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="related" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
          <h2 id="related" className="mb-6 font-display text-2xl font-bold">
            More to read
          </h2>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <ContentCard key={r.id} item={r} />
            ))}
          </div>
        </section>
      )}

      <nav aria-label="Breadcrumb" className="mx-auto mt-16 max-w-7xl px-4 text-sm text-neutral-500 sm:px-6">
        <ol className="flex flex-wrap gap-2">
          {crumbs.slice(0, -1).map((c) => (
            <li key={c.path}>
              <Link href={c.path} className="hover:underline">
                {c.name}
              </Link>{" "}
              /
            </li>
          ))}
          <li aria-current="page" className="text-foreground">
            {item.title}
          </li>
        </ol>
      </nav>
    </>
  );
}
