import { NextResponse, type NextRequest } from "next/server";
import { hostToSegment } from "@/lib/host-segment";

/**
 * Multi-tenant routing: every page request is rewritten internally from
 * `/path` to `/<host>/path`, so pages under `app/[site]` know which
 * publication they are rendering and ISR caches each site separately.
 * Visitors never see the host segment in the URL.
 */
export function proxy(request: NextRequest) {
  // Hostnames (with optional port) only; rejects anything that could
  // smuggle extra path segments into the rewrite.
  const segment = hostToSegment(request.headers.get("host") ?? "");
  if (!segment) return new NextResponse("Bad Host header", { status: 400 });

  const url = request.nextUrl.clone();
  url.pathname = `/${segment}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip API routes (they read the Host header themselves), build assets,
  // and files served straight from /public.
  matcher: ["/((?!api/|_next/|media/|favicon.ico).*)"],
};
