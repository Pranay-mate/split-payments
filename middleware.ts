import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *   - _next (assets)
     *   - api/trpc, api/auth (handled separately)
     *   - static files (favicon, manifest, sw.js, icons)
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon|apple-icon|.*\\.png$|.*\\.svg$|.*\\.jpg$).*)",
  ],
};
