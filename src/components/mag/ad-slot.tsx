import type { AdSlot as Slot, SiteContext } from "@/lib/site-context";
import { AD_SIZES as SIZES } from "@/lib/ad-sizes";
import { AdFill } from "./ad-fill";


/**
 * A labelled advertising slot. Renders only when the publication has the
 * placement switched on, or when ad previews are on (labelled empty boxes for
 * reviewing layouts). The ad itself loads in the browser (see AdFill).
 */
export function AdSlot({
  slot,
  ctx,
  align = "center",
  hideLabel,
}: {
  slot: Slot;
  ctx: SiteContext;
  align?: "center" | "left";
  hideLabel?: boolean;
}) {
  if (!ctx.ads.slots.includes(slot)) return null;
  const s = SIZES[slot];
  const [w, h] = s.d;
  const [mw, mh] = s.m;
  const responsive = w !== mw || h !== mh;
  const creatives = ctx.ads.creatives[slot] ?? [];
  return (
    <div className={`ad ${align === "left" ? "ad-left" : ""}`} aria-label="Advertisement" role="complementary">
      {!hideLabel && <span className="ad-label">Advertisement</span>}
      <div
        className="ad-box"
        data-slot={slot}
        data-mw={responsive ? "" : undefined}
        style={{ width: w, height: h, ["--mw" as string]: `${mw}px`, ["--mh" as string]: `${mh}px` }}
      >
        {creatives.length > 0 ? (
          <AdFill creatives={creatives} width={w} height={h} mobileWidth={mw} mobileHeight={mh} />
        ) : ctx.ads.preview && (
          <>
            <span className="d">{`${s.name} · ${w} × ${h}`}</span>
            <span className="m">{`${s.name} · ${mw} × ${mh}`}</span>
          </>
        )}
      </div>
    </div>
  );
}
