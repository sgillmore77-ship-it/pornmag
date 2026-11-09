import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { ContactForm } from "@/components/mag/contact-form";
import { RichText } from "@/components/rich-text";
import type { SitePage } from "@/data/pages";
import { breadcrumbJsonLd } from "@/lib/seo";
import type { SiteContext } from "@/lib/site-context";

export function sitePageMetadata(page: SitePage): Metadata {
  return {
    title: page.seoTitle || page.title,
    description: page.metaDescription || page.standfirst || undefined,
    alternates: { canonical: `/${page.slug}` },
  };
}

/** A standalone page such as About, Contact or Terms (Admin → Pages). */
export function SitePageView({ ctx, page }: { ctx: SiteContext; page: SitePage }) {
  return (
    <article>
      <JsonLd
        data={[
          breadcrumbJsonLd(ctx, [
            { name: ctx.publication.name, path: "/" },
            { name: page.title, path: `/${page.slug}` },
          ]),
        ]}
      />
      <header className="wrap" style={{ paddingTop: "clamp(28px, 4.4cqw, 72px)", maxWidth: 820, marginInline: "auto" }}>
        <h1 className="disp" style={{ fontSize: "calc(clamp(40px, 5.4cqw, 80px) * var(--dsz))" }}>{page.title}</h1>
        {page.standfirst && (
          <p style={{ marginTop: 18, fontSize: "clamp(18px, 1.5cqw, 21px)", lineHeight: 1.55, color: "var(--muted)", textWrap: "pretty" }}>{page.standfirst}</p>
        )}
      </header>
      <div className="wrap" style={{ maxWidth: 820, marginInline: "auto", marginTop: "clamp(24px, 3cqw, 40px)", paddingBottom: "clamp(48px, 6cqw, 96px)" }}>
        <RichText doc={page.body} videoHosts={ctx.publication.settings.videoHosts} />
        {page.contactTopic && (
          <section aria-labelledby="contact-form-h" style={{ marginTop: 40, borderTop: "2px solid var(--ink)", paddingTop: 24 }}>
            <h2 id="contact-form-h" className="disp" style={{ fontSize: "calc(clamp(24px, 2.4cqw, 32px) * var(--dsz))" }}>
              Send us a message
            </h2>
            <ContactForm defaultTopic={page.contactTopic} />
          </section>
        )}
      </div>
    </article>
  );
}
