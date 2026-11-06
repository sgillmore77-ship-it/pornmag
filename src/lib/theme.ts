import type { CSSProperties } from "react";
import type { PublicationTheme } from "@/db/schema";

/**
 * The three controlled type pairings from the design system. Publishers pick
 * one; no custom fonts or CSS, so every site stays fast and on-system.
 * Display sizes are multiplied by `dsz` so faces with different x-heights
 * stay balanced.
 */
export const FONT_PAIRINGS = {
  couture: {
    label: "Couture",
    fd: "'Bodoni Moda Variable', 'Bodoni Moda', Didot, serif",
    fb: "'Hanken Grotesk', system-ui, sans-serif",
    dw: "600",
    dt: "none",
    dls: "-0.015em",
    dlh: "1",
    dsz: "1",
  },
  poster: {
    label: "Poster",
    fd: "'Anton', Impact, sans-serif",
    fb: "'Archivo', system-ui, sans-serif",
    dw: "400",
    dt: "uppercase",
    dls: "0.005em",
    dlh: "0.98",
    dsz: "0.9",
  },
  literary: {
    label: "Literary",
    fd: "'Instrument Serif', Georgia, serif",
    fb: "'Schibsted Grotesk', system-ui, sans-serif",
    dw: "400",
    dt: "none",
    dls: "-0.01em",
    dlh: "1",
    dsz: "1.12",
  },
} as const;

export type FontPairing = keyof typeof FONT_PAIRINGS;

/**
 * The few font files every page of a pairing needs straight away (Latin,
 * display + body regular, and the mono used for labels). Preloading them
 * means text renders in the right face first time, without a visible swap.
 */
export const FONT_PRELOADS: Record<FontPairing, string[]> = {
  couture: ["/fonts/bodoni-moda-latin-opsz-normal.woff2", "/fonts/hanken-grotesk-latin-400-normal.woff2"],
  poster: ["/fonts/anton-latin-400-normal.woff2", "/fonts/archivo-latin-400-normal.woff2"],
  literary: ["/fonts/instrument-serif-latin-400-normal.woff2", "/fonts/schibsted-grotesk-latin-400-normal.woff2"],
};
export const MONO_PRELOAD = "/fonts/ibm-plex-mono-latin-400-normal.woff2";
export type Layout = "feed" | "issue";

const HEX = /^#[0-9a-fA-F]{6}$/;
export const DEFAULT_BRAND = "#7A1F3D";

export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function layoutOf(theme: PublicationTheme): Layout {
  return theme.layout === "feed" ? "feed" : "issue";
}

export function pairingOf(theme: PublicationTheme) {
  return FONT_PAIRINGS[theme.fontPairing as FontPairing] ?? FONT_PAIRINGS.couture;
}

/**
 * CSS variables for one publication, applied to the `.site` wrapper.
 * Values are validated here, never passed through from input.
 * Neutral colours and the light/dark choice live in magazine.css.
 */
export function themeStyle(theme: PublicationTheme): CSSProperties {
  const brand = HEX.test(theme.primaryColor) ? theme.primaryColor : DEFAULT_BRAND;
  const light = luminance(brand) > 0.36;
  const p = pairingOf(theme);
  return {
    "--brand": brand,
    "--on-brand": light ? "#121110" : "#FFFFFF",
    // Brand used as text on neutrals must reach 4.5:1 in each mode.
    "--brand-text-l": `color-mix(in oklch, ${brand} ${light ? 45 : 86}%, black)`,
    "--brand-text-d": light ? brand : `color-mix(in oklch, ${brand} 72%, white)`,
    "--fd": p.fd,
    "--fb": p.fb,
    "--dw": p.dw,
    "--dt": p.dt,
    "--dls": p.dls,
    "--dlh": p.dlh,
    "--dsz": p.dsz,
  } as CSSProperties;
}
