"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  Link2,
  Loader2,
  LogOut,
  Save,
  Send,
  Settings,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { usePushSubscription } from "@/lib/use-push-subscription";

type GroupForSettings = {
  id: string;
  name: string;
  primaryCurrency: string;
};

type MemberForSettings = {
  userId: string;
  displayName: string;
  isGuest: boolean;
};

export function GroupSettings({
  group,
  expenseCount,
  isCreator,
  members,
  meId,
}: {
  group: GroupForSettings;
  expenseCount: number;
  /** Only the group creator can delete the whole group. */
  isCreator: boolean;
  /** Member list — same shape as group-detail uses. */
  members: MemberForSettings[];
  /** Logged-in user's id, so we can hide "remove" on self. */
  meId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group.name);
  const [guestName, setGuestName] = useState("");

  const utils = trpc.useUtils();

  // Member-management mutations live in Settings now (single source of
  // truth for add/remove/claim); the standalone Members card on the
  // page is read-only chips.
  const addGuestMutation = trpc.groups.addGuest.useMutation({
    onSuccess: () => {
      utils.groups.members.invalidate({ groupId: group.id });
      utils.events.listByGroup.invalidate({ groupId: group.id });
      setGuestName("");
      toast.success("Guest added");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMemberMutation = trpc.groups.removeMember.useMutation({
    onSuccess: () => {
      utils.groups.members.invalidate({ groupId: group.id });
      utils.events.listByGroup.invalidate({ groupId: group.id });
      toast.success("Member removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const claimTokenMutation = trpc.groups.createClaimToken.useMutation({
    onSuccess: async ({ token }) => {
      const url = `${window.location.origin}/app/claim/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Claim link copied — share it with your guest");
      } catch {
        toast.success(`Link: ${url}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.groups.update.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      utils.groups.byId.invalidate({ id: group.id });
      utils.events.listByGroup.invalidate({ groupId: group.id });
      toast.success("Group updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.groups.delete.useMutation({
    onSuccess: () => {
      toast.success("Group deleted");
      router.push("/app/groups");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const leaveMutation = trpc.groups.leave.useMutation({
    onSuccess: () => {
      toast.success("Left the group");
      router.push("/app/groups");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const renameDirty = name.trim() !== group.name && name.trim().length > 0;

  const push = usePushSubscription();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Group settings"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Settings className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Settings</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-40 bg-slate-900/40"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-settings-title"
            className="fixed inset-x-3 top-12 z-50 mx-auto max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:top-20"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
              <h2
                id="group-settings-title"
                className="text-base font-semibold tracking-tight"
              >
                Group settings
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="space-y-5 px-5 py-4">
              <label className="block">
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Group name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() =>
                    updateMutation.mutate({ id: group.id, name: name.trim() })
                  }
                  disabled={!renameDirty || updateMutation.isPending}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Save className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Save name
                </button>
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  Primary currency: {group.primaryCurrency}
                </p>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  {expenseCount > 0
                    ? "Locked because expenses already exist. Create a new group to use a different currency."
                    : "Can be changed only while the group has no expenses (currently empty)."}
                </p>
              </div>

              {/* Members management — moved here from the standalone
                  Members card so all admin actions live in one place. */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Users className="h-3.5 w-3.5" aria-hidden /> Members ·{" "}
                  {members.length}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {members.map((m) => {
                    const isSelf = m.userId === meId;
                    const isGuest = m.isGuest;
                    return (
                      <li
                        key={m.userId}
                        className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-xs dark:bg-slate-900"
                      >
                        <span
                          aria-hidden
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white ${
                            isGuest
                              ? "bg-gradient-to-br from-amber-500 to-rose-500"
                              : "bg-gradient-to-br from-indigo-500 to-emerald-500"
                          }`}
                        >
                          {m.displayName.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {m.displayName}
                          {isSelf ? " (you)" : ""}
                          {isGuest && (
                            <span className="ml-1.5 rounded-full bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                              guest
                            </span>
                          )}
                        </span>
                        {isGuest && isCreator && (
                          <button
                            type="button"
                            onClick={() =>
                              claimTokenMutation.mutate({
                                groupId: group.id,
                                shadowProfileId: m.userId,
                              })
                            }
                            disabled={claimTokenMutation.isPending}
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-amber-700 transition hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950"
                            aria-label={`Generate claim link for ${m.displayName}`}
                            title="Copy a single-use claim link to share with this guest"
                          >
                            <Link2 className="h-3 w-3" aria-hidden />
                          </button>
                        )}
                        {!isSelf && (isGuest || isCreator) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirm(`Remove ${m.displayName} from this group?`)
                              ) {
                                removeMemberMutation.mutate({
                                  groupId: group.id,
                                  userId: m.userId,
                                });
                              }
                            }}
                            disabled={removeMemberMutation.isPending}
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40"
                            aria-label={`Remove ${m.displayName}`}
                          >
                            <UserMinus className="h-3 w-3" aria-hidden />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = guestName.trim();
                    if (!trimmed) return;
                    addGuestMutation.mutate({
                      groupId: group.id,
                      name: trimmed,
                    });
                  }}
                  className="mt-3 flex flex-wrap items-center gap-2"
                >
                  <label className="sr-only" htmlFor="settings-guest-name">
                    Guest name
                  </label>
                  <input
                    id="settings-guest-name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Add by name (no signup)"
                    maxLength={60}
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="submit"
                    disabled={
                      !guestName.trim() || addGuestMutation.isPending
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-indigo-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
                  >
                    {addGuestMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      <UserPlus className="h-3 w-3" aria-hidden />
                    )}
                    Add
                  </button>
                </form>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <Bell className="h-3.5 w-3.5" aria-hidden /> Reminders
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Daily push for unsettled balances older than 7 days.
                      Applies across all your groups.
                    </p>
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
                          toast.error(
                            err instanceof Error ? err.message : "Failed",
                          );
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
                            toast.error(
                              err instanceof Error ? err.message : "Failed",
                            );
                          }
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <BellOff className="h-3 w-3" aria-hidden /> Disable
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/40">
                <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
                  Danger zone
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Leave this group? You'll lose access to its expenses.")) {
                        leaveMutation.mutate({ groupId: group.id });
                      }
                    }}
                    disabled={leaveMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden /> Leave group
                  </button>
                  {isCreator && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete "${group.name}"? Everyone loses access. This cannot be undone.`)) {
                          deleteMutation.mutate({ id: group.id });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete group
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
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
      title="Send a test notification to all your subscribed devices, bypassing the daily-cron checks"
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
