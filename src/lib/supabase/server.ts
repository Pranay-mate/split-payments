/**
 * Server-side Supabase client for Next.js App Router. Reads + writes cookies
 * via the request/response interface so auth state survives across requests.
 *
 * Use from Server Components, Route Handlers, and Server Actions.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll() is called from a Server Component. The cookies will
            // be refreshed by middleware on the next request anyway.
          }
        },
      },
    },
  );
}
