import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { SECTION_FOR_TYPE } from "@/data/content";
import { getSiteContext } from "@/lib/site-context";
import { themeStyle } from "@/lib/theme";

export async function generateMetadata({ params }: LayoutProps<"/[site]">): Promise<Metadata> {
  const ctx = await getSiteContext((await params).site);
  return {
    metadataBase: new URL(ctx.origin),
    title: { default: ctx.publication.name, template: `%s · ${ctx.publication.name}` },
    description: ctx.publication.description ?? ctx.publication.tagline ?? undefined,
    openGraph: { siteName: ctx.publication.name, type: "website" },
  };
}

const NAV = [
  { name: "Features", href: `/${SECTION_FOR_TYPE.article}` },
  { name: "Reviews", href: `/${SECTION_FOR_TYPE.review}` },
  { name: "Videos", href: `/${SECTION_FOR_TYPE.video}` },
  { name: "News", href: `/${SECTION_FOR_TYPE.news}` },
];

export default async function SiteLayout({ children, params }: LayoutProps<"/[site]">) {
  const ctx = await getSiteContext((await params).site);
  return (
    <div style={themeStyle(ctx.publication.theme)} className="flex min-h-dvh flex-col bg-background font-sans text-foreground">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-[var(--brand)] focus:px-4 focus:py-2 focus:text-[var(--brand-contrast)]">
        Skip to content
      </a>
      <SiteHeader name={ctx.publication.name} nav={NAV} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter name={ctx.publication.name} />
    </div>
  );
}

// Sites are rendered on first request and then cached (ISR), per host.
export async function generateStaticParams() {
  return [];
}
