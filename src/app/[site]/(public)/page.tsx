import { JsonLd } from "@/components/json-ld";
import { FeedSection } from "@/components/mag/sections-feed";
import { IssueSection } from "@/components/mag/sections-issue";
import { getDb } from "@/db/client";
import { getHomeBanner, getHomepage } from "@/data/homepage";
import { Media } from "@/components/mag/media";
import { getSiteContext } from "@/lib/site-context";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { layoutOf } from "@/lib/theme";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[site]">) {
  const ctx = await getSiteContext((await params).site);
  return {
    title: { absolute: ctx.publication.tagline ? `${ctx.publication.name} — ${ctx.publication.tagline}` : ctx.publication.name },
    alternates: { canonical: "/" },
  };
}

export default async function HomePage({ params }: PageProps<"/[site]">) {
  const ctx = await getSiteContext((await params).site);
  const db = await getDb();
  const [sections, banner] = await Promise.all([
    getHomepage(db, ctx.site),
    getHomeBanner(db, ctx.site, ctx.publication.settings.homeBanner),
  ]);
  const Section = layoutOf(ctx.publication.theme) === "feed" ? FeedSection : IssueSection;

  return (
    <>
      <JsonLd data={[organizationJsonLd(ctx), websiteJsonLd(ctx)]} />
      <h1 className="sr-only">{ctx.publication.name}</h1>
      {banner && <HomeBannerView banner={banner} />}
      {sections.length === 0 ? (
        <div className="wrap sec" style={{ textAlign: "center", paddingBlock: 96 }}>
          <p className="disp" style={{ fontSize: "calc(36px * var(--dsz))" }}>
            Nothing published yet.
          </p>
          <p className="dek" style={{ marginTop: 12 }}>
            Stories appear here as soon as they&apos;re published.
          </p>
        </div>
      ) : (
        <div className="stack">
          {sections.map((section, i) => (
            <Section key={section.id} section={section} ctx={ctx} first={i === 0} />
          ))}
        </div>
      )}
    </>
  );
}

/** The banner graphic from Admin → Settings, shown at its own proportions. */
function HomeBannerView({ banner }: { banner: NonNullable<Awaited<ReturnType<typeof getHomeBanner>>> }) {
  const { image, href } = banner;
  const ratio = image.width && image.height ? `${image.width}/${image.height}` : "1200/520";
  const art = <Media image={image} ratio={ratio} sizes="(min-width: 1400px) 1320px, 100vw" priority label="none" />;
  const external = !!href && /^https:\/\//.test(href);
  return (
    <div className="wrap home-banner">
      {href ? (
        <a href={href} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
          {art}
        </a>
      ) : (
        art
      )}
    </div>
  );
}
