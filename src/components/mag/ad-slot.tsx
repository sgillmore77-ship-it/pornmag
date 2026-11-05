import type { AdSlot as Slot, SiteContext } from "@/lib/site-context";

/** Reserved sizes per slot (desktop, mobile), so ads never shift the layout. */
const SIZES: Record<Slot, { name: string; d: [number, number]; m: [number, number] }> = {
  header_leaderboard: { name: "Header leaderboard", d: [728, 90], m: [320, 50] },
  sidebar: { name: "Sidebar", d: [300, 600], m: [300, 250] },
  in_content: { name: "In-content", d: [300, 250], m: [300, 250] },
  between_grid: { name: "Between-grid", d: [970, 90], m: [320, 100] },
  footer: { name: "Footer billboard", d: [970, 250], m: [300, 250] },
};

/**
 * A labelled advertising slot. Renders only when the publication has the
 * placement switched on, or when ad previews are on (labelled empty boxes for
 * reviewing layouts). Loading the actual ad code arrives in Phase 1E.
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
  return (
    <div className={`ad ${align === "left" ? "ad-left" : ""}`} aria-label="Advertisement" role="complementary">
      {!hideLabel && <span className="ad-label">Advertisement</span>}
      <div
        className="ad-box"
        data-slot={slot}
        data-mw={responsive ? "" : undefined}
        style={{ width: w, height: h, ["--mw" as string]: `${mw}px`, ["--mh" as string]: `${mh}px` }}
      >
        {ctx.ads.preview && (
          <>
            <span className="d">{`${s.name} · ${w} × ${h}`}</span>
            <span className="m">{`${s.name} · ${mw} × ${mh}`}</span>
          </>
        )}
      </div>
    </div>
  );
}
