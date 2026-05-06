import { z } from "zod";

const serverSchema = z.object({
  /** Postgres connection string. Required for Drizzle migrations + server queries. */
  DATABASE_URL: z.string().url().optional(),
  /** Supabase service-role key — never exposed to the browser. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
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
