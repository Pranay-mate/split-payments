/**
 * OAuth callback handler. Supabase redirects here after Google sign-in
 * (or magic-link) with a `code` param. We exchange it for a session,
 * Supabase sets the session cookies, then we redirect to `next`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app/groups";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Redirect URL is validated to be a path on our site to prevent
      // open-redirect attacks.
      const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app/groups";
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    return NextResponse.redirect(
      `${origin}/app/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/app/login?error=missing-code`);
}
