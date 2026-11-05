import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// ISR pages are cached in R2 so every Worker isolate shares the same cache.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
