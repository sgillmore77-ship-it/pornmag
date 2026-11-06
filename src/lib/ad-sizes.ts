import type { AdSlotName as Slot } from "@/data/ads";

/** Reserved sizes per slot (desktop, mobile), so ads never shift the layout. */
export const AD_SIZES: Record<Slot, { name: string; d: [number, number]; m: [number, number] }> = {
  header_leaderboard: { name: "Header leaderboard", d: [728, 90], m: [320, 50] },
  sidebar: { name: "Sidebar", d: [300, 600], m: [300, 250] },
  in_content: { name: "In-content", d: [300, 250], m: [300, 250] },
  between_grid: { name: "Between-grid", d: [970, 90], m: [320, 100] },
  footer: { name: "Footer billboard", d: [970, 250], m: [300, 250] },
};
