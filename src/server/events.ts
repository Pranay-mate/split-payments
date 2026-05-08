/**
 * Helper for writing to the events log table. Every mutation should call
 * this so the activity feed + future offline replay have a complete record.
 *
 * Failures are swallowed (logged in dev) — a missing event row should
 * never block the actual mutation.
 */

import { events } from "@/lib/db/schema";
import { db } from "@/lib/db";

export type LogEventInput = {
  groupId: string | null;
  /** When set, this event is queryable per-expense via events.listByExpense. */
  expenseId?: string | null;
  eventType: string;
  actorId: string;
  payload: Record<string, unknown>;
  /** Optional client-supplied UUID for idempotent replay. */
  clientEventId?: string;
  occurredAt?: Date;
};

export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    await db.insert(events).values({
      groupId: input.groupId,
      expenseId: input.expenseId ?? null,
      eventType: input.eventType,
      actorId: input.actorId,
      payload: JSON.stringify(input.payload),
      clientEventId: input.clientEventId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[events] failed to log:", err);
    }
  }
}
