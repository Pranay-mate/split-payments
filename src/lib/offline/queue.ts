/**
 * Offline queue operations: enqueue, drain, count.
 *
 * Drain calls the live tRPC client to replay each queued mutation in
 * FIFO order. On any error it stops to avoid hammering the network if
 * we're partially offline. Permanent errors (e.g., 401 after a session
 * expiry) flag the row but don't lose it — user can manually clear.
 */

import { getOfflineDb, type QueuedMutation, type QueuedPath } from "./db";

const ALLOWED_PATHS: ReadonlySet<QueuedPath> = new Set<QueuedPath>([
  "expenses.create",
  "expenses.update",
  "expenses.delete",
  "settlements.create",
  "settlements.delete",
  "comments.add",
  "comments.delete",
]);

export async function enqueue(
  path: QueuedPath,
  input: unknown,
): Promise<string> {
  if (!ALLOWED_PATHS.has(path)) {
    throw new Error(`Cannot queue path: ${path}`);
  }
  const clientEventId = crypto.randomUUID();
  const db = getOfflineDb();
  await db.queue.add({
    clientEventId,
    path,
    input,
    createdAt: Date.now(),
    attempts: 0,
  });
  return clientEventId;
}

export async function queueSize(): Promise<number> {
  if (typeof window === "undefined") return 0;
  try {
    return await getOfflineDb().queue.count();
  } catch {
    return 0;
  }
}

export async function listQueued(): Promise<QueuedMutation[]> {
  if (typeof window === "undefined") return [];
  try {
    return await getOfflineDb().queue.orderBy("createdAt").toArray();
  } catch {
    return [];
  }
}

export async function clearQueue(): Promise<void> {
  if (typeof window === "undefined") return;
  await getOfflineDb().queue.clear();
}

export type DrainResult = {
  synced: number;
  failed: number;
  remaining: number;
};

type AnyMutateClient = {
  [router: string]: { [procedure: string]: { mutate: (input: unknown) => Promise<unknown> } };
};

/**
 * Replays all queued mutations against the supplied tRPC client. Stops
 * on the first transient error (network) so we don't burn the queue
 * during a partial outage. Returns counts for the UI.
 */
export async function drainQueue(client: AnyMutateClient): Promise<DrainResult> {
  if (typeof window === "undefined") return { synced: 0, failed: 0, remaining: 0 };
  const db = getOfflineDb();
  const items = await db.queue.orderBy("createdAt").toArray();

  let synced = 0;
  let failed = 0;

  for (const item of items) {
    const [router, procedure] = item.path.split(".") as [string, string];
    try {
      await client[router][procedure].mutate(item.input);
      await db.queue.delete(item.id!);
      synced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.queue.update(item.id!, {
        attempts: item.attempts + 1,
        lastError: message,
      });
      failed++;
      // Stop draining on first failure — preserves order + avoids retries
      // hammering the network if we're flapping.
      break;
    }
  }

  const remaining = await db.queue.count();
  return { synced, failed, remaining };
}

/**
 * Best-effort heuristic for "this error means we're offline" vs an actual
 * server error. Used by the optimistic-mutation wrapper to decide whether
 * to enqueue or surface the error.
 */
export function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError && /fetch/i.test(err.message)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /network|fetch failed|failed to fetch/i.test(msg);
}
