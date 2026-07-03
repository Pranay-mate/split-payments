/**
 * IndexPulse router — admin-only. Powers the /app/indexpulse surface:
 *   - `funds`  : the catalog (Indian index funds + ETFs) with live quotes
 *   - alert CRUD (list/create/update/toggle/delete), scoped to the
 *     signed-in admin's user id.
 *
 * Every procedure is an adminProcedure (protected + ADMIN_USER_IDS
 * allow-list), so there is no per-user data isolation concern beyond
 * "only admins reach here at all". Alerts are still keyed by user_id so
 * two founders don't see each other's alerts.
 *
 * Data comes from the free AMFI + Yahoo layer in @/lib/indexpulse, which
 * is internally cached and degrades to `stale` quotes on any outage —
 * this router never throws on a data-source hiccup.
 */
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { adminProcedure } from "../admin-auth";
import { db } from "@/lib/db";
import { indexFundAlerts } from "@/lib/db/schema";
import { getCatalog, getQuotes } from "@/lib/indexpulse/quotes";

const channelEnum = z.enum(["in_app", "push", "email"]);

const alertInput = z.object({
  instrumentKey: z.string().min(1),
  instrumentType: z.enum(["etf", "mf"]),
  name: z.string().min(1),
  symbol: z.string().min(1),
  condition: z.enum(["above", "below"]),
  threshold: z.number().positive(),
  channels: z.array(channelEnum).min(1),
  enabled: z.boolean().default(true),
});

export const indexpulseRouter = router({
  /**
   * The full catalog joined with current quotes. One call powers the
   * whole list view. Cached upstream, so hitting this on every mount is
   * cheap. Returns instruments even when their quote is stale so the UI
   * can still list them with a "—" price.
   */
  funds: adminProcedure.query(async () => {
    const instruments = await getCatalog();
    const quotes = await getQuotes(instruments.map((i) => i.key));
    const byKey = new Map(quotes.map((q) => [q.key, q]));
    return instruments.map((inst) => ({
      ...inst,
      quote:
        byKey.get(inst.key) ??
        {
          key: inst.key,
          price: null,
          previousClose: null,
          changePct: null,
          asOf: null,
          stale: true,
        },
    }));
  }),

  /** The admin's own alerts, newest first. */
  listAlerts: adminProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(indexFundAlerts)
      .where(eq(indexFundAlerts.userId, ctx.user.id))
      .orderBy(desc(indexFundAlerts.createdAt));
  }),

  createAlert: adminProcedure
    .input(alertInput)
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .insert(indexFundAlerts)
        .values({
          userId: ctx.user.id,
          instrumentKey: input.instrumentKey,
          instrumentType: input.instrumentType,
          name: input.name,
          symbol: input.symbol,
          condition: input.condition,
          threshold: input.threshold.toString(),
          channels: JSON.stringify(input.channels),
          enabled: input.enabled,
        })
        .returning();
      return row;
    }),

  updateAlert: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        condition: z.enum(["above", "below"]).optional(),
        threshold: z.number().positive().optional(),
        channels: z.array(channelEnum).min(1).optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (rest.condition !== undefined) patch.condition = rest.condition;
      if (rest.threshold !== undefined)
        patch.threshold = rest.threshold.toString();
      if (rest.channels !== undefined)
        patch.channels = JSON.stringify(rest.channels);
      if (rest.enabled !== undefined) patch.enabled = rest.enabled;
      const [row] = await db
        .update(indexFundAlerts)
        .set(patch)
        .where(
          and(
            eq(indexFundAlerts.id, id),
            eq(indexFundAlerts.userId, ctx.user.id),
          ),
        )
        .returning();
      if (!row)
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found." });
      return row;
    }),

  toggleAlert: adminProcedure
    .input(z.object({ id: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(indexFundAlerts)
        .set({ enabled: input.enabled, updatedAt: new Date() })
        .where(
          and(
            eq(indexFundAlerts.id, input.id),
            eq(indexFundAlerts.userId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),

  deleteAlert: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(indexFundAlerts)
        .where(
          and(
            eq(indexFundAlerts.id, input.id),
            eq(indexFundAlerts.userId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),
});
