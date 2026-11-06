import type { Metadata } from "next";
import { getSiteContext } from "@/lib/site-context";
import { preload } from "react-dom";
import { FONT_PAIRINGS, FONT_PRELOADS, layoutOf, MONO_PRELOAD, themeStyle, type FontPairing } from "@/lib/theme";

export async function generateMetadata({ params }: LayoutProps<"/[site]">): Promise<Metadata> {
  const ctx = await getSiteContext((await params).site);
  return {
    metadataBase: new URL(ctx.origin),
    title: { default: ctx.publication.name, template: `%s · ${ctx.publication.name}` },
    description: ctx.publication.description ?? ctx.publication.tagline ?? undefined,
    openGraph: { siteName: ctx.publication.name, type: "website" },
    other: { rating: "adult" },
  };
}

/** Applies the publication's theme. Public chrome lives in (public)/layout. */
export default async function SiteLayout({ children, params }: LayoutProps<"/[site]">) {
  const ctx = await getSiteContext((await params).site);
  const { theme } = ctx.publication;
  const pairing: FontPairing = theme.fontPairing in FONT_PAIRINGS ? (theme.fontPairing as FontPairing) : "couture";
  for (const href of [...FONT_PRELOADS[pairing], MONO_PRELOAD]) preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <div
      className={`site ${layoutOf(theme)}`}
      data-mode={theme.mode === "light" || theme.mode === "dark" ? theme.mode : "system"}
      style={themeStyle(theme)}
    >
      {children}
    </div>
  );
}

// Sites are rendered on first request and then cached (ISR), per host.
export async function generateStaticParams() {
  return [];
}
