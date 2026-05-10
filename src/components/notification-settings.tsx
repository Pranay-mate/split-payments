"use client";

import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { usePushSubscription } from "@/lib/use-push-subscription";

/**
 * Notification preferences block — push opt-in/out + send-test button +
 * status feedback. Used by both Group Settings (legacy location) and
 * the new Profile editor (correct location, since these are user-level
 * preferences, not group-level).
 *
 * Renders inline; caller wraps it in whatever container chrome it likes.
 */
export function NotificationSettings({ compact = false }: { compact?: boolean }) {
  const push = usePushSubscription();

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Bell className="h-3.5 w-3.5" aria-hidden /> Reminders
        </p>
        {!compact && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Daily push for unsettled balances older than 7 days, plus
            anomaly alerts when a category spikes. Applies across all
            your groups.
          </p>
        )}
      </div>
      {push.status === "loading" && (
        <Loader2
          className="h-4 w-4 animate-spin text-slate-400"
          aria-hidden
        />
      )}
      {push.status === "unsupported" && (
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Not supported on this browser
        </span>
      )}
      {push.status === "denied" && (
        <span className="text-[11px] text-rose-600 dark:text-rose-400">
          Blocked — enable in browser settings
        </span>
      )}
      {push.status === "not-subscribed" && (
        <button
          type="button"
          onClick={async () => {
            try {
              await push.subscribe();
              toast.success("Reminders enabled");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-emerald-500"
        >
          <Bell className="h-3 w-3" aria-hidden /> Enable
        </button>
      )}
      {push.status === "subscribed" && (
        <div className="flex shrink-0 items-center gap-1.5">
          <SendTestButton />
          <button
            type="button"
            onClick={async () => {
              try {
                await push.unsubscribe();
                toast.success("Reminders off");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <BellOff className="h-3 w-3" aria-hidden /> Disable
          </button>
        </div>
      )}
    </div>
  );
}

function SendTestButton() {
  const sendTest = trpc.notifications.sendTest.useMutation();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          const r = await sendTest.mutateAsync();
          if (r.sent > 0) {
            toast.success(
              r.expired > 0
                ? `Test sent to ${r.sent} device(s). ${r.expired} expired one(s) cleaned up.`
                : `Test sent to ${r.sent} device${r.sent === 1 ? "" : "s"}. Check your notifications.`,
            );
          } else if (r.expired > 0) {
            toast.error(
              "All your subscriptions had expired — re-enable reminders.",
            );
          } else {
            toast.error("Couldn't reach any of your devices. Try re-enabling.");
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Test failed");
        }
      }}
      disabled={sendTest.isPending}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
      title="Send a test notification to all your subscribed devices"
    >
      {sendTest.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <Send className="h-3 w-3" aria-hidden />
      )}
      Test
    </button>
  );
}

/**
 * Active anomaly mutes — list with unmute buttons. Lives inside the
 * profile editor since it's a user-level preference. Renders nothing
 * when there are no active mutes (avoids empty cruft).
 */
export function ActiveMutesList() {
  const utils = trpc.useUtils();
  const mutesQuery = trpc.personal.mutes.list.useQuery();
  const unmuteMutation = trpc.personal.mutes.delete.useMutation({
    onSuccess: () => {
      utils.personal.mutes.list.invalidate();
      utils.personal.anomalies.invalidate();
      toast.success("Unmuted");
    },
    onError: (err) => toast.error(err.message),
  });

  const mutes = mutesQuery.data ?? [];
  if (mutesQuery.isLoading || mutes.length === 0) return null;

  return (
    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
        Muted categories
      </p>
      <ul className="mt-1.5 space-y-1">
        {mutes.map((m) => (
          <li
            key={m.category}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="truncate">
              {m.category} ·{" "}
              <span className="text-slate-400">
                until{" "}
                {new Date(m.mutedUntil).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </span>
            <button
              type="button"
              onClick={() =>
                unmuteMutation.mutate({
                  category: m.category as Parameters<
                    typeof unmuteMutation.mutate
                  >[0]["category"],
                })
              }
              disabled={unmuteMutation.isPending}
              className="shrink-0 rounded-md border border-slate-200 px-2 py-0.5 text-[10.5px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Unmute
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
