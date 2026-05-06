import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Server-only Drizzle client. Lazy-initialised so importing this module
 * doesn't crash builds when DATABASE_URL is missing (e.g., during type
 * checking or if a route is rendered before envs are wired).
 *
 * Usage:
 *   import { db } from "@/lib/db";
 *   const groups = await db.select().from(groupsTable);
 */

const databaseUrl = process.env.DATABASE_URL;

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function createDb() {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local for local dev or Vercel env vars for production.",
    );
  }
  // postgres-js client with sane Supabase-friendly defaults.
  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // disable prepared statements when using Supabase pooler
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    if (!_db) _db = createDb();
    return Reflect.get(_db, prop);
  },
});

export * as schema from "./schema";
