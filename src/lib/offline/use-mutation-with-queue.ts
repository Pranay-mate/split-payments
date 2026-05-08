"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { enqueue, isOfflineError } from "./queue";
import { useOffline } from "./use-offline";
import type { QueuedPath } from "./db";

type Mutation<I> = {
  mutateAsync: (input: I) => Promise<unknown>;
};

/**
 * Wraps a tRPC mutation so that network failures fall back to the
 * IndexedDB queue. The user sees a toast explaining the change was
 * saved offline; the OfflineProvider handles replaying when online.
 *
 * Usage:
 *   const createMutation = trpc.expenses.create.useMutation({...});
 *   const submit = useMutationWithQueue("expenses.create", createMutation);
 *   await submit(input);
 */
export function useMutationWithQueue<I>(
  path: QueuedPath,
  mutation: Mutation<I>,
) {
  const { refreshCount } = useOffline();

  return useCallback(
    async (input: I): Promise<{ queued: boolean }> => {
      // Short-circuit if the browser knows we're offline. Otherwise the
      // fetch can hang for ~30s waiting for DNS / connection timeout
      // before the catch path fires — that's the "spinner forever" bug.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueue(path, input);
        await refreshCount();
        toast.success("Saved offline · will sync when you reconnect");
        return { queued: true };
      }

      try {
        await mutation.mutateAsync(input);
        return { queued: false };
      } catch (err) {
        if (isOfflineError(err)) {
          await enqueue(path, input);
          await refreshCount();
          toast.success("Saved offline · will sync when you reconnect");
          return { queued: true };
        }
        throw err;
      }
    },
    [mutation, path, refreshCount],
  );
}
