import { EmptyHomepage, HomepageSection } from "@/components/homepage-sections";
import { JsonLd } from "@/components/json-ld";
import { getDb } from "@/db/client";
import { getHomepage } from "@/data/homepage";
import { getSiteContext } from "@/lib/site-context";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

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
  const sections = await getHomepage(await getDb(), ctx.site);

  return (
    <>
      <JsonLd data={[organizationJsonLd(ctx), websiteJsonLd(ctx)]} />
      <h1 className="sr-only">{ctx.publication.name}</h1>
      {sections.length === 0 ? (
        <EmptyHomepage />
      ) : (
        <div className="space-y-16 pb-8 sm:space-y-24">
          {sections.map((section, i) => (
            <HomepageSection key={section.id} section={section} isFirst={i === 0} />
          ))}
        </div>
      )}
    </>
  );
}
