import { z } from "zod";

const serverSchema = z.object({
  /**
   * Postgres connection string. Validation is lenient (just non-empty)
   * because Postgres URLs with special chars in the password don't always
   * parse cleanly with z.url(). postgres-js will fail with a clear error
   * at connection time if the URL is actually malformed.
   */
  DATABASE_URL: z.string().min(10).optional(),
  /** Supabase service-role key — never exposed to the browser. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const clientSchema = z.object({
  // Lenient string check — Supabase project URLs are well-formed by Supabase,
  // but z.url() fails at build time if the env var has any subtle formatting
  // issue. postgres-js / supabase-js handle real validation at runtime.
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(10),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const _client = clientSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!_client.success) {
  // Don't crash builds during static analysis if envs aren't loaded — surface
  // a friendly hint at runtime instead.
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[env] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Auth + data features will not work.",
    );
  }
}

export const env = {
  ..._client.success ? _client.data : { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
  ...(typeof window === "undefined"
    ? serverSchema.parse({
        DATABASE_URL: process.env.DATABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        NODE_ENV: process.env.NODE_ENV,
      })
    : { NODE_ENV: "production" as const }),
};

export const isSupabaseConfigured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
