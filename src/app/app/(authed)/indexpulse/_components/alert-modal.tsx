"use client";

import { useState } from "react";
import { X, Bell, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

export type AlertTarget = {
  instrumentKey: string;
  instrumentType: "etf" | "mf";
  name: string;
  symbol: string;
  /** Current price/NAV, prefilled as a sensible threshold starting point. */
  currentPrice: number | null;
  /** When editing an existing alert. */
  existing?: {
    id: string;
    condition: "above" | "below";
    threshold: number;
    channels: string[];
    enabled: boolean;
  };
};

type Channel = "in_app" | "push" | "email";

const CHANNELS: { key: Channel; label: string; hint: string }[] = [
  { key: "in_app", label: "In-app", hint: "Toast when you open the app" },
  { key: "push", label: "Push", hint: "Browser notification, app closed" },
  { key: "email", label: "Email", hint: "To your account address" },
];

/**
 * Create / edit a price alert for one instrument. The dashboard mounts
 * this (with a `key` per target) only when a target is set, so initial
 * state is derived once from props — no state-syncing effect. Reuses the
 * app's existing push-subscription flow: if the user picks Push and
 * hasn't granted permission, we prompt + subscribe before saving.
 */
export function AlertModal({
  target,
  onClose,
}: {
  target: AlertTarget;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [condition, setCondition] = useState<"above" | "below">(
    target.existing?.condition ?? "above",
  );
  const [threshold, setThreshold] = useState(
    target.existing
      ? String(target.existing.threshold)
      : target.currentPrice != null
        ? target.currentPrice.toFixed(2)
        : "",
  );
  const [channels, setChannels] = useState<Channel[]>(
    target.existing
      ? (target.existing.channels.filter((c) =>
          ["in_app", "push", "email"].includes(c),
        ) as Channel[])
      : ["in_app"],
  );
  const [subscribing, setSubscribing] = useState(false);

  const createAlert = trpc.indexpulse.createAlert.useMutation();
  const updateAlert = trpc.indexpulse.updateAlert.useMutation();
  const subscribe = trpc.notifications.subscribe.useMutation();

  function toggleChannel(c: Channel) {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  /** Ensure Web Push is granted + subscribed before saving a push alert. */
  async function ensurePushReady(): Promise<boolean> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      toast.error("This browser doesn't support push notifications.");
      return false;
    }
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) {
      toast.error("Push isn't configured on the server (missing VAPID key).");
      return false;
    }
    try {
      setSubscribing(true);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied.");
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid).buffer as ArrayBuffer,
      });
      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await subscribe.mutateAsync({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      return true;
    } catch {
      toast.error("Couldn't enable push on this device.");
      return false;
    } finally {
      setSubscribing(false);
    }
  }

  async function save() {
    const value = Number(threshold);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid threshold.");
      return;
    }
    if (channels.length === 0) {
      toast.error("Pick at least one alert channel.");
      return;
    }
    if (channels.includes("push")) {
      const ok = await ensurePushReady();
      if (!ok) return;
    }
    try {
      if (target.existing) {
        await updateAlert.mutateAsync({
          id: target.existing.id,
          condition,
          threshold: value,
          channels,
        });
        toast.success("Alert updated.");
      } else {
        await createAlert.mutateAsync({
          instrumentKey: target.instrumentKey,
          instrumentType: target.instrumentType,
          name: target.name,
          symbol: target.symbol,
          condition,
          threshold: value,
          channels,
          enabled: true,
        });
        toast.success("Alert set.");
      }
      await utils.indexpulse.listAlerts.invalidate();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't save the alert.",
      );
    }
  }

  const saving = createAlert.isPending || updateAlert.isPending || subscribing;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Set price alert"
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
              <Bell className="h-4 w-4" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide">
                {target.existing ? "Edit alert" : "New alert"}
              </span>
            </div>
            <h2 className="mt-1 text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">
              {target.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {target.instrumentType === "etf" ? "ETF" : "Index fund"} ·{" "}
              {target.symbol}
              {target.currentPrice != null && (
                <> · now ₹{target.currentPrice.toFixed(2)}</>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Condition */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {(["above", "below"] as const).map((c) => {
            const active = condition === c;
            const Icon = c === "above" ? ArrowUp : ArrowDown;
            return (
              <button
                key={c}
                onClick={() => setCondition(c)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-300"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                Goes {c}
              </button>
            );
          })}
        </div>

        {/* Threshold */}
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Threshold (₹)
        </label>
        <div className="mb-4 flex items-center rounded-xl border border-slate-200 focus-within:border-violet-500 dark:border-slate-700">
          <span className="pl-3 text-slate-400">₹</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent px-2 py-2.5 text-sm outline-none dark:text-slate-100"
            autoFocus
          />
        </div>

        {/* Channels */}
        <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Notify me via
        </label>
        <div className="mb-5 space-y-2">
          {CHANNELS.map((ch) => {
            const active = channels.includes(ch.key);
            return (
              <button
                key={ch.key}
                onClick={() => toggleChannel(ch.key)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-violet-500 bg-violet-50 dark:border-violet-500 dark:bg-violet-950/40"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                }`}
              >
                <span>
                  <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                    {ch.label}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {ch.hint}
                  </span>
                </span>
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full border text-white ${
                    active
                      ? "border-violet-500 bg-violet-500"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                  aria-hidden
                >
                  {active && <span className="text-[11px] leading-none">✓</span>}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
        >
          {saving
            ? "Saving…"
            : target.existing
              ? "Update alert"
              : "Set alert"}
        </button>
      </div>
    </div>
  );
}

/** VAPID public key (base64url) → Uint8Array for pushManager.subscribe. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
