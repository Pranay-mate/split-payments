"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { drainQueue, queueSize } from "./queue";

type OfflineState = {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  syncNow: () => Promise<void>;
  refreshCount: () => Promise<void>;
};

const OfflineContext = createContext<OfflineState>({
  online: true,
  pendingCount: 0,
  syncing: false,
  syncNow: async () => {},
  refreshCount: async () => {},
});

export function useOffline() {
  return useContext(OfflineContext);
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const utils = trpc.useUtils();
  const trpcClient = trpc.useUtils().client;

  const refreshCount = useCallback(async () => {
    setPendingCount(await queueSize());
  }, []);

  const syncNow = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) return;
    if (syncing) return;
    setSyncing(true);
    try {
      const { synced, remaining } = await drainQueue(
        trpcClient as unknown as Parameters<typeof drainQueue>[0],
      );
      if (synced > 0) {
        toast.success(
          synced === 1 ? "Synced 1 pending change" : `Synced ${synced} pending changes`,
        );
        // Invalidate everything that might have been touched.
        utils.expenses.invalidate();
        utils.settlements.invalidate();
        utils.comments.invalidate();
        utils.events.invalidate();
        utils.groups.invalidate();
      }
      setPendingCount(remaining);
    } finally {
      setSyncing(false);
    }
  }, [syncing, trpcClient, utils]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Defer initial sync via microtask so we don't synchronously setState
    // inside the effect body (React 19 lint rule). Listeners are also
    // assigned outside the body via the addEventListener calls.
    queueMicrotask(() => {
      setOnline(navigator.onLine);
      void refreshCount();
      if (navigator.onLine) void syncNow();
    });

    const onOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const onOffline = () => {
      setOnline(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [syncNow, refreshCount]);

  return (
    <OfflineContext.Provider
      value={{ online, pendingCount, syncing, syncNow, refreshCount }}
    >
      {children}
    </OfflineContext.Provider>
  );
}
