/**
 * Drizzle schema — single source of truth for the EasySplits data model.
 *
 * Tables:
 *   profiles          — extends Supabase auth.users with display name + avatar
 *   groups            — a shared expense group (trip, household, etc.)
 *   group_members     — junction: which users belong to which group
 *   expenses          — one expense within a group
 *   expense_splits    — per-person share for a single expense
 *   settlements       — recorded payment between two members
 *   events            — append-only event log for offline sync replay
 *
 * Conventions:
 *   - Money stored in `numeric(14, 2)` (paisa-precise, supports up to 99 crore)
 *   - All tables have created_at and most have updated_at
 *   - Soft-delete via deleted_at where applicable; expenses are hard-deleted
 *     because they're rebuildable from the event log if needed
 *   - User IDs are uuid matching Supabase auth.users.id
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  varchar,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const splitModeEnum = pgEnum("split_mode", [
  "equal",
  "exact",
  "share",
  "percent",
]);

export const profiles = pgTable("profiles", {
  /** Matches Supabase auth.users.id */
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const groups = pgTable(
  "groups",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    /** Three-letter ISO 4217 currency code, e.g. INR, USD. */
    primaryCurrency: varchar("primary_currency", { length: 3 })
      .notNull()
      .default("INR"),
    /** Random 32-byte hex token for shareable invite links. */
    inviteToken: text("invite_token")
      .notNull()
      .unique()
      .default(sql`encode(gen_random_bytes(32), 'hex')`),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("groups_created_by_idx").on(t.createdBy),
    index("groups_invite_token_idx").on(t.inviteToken),
  ],
);

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("group_members_pk").on(t.groupId, t.userId),
    index("group_members_user_idx").on(t.userId),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    description: text("description").notNull().default(""),
    /** Total amount paid, in the original currency. */
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    /** Original currency (3-letter ISO 4217). */
    currency: varchar("currency", { length: 3 }).notNull(),
    /** Amount converted to the group's primary currency. */
    convertedAmount: numeric("converted_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    /** FX rate applied at entry time (1 unit of `currency` = X primary). */
    fxRate: numeric("fx_rate", { precision: 18, scale: 8 }).notNull(),
    payerId: uuid("payer_id").notNull(),
    splitMode: splitModeEnum("split_mode").notNull().default("equal"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("expenses_group_idx").on(t.groupId),
    index("expenses_payer_idx").on(t.payerId),
  ],
);

export const expenseSplits = pgTable(
  "expense_splits",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    /** Amount this user is responsible for, in the group's primary currency. */
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [
    unique("expense_splits_pk").on(t.expenseId, t.userId),
    index("expense_splits_user_idx").on(t.userId),
  ],
);

export const expenseComments = pgTable(
  "expense_comments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("expense_comments_expense_idx").on(t.expenseId),
  ],
);

export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    fromUserId: uuid("from_user_id").notNull(),
    toUserId: uuid("to_user_id").notNull(),
    /** Amount transferred, in the group's primary currency. */
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    note: text("note").default(""),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("settlements_group_idx").on(t.groupId),
    index("settlements_from_idx").on(t.fromUserId),
    index("settlements_to_idx").on(t.toUserId),
  ],
);

/**
 * Append-only log for offline-edit replay + audit. Every mutation that
 * happens client-side or server-side gets an event row. Server is source
 * of truth; client replays its queued events on reconnect.
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    /** Type of event, e.g. "expense.added" / "expense.updated" / "expense.deleted" / "settlement.recorded". */
    eventType: text("event_type").notNull(),
    actorId: uuid("actor_id").notNull(),
    /** Snapshot of the change. JSON-encoded payload. */
    payload: text("payload").notNull(),
    /** Client-supplied UUID for idempotent replay (deduplicates retries). */
    clientEventId: uuid("client_event_id").unique(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("events_group_idx").on(t.groupId),
    index("events_actor_idx").on(t.actorId),
    index("events_occurred_idx").on(t.occurredAt),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type ExpenseComment = typeof expenseComments.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type Event = typeof events.$inferSelect;
