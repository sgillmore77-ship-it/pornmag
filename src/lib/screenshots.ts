/**
 * Partner feeds (TubeCorporate and similar) give each video a folder of
 * screenshots named 1.jpg, 2.jpg … under a size folder such as
 * ".../288x162/". These helpers work out the other frames and the same frame
 * at larger sizes, which partners often have but don't list.
 */
export type Shot = { base: string; width: number; height: number; n: number; ext: string };

const SHOT = /^(https:\/\/[^?#]+\/)(\d{2,4})x(\d{2,4})\/(\d{1,3})(\.(?:jpe?g|webp|png))$/i;

export function parseShot(url: string | null | undefined): Shot | null {
  const m = url ? SHOT.exec(url) : null;
  return m ? { base: m[1], width: Number(m[2]), height: Number(m[3]), n: Number(m[4]), ext: m[5] } : null;
}

export function shotUrl(s: Shot, n = s.n, size = `${s.width}x${s.height}`): string {
  return `${s.base}${size}/${n}${s.ext}`;
}

/** The video's other frames at the feed's size: 1 … count. */
export function frameUrls(url: string | null | undefined, count = 20): string[] {
  const s = parseShot(url);
  if (!s) return url ? [url] : [];
  return Array.from({ length: count }, (_, i) => shotUrl(s, i + 1));
}

/** 16:9 sizes partners commonly keep, biggest first. */
const SIZES: [number, number][] = [
  [1920, 1080], [1280, 720], [960, 540], [854, 480], [800, 450], [640, 360], [576, 324], [480, 270], [432, 243], [400, 225], [320, 180],
];

/** The same frame at sizes bigger than the one in the feed, biggest first. */
export function largerSizes(url: string): string[] {
  const s = parseShot(url);
  if (!s) return [];
  return SIZES.filter(([w]) => w > s.width).map(([w, h]) => shotUrl(s, s.n, `${w}x${h}`));
}
