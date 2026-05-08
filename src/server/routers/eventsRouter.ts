import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { events, groupMembers } from "@/lib/db/schema";

async function ensureMembership(groupId: string, userId: string) {
  const m = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    )
    .limit(1);
  if (m.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this group.",
    });
  }
}

export const eventsRouter = router({
  /** Recent events for a group, newest first. */
  listByGroup: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureMembership(input.groupId, ctx.user.id);
      const rows = await db
        .select()
        .from(events)
        .where(eq(events.groupId, input.groupId))
        .orderBy(desc(events.occurredAt))
        .limit(input.limit);
      return rows.map((r) => ({
        ...r,
        payload: safeParseJson(r.payload),
      }));
    }),
});

function safeParseJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
