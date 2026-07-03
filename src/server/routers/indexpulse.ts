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

/** Guardrail: cap alerts per (user, instrument) so one fund can't
 *  accumulate runaway alerts. A band + a couple of % triggers fits well
 *  under this. */
const MAX_ALERTS_PER_INSTRUMENT = 5;

/** Shared validation for both create + update: amount alerts need a
 *  positive price + an above/below direction; percent alerts need a
 *  non-zero signed % and a base price to measure from (direction is
 *  derived from the sign). */
function refineAlert(
  val: {
    mode: "amount" | "percent";
    condition?: "above" | "below";
    threshold: number;
    basePrice?: number;
  },
  ctx: z.RefinementCtx,
) {
  if (val.mode === "amount") {
    if (val.threshold <= 0)
      ctx.addIssue({
        code: "custom",
        message: "Price threshold must be positive.",
        path: ["threshold"],
      });
    if (!val.condition)
      ctx.addIssue({
        code: "custom",
        message: "Pick above or below.",
        path: ["condition"],
      });
  } else {
    if (val.threshold === 0)
      ctx.addIssue({
        code: "custom",
        message: "Percent must be non-zero.",
        path: ["threshold"],
      });
    if (val.basePrice == null)
      ctx.addIssue({
        code: "custom",
        message: "Base price is required for percent alerts.",
        path: ["basePrice"],
      });
  }
}

/** Derive the stored above/below direction. Percent alerts encode
 *  direction in the sign of the threshold (+ = rise/above, − = fall/below). */
function resolveCondition(
  mode: "amount" | "percent",
  threshold: number,
  condition: "above" | "below" | undefined,
): "above" | "below" {
  if (mode === "percent") return threshold >= 0 ? "above" : "below";
  return condition ?? "above";
}

const alertInput = z
  .object({
    instrumentKey: z.string().min(1),
    instrumentType: z.enum(["etf", "mf"]),
    name: z.string().min(1),
    symbol: z.string().min(1),
    mode: z.enum(["amount", "percent"]).default("amount"),
    condition: z.enum(["above", "below"]).optional(),
    /** amount: positive price. percent: signed % (may be negative). */
    threshold: z.number(),
    /** Required for percent mode — the reference price the % is measured from. */
    basePrice: z.number().positive().optional(),
    channels: z.array(channelEnum).min(1),
    enabled: z.boolean().default(true),
  })
  .superRefine(refineAlert);

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
      const existing = await db
        .select({ id: indexFundAlerts.id })
        .from(indexFundAlerts)
        .where(
          and(
            eq(indexFundAlerts.userId, ctx.user.id),
            eq(indexFundAlerts.instrumentKey, input.instrumentKey),
          ),
        );
      if (existing.length >= MAX_ALERTS_PER_INSTRUMENT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `You already have ${MAX_ALERTS_PER_INSTRUMENT} alerts on ${input.name}. Delete one before adding another.`,
        });
      }
      const [row] = await db
        .insert(indexFundAlerts)
        .values({
          userId: ctx.user.id,
          instrumentKey: input.instrumentKey,
          instrumentType: input.instrumentType,
          name: input.name,
          symbol: input.symbol,
          mode: input.mode,
          condition: resolveCondition(input.mode, input.threshold, input.condition),
          threshold: input.threshold.toString(),
          basePrice:
            input.mode === "percent" && input.basePrice != null
              ? input.basePrice.toString()
              : null,
          channels: JSON.stringify(input.channels),
          enabled: input.enabled,
        })
        .returning();
      return row;
    }),

  updateAlert: adminProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          mode: z.enum(["amount", "percent"]),
          condition: z.enum(["above", "below"]).optional(),
          threshold: z.number(),
          basePrice: z.number().positive().optional(),
          channels: z.array(channelEnum).min(1),
          enabled: z.boolean().optional(),
        })
        .superRefine(refineAlert),
    )
    .mutation(async ({ ctx, input }) => {
      // Threshold semantics changed (a new base or sign), so reset the
      // edge-trigger baseline — otherwise a stale last_value could
      // suppress or spuriously fire the next crossing.
      const patch: Record<string, unknown> = {
        mode: input.mode,
        condition: resolveCondition(input.mode, input.threshold, input.condition),
        threshold: input.threshold.toString(),
        basePrice:
          input.mode === "percent" && input.basePrice != null
            ? input.basePrice.toString()
            : null,
        channels: JSON.stringify(input.channels),
        lastValue: null,
        updatedAt: new Date(),
      };
      if (input.enabled !== undefined) patch.enabled = input.enabled;
      const [row] = await db
        .update(indexFundAlerts)
        .set(patch)
        .where(
          and(
            eq(indexFundAlerts.id, input.id),
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
