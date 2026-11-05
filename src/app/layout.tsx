import type { Viewport } from "next";
// Self-hosted fonts for all three type pairings. Each file only declares
// @font-face rules; browsers download just the faces a page actually uses.
import "@fontsource-variable/bodoni-moda/opsz.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/anton/400.css";
import "@fontsource/archivo/400.css";
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/schibsted-grotesk/600.css";
import "@fontsource/schibsted-grotesk/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import "./magazine.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1013" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The age-gate boot script sets data-age-ok before hydration.
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
