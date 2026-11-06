import { PageHead } from "@/components/admin/bits";
import { AdsManager } from "@/components/admin/ads-manager";
import { listAdsAdmin } from "@/data/admin/ads";
import { requireAdminPage } from "@/lib/admin";
import { isoDay, shiftDay } from "@/lib/format";

export default async function AdsPage() {
  const a = await requireAdminPage("publication.manage");
  const tz = a.ctx.publication.settings.timeZone ?? "Europe/London";
  const since = shiftDay(isoDay(new Date(), tz), -29);
  const rows = await listAdsAdmin(a.db, a.ctx.site, since);
  const st = a.ctx.publication.settings;
  return (
    <>
      <PageHead title="Ads" sub="Ad network code and directly sold banners. Every spot has a fixed size, so ads never push the page around, and ads only load once a reader scrolls near them." />
      <AdsManager
        settings={{ previewPlaceholders: !!st.ads?.previewPlaceholders, adsTxt: st.ads?.adsTxt ?? "", cloudflareToken: st.analytics?.cloudflareToken ?? "" }}
        rows={rows.map((r) => ({
          id: r.id,
          slot: r.slot,
          name: r.name,
          kind: r.kind,
          code: r.code,
          image: r.imageId && r.storageKey ? { id: r.imageId, storageKey: r.storageKey } : null,
          clickUrl: r.clickUrl,
          altText: r.altText,
          advertiser: r.advertiser,
          enabled: r.enabled,
          devices: r.devices,
          weight: r.weight,
          startsAt: r.startsAt?.toISOString() ?? null,
          endsAt: r.endsAt?.toISOString() ?? null,
          impressions: r.impressions,
          clicks: r.clicks,
        }))}
      />
    </>
  );
}
