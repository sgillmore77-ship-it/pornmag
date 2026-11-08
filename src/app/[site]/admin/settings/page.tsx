import { PageHead } from "@/components/admin/bits";
import { SettingsForm } from "@/components/admin/settings-form";
import { and, eq } from "drizzle-orm";
import { media } from "@/db/schema";
import { requireAdminPage } from "@/lib/admin";
import { FONT_PAIRINGS, layoutOf } from "@/lib/theme";

export default async function SettingsPage() {
  const a = await requireAdminPage("publication.manage");
  const p = a.ctx.publication;
  const bannerId = p.settings.homeBanner?.mediaId;
  const [banner] = bannerId
    ? await a.db
        .select({ id: media.id, storageKey: media.storageKey, alt: media.alt, width: media.width, height: media.height })
        .from(media)
        .where(and(eq(media.id, bannerId), eq(media.publicationId, p.id)))
        .limit(1)
    : [];
  return (
    <>
      <PageHead title="Settings" sub="Branding, layout and site behaviour." />
      <SettingsForm
        pairings={Object.entries(FONT_PAIRINGS).map(([key, v]) => ({ key, label: `${v.label}`, sample: v.fd }))}
        initial={{
          name: p.name,
          tagline: p.tagline ?? "",
          description: p.description ?? "",
          primaryColor: p.theme.primaryColor,
          fontPairing: p.theme.fontPairing in FONT_PAIRINGS ? p.theme.fontPairing : "couture",
          layout: layoutOf(p.theme),
          mode: p.theme.mode ?? "system",
          issueLabel: p.settings.issueLabel ?? "",
          footerBlurb: p.settings.footerBlurb ?? "",
          ageGateEnabled: p.settings.ageGate.enabled,
          commentsEnabled: p.settings.commentsEnabled,
          commentModeration: p.settings.commentModeration ?? "first",
          timeZone: p.settings.timeZone ?? "Europe/London",
          videoHosts: (p.settings.videoHosts ?? []).join("\n"),
          nav: p.settings.nav ?? [],
          homeBanner: banner ?? null,
          homeBannerAlt: p.settings.homeBanner?.alt ?? "",
          homeBannerHref: p.settings.homeBanner?.href ?? "",
        }}
      />
    </>
  );
}
