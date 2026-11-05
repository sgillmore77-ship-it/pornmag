import { AGE_GATE_BOOT, AgeGate } from "@/components/mag/age-gate";
import { SiteFooter, SiteHeader } from "@/components/mag/chrome";
import { getSiteContext } from "@/lib/site-context";

export default async function PublicLayout({ children, params }: LayoutProps<"/[site]">) {
  const ctx = await getSiteContext((await params).site);
  return (
    <>
      {ctx.publication.settings.ageGate.enabled && (
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
    </>
  );
}
