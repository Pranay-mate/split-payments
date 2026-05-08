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

/**
 * Returns the entity key for an item — items sharing a key are sequenced;
 * items with different keys can run in parallel without ordering issues.
 *
 * Why: a create-then-update for the same expense MUST run in order, but
 * an unrelated create on a different group can fire concurrently. With
 * tRPC's httpBatchLink, parallel calls within a microtask window also
 * get batched into a single HTTP request — a meaningful Mumbai→Sydney
 * latency win.
 */
function entityKey(item: QueuedMutation): string {
  const input = item.input as { id?: string; clientEventId?: string };
  const entityId = input.id ?? input.clientEventId ?? item.clientEventId;
  if (item.path.startsWith("expenses.")) return `expense:${entityId}`;
  if (item.path.startsWith("settlements.")) return `settlement:${entityId}`;
  if (item.path.startsWith("comments.")) return `comment:${entityId}`;
  return `${item.path}:${entityId}`;
}

export async function drainQueue(client: AnyMutateClient): Promise<DrainResult> {
  if (typeof window === "undefined") {
    return { synced: 0, failed: 0, remaining: 0, conflicts: [] };
  }
  const db = getOfflineDb();
  const items = await db.queue.orderBy("createdAt").toArray();

  // Bucket items by entity so each entity's chain runs sequentially but
  // distinct entities run in parallel.
  const groups = new Map<string, QueuedMutation[]>();
  for (const item of items) {
    const key = entityKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  let synced = 0;
  let failed = 0;
  const permanentFailures: { path: string; message: string }[] = [];
  // If any entity hits a network error, others can still finish — but we
  // shouldn't keep hammering. A shared flag short-circuits remaining items.
  let sawNetworkError = false;

  await Promise.all(
    Array.from(groups.values()).map(async (group) => {
      for (const item of group) {
        if (sawNetworkError) return; // give up; we're offline again
        const [router, procedure] = item.path.split(".") as [string, string];
        try {
          await client[router][procedure].mutate(item.input);
          await db.queue.delete(item.id!);
          synced++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);

          if (isPermanentError(err)) {
            await db.queue.delete(item.id!);
            failed++;
            if (process.env.NODE_ENV !== "production") {
              console.warn(`[offline] dropping permanently-failed ${item.path}:`, message);
            }
            if (getErrorCode(err) === "CONFLICT") {
              permanentFailures.push({ path: item.path, message });
            }
            continue;
          }

          if (!isOfflineError(err)) {
            const attempts = item.attempts + 1;
            if (attempts >= 5) {
              await db.queue.delete(item.id!);
              failed++;
              continue;
            }
            await db.queue.update(item.id!, { attempts, lastError: message });
            failed++;
            return; // stop this entity's chain to preserve ordering
          }

          // Network error — the rest of this entity's chain must wait too.
          sawNetworkError = true;
          await db.queue.update(item.id!, {
            attempts: item.attempts + 1,
            lastError: message,
          });
          failed++;
          return;
        }
      }
    }),
  );

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
