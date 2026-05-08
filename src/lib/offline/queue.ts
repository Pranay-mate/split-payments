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
  const clientEventId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const db = getOfflineDb();
  await db.queue.add({
    clientEventId,
    path,
    input,
    createdAt: Date.now(),
    attempts: 0,
  });
  // Best-effort Background Sync registration. SW will postMessage clients
  // when the OS reports network is back. iOS/Firefox don't fire it, so
  // this is purely additive — in-tab "online" event handles those.
  if (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "SyncManager" in window
  ) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const syncMgr = (reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }).sync;
      if (syncMgr) await syncMgr.register("easysplits-sync");
    } catch {
      // Sync registration failed (permissions, no SW yet) — ignore
    }
  }
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
  /** Items the server rejected as conflicts (someone else edited more recently). */
  conflicts: { path: string; message: string }[];
};

type AnyMutateClient = {
  [router: string]: { [procedure: string]: { mutate: (input: unknown) => Promise<unknown> } };
};

/**
 * Replays all queued mutations against the supplied tRPC client. Stops
 * on the first transient error (network) so we don't burn the queue
 * during a partial outage. Returns counts for the UI.
 */
/**
 * Detect tRPC errors that mean "this mutation will never succeed" — we
 * should drop them from the queue rather than retry forever.
 */
function getErrorCode(err: unknown): string | undefined {
  return err && typeof err === "object" && "data" in err
    ? (err as { data?: { code?: string } }).data?.code
    : undefined;
}

function isPermanentError(err: unknown): boolean {
  const code = getErrorCode(err);
  if (!code) return false;
  // FORBIDDEN: lost group access; UNAUTHORIZED: session expired;
  // BAD_REQUEST / NOT_FOUND: stale or invalid input.
  // CONFLICT: last-write-wins lost — surface to user separately below.
  return ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "BAD_REQUEST", "CONFLICT"].includes(code);
}

export async function drainQueue(client: AnyMutateClient): Promise<DrainResult> {
  if (typeof window === "undefined") {
    return { synced: 0, failed: 0, remaining: 0, conflicts: [] };
  }
  const db = getOfflineDb();
  const items = await db.queue.orderBy("createdAt").toArray();

  let synced = 0;
  let failed = 0;
  const permanentFailures: { path: string; message: string }[] = [];

  for (const item of items) {
    const [router, procedure] = item.path.split(".") as [string, string];
    try {
      await client[router][procedure].mutate(item.input);
      await db.queue.delete(item.id!);
      synced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (isPermanentError(err)) {
        // Drop it — retrying won't help. Log + drop so the queue can drain.
        await db.queue.delete(item.id!);
        failed++;
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[offline] dropping permanently-failed ${item.path}:`, message);
        }
        // Surface last-write-wins conflicts to the user — they specifically
        // want to know their offline edit was overwritten by a newer one.
        if (getErrorCode(err) === "CONFLICT") {
          permanentFailures.push({ path: item.path, message });
        }
        continue;
      }

      if (!isOfflineError(err)) {
        // Unknown server error — keep it but increment attempts. Drop after 5.
        const attempts = item.attempts + 1;
        if (attempts >= 5) {
          await db.queue.delete(item.id!);
          failed++;
          continue;
        }
        await db.queue.update(item.id!, { attempts, lastError: message });
        failed++;
        break;
      }

      // Network error — preserve order, stop the drain.
      await db.queue.update(item.id!, {
        attempts: item.attempts + 1,
        lastError: message,
      });
      failed++;
      break;
    }
  }

  const remaining = await db.queue.count();
  return { synced, failed, remaining, conflicts: permanentFailures };
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
