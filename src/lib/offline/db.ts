/**
 * IndexedDB store for offline-queued mutations.
 *
 * Each row is a deferred tRPC mutation that failed because the network
 * was unavailable. They're replayed in createdAt order when the browser
 * goes back online.
 */

import Dexie, { type Table } from "dexie";

export type QueuedPath =
  | "expenses.create"
  | "expenses.update"
  | "expenses.delete"
  | "settlements.create"
  | "settlements.delete"
  | "comments.add"
  | "comments.delete";

export interface QueuedMutation {
  id?: number;
  /** UUID assigned at enqueue time. Used by server's events.client_event_id for idempotency. */
  clientEventId: string;
  /** tRPC procedure path, e.g. "expenses.create". */
  path: QueuedPath;
  /** The mutation's input payload, JSON-serialisable. */
  input: unknown;
  /** Wall-clock at enqueue. */
  createdAt: number;
  /** Number of replay attempts. */
  attempts: number;
  lastError?: string;
}

class OfflineDb extends Dexie {
  queue!: Table<QueuedMutation, number>;

  constructor() {
    super("easysplits-offline-v1");
    this.version(1).stores({
      // ++id auto-increment; index createdAt for FIFO ordering
      queue: "++id, clientEventId, path, createdAt",
    });
  }
}

let _db: OfflineDb | null = null;

export function getOfflineDb(): OfflineDb {
  if (typeof window === "undefined") {
    throw new Error("Offline DB is browser-only");
  }
  if (!_db) _db = new OfflineDb();
  return _db;
}
