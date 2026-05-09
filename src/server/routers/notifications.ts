import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";

const preferencesSchema = z
  .object({
    /** Daily reminder for unsettled balances older than 7 days. */
    balanceReminders: z.boolean().default(true),
    /** Heads-up when a category's monthly spend deviates >50% from its rolling 6-month avg. */
    spendingAnomalies: z.boolean().default(true),
  })
  .partial();

export const notificationsRouter = router({
  /** Returns the user's current subscription (if any) so the UI can show
   *  the right enable/disable state on settings. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, ctx.user.id));
    if (rows.length === 0) {
      return { subscribed: false, devices: 0, preferences: null as null };
    }
    let preferences: Record<string, unknown> = {};
    try {
      preferences = JSON.parse(rows[0].preferences);
    } catch {
      preferences = {};
    }
    return { subscribed: true, devices: rows.length, preferences };
  }),

  /** Save (upsert) a Web Push subscription for the current user. */
  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
        preferences: preferencesSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const prefs = JSON.stringify(input.preferences ?? {});
      // Upsert by endpoint — same browser re-subscribing should overwrite
      // its previous keys, not duplicate.
      const [existing] = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, input.endpoint))
        .limit(1);
      if (existing) {
        await db
          .update(pushSubscriptions)
          .set({
            userId: ctx.user.id,
            p256dh: input.keys.p256dh,
            auth: input.keys.auth,
            preferences: prefs,
          })
          .where(eq(pushSubscriptions.endpoint, input.endpoint));
        return { ok: true };
      }
      await db.insert(pushSubscriptions).values({
        userId: ctx.user.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        preferences: prefs,
      });
      return { ok: true };
    }),

  /** Tear down a single subscription (e.g. user clicks 'Disable on this device'). */
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.endpoint, input.endpoint),
            eq(pushSubscriptions.userId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),

  /** Update what kinds of pings this user wants. Applies to all of their devices. */
  updatePreferences: protectedProcedure
    .input(z.object({ preferences: preferencesSchema }))
    .mutation(async ({ ctx, input }) => {
      const prefs = JSON.stringify(input.preferences);
      const result = await db
        .update(pushSubscriptions)
        .set({ preferences: prefs })
        .where(eq(pushSubscriptions.userId, ctx.user.id));
      if (!result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update notification preferences",
        });
      }
      return { ok: true };
    }),
});
