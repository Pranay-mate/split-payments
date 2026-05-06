/**
 * Browser Supabase client. Use this from Client Components only.
 * SSR'd routes should use the server client (./server.ts) which reads cookies.
 */

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
