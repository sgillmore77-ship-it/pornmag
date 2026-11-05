import Link from "next/link";
import type { ResolvedSection } from "@/data/homepage";
import { ContentCard } from "./content-card";
import { MediaImage } from "./media-image";

function SectionHeading({ title, id }: { title: string; id: string }) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <h2 id={id} className="shrink-0 font-display text-2xl font-bold sm:text-3xl">
        {title}
      </h2>
      <span aria-hidden className="h-px flex-1 bg-[var(--rule)]" />
    </div>
  );
}

function Shell({ section, children, className = "" }: { section: ResolvedSection; children: React.ReactNode; className?: string }) {
  const headingId = `section-${section.id}`;
  return (
    <section aria-labelledby={headingId} className={`mx-auto max-w-7xl px-4 sm:px-6 ${className}`}>
      <SectionHeading title={section.title} id={headingId} />
      {children}
    </section>
  );
}

export function HomepageSection({ section, isFirst }: { section: ResolvedSection; isFirst: boolean }) {
  switch (section.kind) {
    case "hero": {
      const [lead] = section.items;
      return (
        <section aria-label={section.title} className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12">
          <ContentCard item={lead} variant="lead" headingLevel={2} priority={isFirst} />
        </section>
      );
    }

    case "latest": {
      const [first, ...rest] = section.items;
      return (
        <Shell section={section}>
          <div className="grid gap-x-8 gap-y-12 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ContentCard item={first} variant="lead" />
            </div>
            <div className="grid content-start gap-8 sm:grid-cols-2 lg:grid-cols-1">
              {rest.slice(0, 2).map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          </div>
          {rest.length > 2 && (
            <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {rest.slice(2).map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </Shell>
      );
    }

    case "trending":
    case "latest_news":
      return (
        <Shell section={section}>
          <ol className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-5">
            {section.items.map((item, i) => (
              <li key={item.id} className="flex gap-3 border-t border-[var(--rule)]">
                {section.kind === "trending" && (
                  <span aria-hidden className="pt-4 font-display text-3xl font-bold text-[var(--brand)]">
                    {i + 1}
                  </span>
                )}
                <ContentCard item={item} variant="list" />
              </li>
            ))}
          </ol>
        </Shell>
      );

    case "categories":
      return (
        <Shell section={section}>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {section.categories.map((cat) => (
              <li key={cat.id}>
                {/* Category pages arrive in Phase 1B; until then this is a label, not a link. */}
                <div className="group relative">
                  <MediaImage image={cat.image} ratio={4 / 5} sizes="(min-width: 1024px) 16vw, 50vw" />
                  <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 font-display text-lg font-bold text-white">
                    {cat.name}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Shell>
      );

    case "newsletter":
      return null;

    default:
      // featured_reviews, featured_videos, editors_picks
      return (
        <Shell section={section}>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {section.items.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        </Shell>
      );
  }
}

export function EmptyHomepage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="font-display text-3xl">Nothing published yet.</p>
      <p className="mt-3 text-neutral-500">
        Stories appear here as soon as they&apos;re published. <Link className="underline" href="/account">Sign in</Link>
      </p>
    </div>
  );
}
