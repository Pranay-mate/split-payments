"use client";

import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";

type Status =
  | "loading"
  | "unsupported"
  | "denied"
  | "not-subscribed"
  | "subscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Defers a setState into a microtask so React 19's
 * `react-hooks/set-state-in-effect` lint stays quiet — these are
 * intentional async-callback updates, not effect-driven loops.
 */
function deferSetStatus(
  setStatus: (s: Status) => void,
  next: Status,
): void {
  queueMicrotask(() => setStatus(next));
}

export function usePushSubscription() {
  const [status, setStatus] = useState<Status>("loading");
  const subscribeMutation = trpc.notifications.subscribe.useMutation();
  const unsubscribeMutation = trpc.notifications.unsubscribe.useMutation();

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      deferSetStatus(setStatus, "unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      deferSetStatus(setStatus, "denied");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    deferSetStatus(setStatus, sub ? "subscribed" : "not-subscribed");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (typeof window === "undefined") return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error(
        "Notifications aren't configured yet — VAPID public key is missing.",
      );
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      deferSetStatus(
        setStatus,
        permission === "denied" ? "denied" : "not-subscribed",
      );
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
        .buffer as ArrayBuffer,
    });
    const json = sub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
      throw new Error("Subscription missing keys.");
    }
    await subscribeMutation.mutateAsync({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    deferSetStatus(setStatus, "subscribed");
  }, [subscribeMutation]);

  const unsubscribe = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      deferSetStatus(setStatus, "not-subscribed");
      return;
    }
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    try {
      await unsubscribeMutation.mutateAsync({ endpoint });
    } catch {
      // Server-side row will get pruned by the cron's 410-handling later.
    }
    deferSetStatus(setStatus, "not-subscribed");
  }, [unsubscribeMutation]);

  return { status, subscribe, unsubscribe, refresh };
}
