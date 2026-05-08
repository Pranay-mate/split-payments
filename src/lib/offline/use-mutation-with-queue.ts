"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { enqueue, isOfflineError } from "./queue";
import { useOffline } from "./use-offline";
import type { QueuedPath } from "./db";

type Mutation<I> = {
  mutateAsync: (input: I) => Promise<unknown>;
};

type Options = {
  /**
   * Called when the mutation gets queued (offline). Use to optimistically
   * update React Query caches so the UI reflects the change immediately.
   * Receives the input + the synthesised clientEventId for the queue row.
   */
  onQueued?: (input: unknown, clientEventId: string) => void;
};

/**
 * Wraps a tRPC mutation so that network failures fall back to the
 * IndexedDB queue. The user sees a toast explaining the change was
 * saved offline; the OfflineProvider handles replaying when online.
 *
 * Usage:
 *   const submit = useMutationWithQueue("expenses.create", mutation, {
 *     onQueued: (input, id) => optimisticallyAddToCache(input, id),
 *   });
 *   await submit(input);
 */
export function useMutationWithQueue<I>(
  path: QueuedPath,
  mutation: Mutation<I>,
  options?: Options,
) {
  const { refreshCount } = useOffline();
  const onQueued = options?.onQueued;

  return useCallback(
    async (input: I): Promise<{ queued: boolean }> => {
      // Generate a clientEventId UPFRONT and inject it into the mutation
      // input. The server uses it as the row's id (for create) or for
      // idempotency checks (for update/delete). This makes offline
      // create→update and create→delete sequences work correctly: after
      // sync, the server-side id matches the optimistic id we showed.
      const clientEventId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const augmentedInput = { ...(input as object), clientEventId } as I;

      const queueLocally = async () => {
        await enqueue(path, augmentedInput);
        if (onQueued) onQueued(augmentedInput, clientEventId);
        await refreshCount();
        toast.success("Saved offline · syncs when you reconnect");
        return { queued: true } as const;
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return queueLocally();
      }

      try {
        await mutation.mutateAsync(augmentedInput);
        return { queued: false };
      } catch (err) {
        if (isOfflineError(err)) return queueLocally();
        throw err;
      }
    },
    [mutation, path, refreshCount, onQueued],
  );
}
