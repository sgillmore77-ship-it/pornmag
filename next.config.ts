import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Pages use ISR with on-demand revalidation (see docs/ARCHITECTURE.md).
  cacheComponents: false,
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  poweredByHeader: false,
  // Same as public/_headers, for `next start` and local dev.
  async headers() {
    return [{ source: "/fonts/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Gives `next dev` access to Cloudflare bindings (Hyperdrive, R2) from
// wrangler.jsonc when they are configured. Harmless when they are not.
if (process.env.NODE_ENV === "development" && process.env.CF_DEV_BINDINGS === "1") {
  initOpenNextCloudflareForDev();
}
