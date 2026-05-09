/**
 * Auth-aware middleware helper. Refreshes the user's auth token on every
 * request so server components see a current session.
 *
 * Wire it up via /middleware.ts at the project root.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          for (const { name, value } of toSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshing user state — runs on every request that hits middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auto-redirect signed-in users away from the marketing landing page —
  // returning users shouldn't have to click "Open app" to reach work
  // they've done before. Only the literal "/" path triggers this; the
  // /features, /about etc routes still render so users can revisit them.
  if (user && request.nextUrl.pathname === "/") {
    const dest = request.nextUrl.clone();
    dest.pathname = "/app/groups";
    return NextResponse.redirect(dest);
  }

  return response;
}
