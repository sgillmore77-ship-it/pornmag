import { AGE_GATE_BOOT, AgeGate } from "@/components/mag/age-gate";
import { SiteFooter, SiteHeader } from "@/components/mag/chrome";
import { PageView } from "@/components/mag/page-view";
import { getSiteContext } from "@/lib/site-context";

export default async function PublicLayout({ children, params }: LayoutProps<"/[site]">) {
  const ctx = await getSiteContext((await params).site);
  const token = ctx.publication.settings.analytics?.cloudflareToken;
  const cfToken = token && /^[a-f0-9]{32}$/i.test(token) ? token : null;
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
      <PageView />
      {cfToken && <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: cfToken })} />}
    </>
  );
}
