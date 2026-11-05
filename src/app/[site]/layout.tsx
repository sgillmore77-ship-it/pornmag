import type { Metadata } from "next";
import { AGE_GATE_BOOT, AgeGate } from "@/components/mag/age-gate";
import { SiteFooter, SiteHeader } from "@/components/mag/chrome";
import { getSiteContext } from "@/lib/site-context";
import { layoutOf, themeStyle } from "@/lib/theme";

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

export default async function SiteLayout({ children, params }: LayoutProps<"/[site]">) {
  const ctx = await getSiteContext((await params).site);
  const { theme, settings } = ctx.publication;
  return (
    <div
      className={`site ${layoutOf(theme)}`}
      data-mode={theme.mode === "light" || theme.mode === "dark" ? theme.mode : "system"}
      style={themeStyle(theme)}
    >
      {settings.ageGate.enabled && (
        <>
          <script dangerouslySetInnerHTML={{ __html: AGE_GATE_BOOT }} />
          <AgeGate name={ctx.publication.name} />
        </>
      )}
      <a href="#main" className="skip">
        Skip to content
      </a>
      <SiteHeader ctx={ctx} />
      <main id="main" style={{ paddingBottom: "clamp(24px, 4cqw, 64px)" }}>
        {children}
      </main>
      <SiteFooter ctx={ctx} />
    </div>
  );
}

// Sites are rendered on first request and then cached (ISR), per host.
export async function generateStaticParams() {
  return [];
}
