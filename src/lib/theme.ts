import type { CSSProperties } from "react";
import type { PublicationTheme } from "@/db/schema";

/**
 * Controlled typography pairings publishers choose from. No custom fonts or
 * CSS in the first version, so every site stays fast and on-system.
 * Placeholder stacks until the Claude Design system defines the real faces.
 */
export const FONT_PAIRINGS = {
  editorial: {
    label: "Editorial serif",
    display: 'Georgia, "Times New Roman", serif',
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  grotesk: {
    label: "Bold grotesk",
    display: '"Helvetica Neue", Arial, ui-sans-serif, system-ui, sans-serif',
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  classic: {
    label: "Classic serif",
    display: 'Georgia, "Times New Roman", serif',
    body: 'Georgia, "Times New Roman", serif',
  },
} as const;

export type FontPairing = keyof typeof FONT_PAIRINGS;

const HEX = /^#[0-9a-fA-F]{6}$/;
const FALLBACK_PRIMARY = "#e4002b";

/** Picks black or white text for legibility on the brand colour. */
function readableOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.4 ? "#0a0a0a" : "#ffffff";
}

/** CSS variables for one publication. Values are validated, never raw input. */
export function themeStyle(theme: PublicationTheme): CSSProperties {
  const primary = HEX.test(theme.primaryColor) ? theme.primaryColor : FALLBACK_PRIMARY;
  const fonts = FONT_PAIRINGS[theme.fontPairing as FontPairing] ?? FONT_PAIRINGS.editorial;
  return {
    "--brand": primary,
    "--brand-contrast": readableOn(primary),
    "--pub-display": fonts.display,
    "--pub-body": fonts.body,
  } as CSSProperties;
}
