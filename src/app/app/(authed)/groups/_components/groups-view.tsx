"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArchiveRestore,
  ArrowRight,
  ChevronDown,
  Loader2,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { formatINR } from "@/lib/format";

const COMMON_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "JPY"] as const;

type ServerGroup = {
  id: string;
  name: string;
  primaryCurrency: string;
  inviteToken: string;
  createdAt: Date;
};

type GroupRow = ServerGroup & {
  archivedAt: Date | null;
  myNetBalance: number;
  lastActivityAt: Date;
  expenseCount: number;
};

const EPSILON = 0.5; // round-to-rupee precision; treat sub-50p balances as settled

const TEMPLATES = [
  { key: "trip", emoji: "✈️", label: "Trip", suggestedName: "Goa trip" },
  {
    key: "roommates",
    emoji: "🏠",
    label: "Roommates",
    suggestedName: "Roommates",
  },
  {
    key: "solo",
    emoji: "🧍",
    label: "Solo / Just me",
    suggestedName: "My expenses",
  },
] as const;

export function GroupsView({ initialGroups }: { initialGroups: ServerGroup[] }) {
  const [creating, setCreating] = useState(false);
  const [initialName, setInitialName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const groupsQuery = trpc.groups.list.useQuery(undefined, {
    initialData: initialGroups as GroupRow[],
    staleTime: 30_000,
  });

  const { active, archived, all } = useMemo(() => {
    const allRows = (groupsQuery.data ?? []) as GroupRow[];
    const a: GroupRow[] = [];
    const b: GroupRow[] = [];
    for (const g of allRows) (g.archivedAt ? b : a).push(g);
    // Active sorted by last activity desc (newest activity first).
    a.sort(
      (x, y) =>
        new Date(y.lastActivityAt).getTime() -
        new Date(x.lastActivityAt).getTime(),
    );
    // Archived sorted by archive date desc.
    b.sort(
      (x, y) =>
        (x.archivedAt ? new Date(x.archivedAt).getTime() : 0) <
        (y.archivedAt ? new Date(y.archivedAt).getTime() : 0)
          ? 1
          : -1,
    );
    return { active: a, archived: b, all: allRows };
  }, [groupsQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {groupsQuery.isLoading
            ? "Loading"
            : `${active.length} active group${active.length === 1 ? "" : "s"}`}
        </h2>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {creating ? "Cancel" : "New group"}
        </button>
      </div>

      {creating && (
        <CreateGroupForm
          initialName={initialName}
          onSuccess={() => {
            setCreating(false);
            setInitialName("");
            groupsQuery.refetch();
          }}
          onCancel={() => {
            setCreating(false);
            setInitialName("");
          }}
        />
      )}

      {groupsQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your groups…
        </div>
      ) : all.length > 0 ? (
        <>
          {active.length > 0 && (
            <ul className="space-y-2">
              {active.map((g) => (
                <GroupCard key={g.id} group={g} />
              ))}
            </ul>
          )}

          {/* Empty active list when all groups are archived. */}
          {active.length === 0 && archived.length > 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No active groups — all {archived.length} are archived.
              </p>
            </div>
          )}

          {archived.length > 0 && (
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <span>
                  Archived · {archived.length}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showArchived ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {showArchived && (
                <ul className="mt-2 space-y-2">
                  {archived.map((g) => (
                    <GroupCard key={g.id} group={g} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      ) : (
        !creating && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-6 text-center dark:border-slate-700 dark:from-slate-900/40 dark:to-indigo-950/20 sm:p-8">
            <span
              aria-hidden
              className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 text-white shadow-sm"
            >
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-4 text-base font-semibold tracking-tight">
              Create your first group
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Start with a template, or build from scratch.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setInitialName(t.suggestedName);
                    setCreating(true);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-3 text-xs font-medium text-slate-700 transition hover:border-indigo-400 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/30"
                >
                  <span aria-hidden className="text-lg">
                    {t.emoji}
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Start from scratch
            </button>
          </div>
        )
      )}
    </div>
  );
}

/**
 * Smart card for a group row. Status indicator on the left edge:
 *   rose     — user owes money in this group
 *   emerald  — user is owed money
 *   slate    — settled (sub-50p net)
 * Plus a balance line and a relative last-activity timestamp.
 *
 * Archived groups render in a dimmed style and expose an Unarchive
 * button inline (no need to drill into Group Settings).
 */
function GroupCard({ group: g }: { group: GroupRow }) {
  const utils = trpc.useUtils();
  const unarchiveMutation = trpc.groups.unarchive.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      toast.success("Group unarchived");
    },
    onError: (err) => toast.error(err.message),
  });

  const isArchived = !!g.archivedAt;
  const settled = Math.abs(g.myNetBalance) < EPSILON;
  const owes = !settled && g.myNetBalance < 0;
  const tone = settled
    ? {
        bar: "bg-slate-300 dark:bg-slate-700",
        text: "text-slate-500 dark:text-slate-400",
        label: "All settled",
      }
    : owes
      ? {
          bar: "bg-rose-500",
          text: "text-rose-700 dark:text-rose-400",
          label: `You owe ${formatINR(Math.abs(g.myNetBalance), 0)}`,
        }
      : {
          bar: "bg-emerald-500",
          text: "text-emerald-700 dark:text-emerald-400",
          label: `You're owed ${formatINR(g.myNetBalance, 0)}`,
        };

  return (
    <li className={isArchived ? "opacity-70" : ""}>
      <div
        className={`group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700`}
      >
        {/* Left edge status bar */}
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`}
        />

        <Link
          href={`/app/groups/${g.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-xs font-semibold text-white">
            {g.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{g.name}</p>
            <p className={`mt-0.5 truncate text-xs font-medium ${tone.text}`}>
              {tone.label}
              {g.expenseCount > 0 && (
                <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">
                  · {relativeTime(g.lastActivityAt)} · {g.primaryCurrency}
                </span>
              )}
              {g.expenseCount === 0 && (
                <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">
                  · No expenses yet · {g.primaryCurrency}
                </span>
              )}
            </p>
          </div>
        </Link>

        {isArchived ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              unarchiveMutation.mutate({ id: g.id });
            }}
            disabled={unarchiveMutation.isPending}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Restore this group to the active list"
          >
            <ArchiveRestore className="h-3 w-3" aria-hidden />
            Unarchive
          </button>
        ) : (
          <ArrowRight
            className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700 dark:group-hover:text-slate-200"
            aria-hidden
          />
        )}
      </div>
    </li>
  );
}

/** Compact relative-time formatter — "today", "3 days ago", "2 mo ago". */
function relativeTime(d: Date | string): string {
  const ts = new Date(d).getTime();
  const diffMs = Date.now() - ts;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function CreateGroupForm({
  initialName = "",
  onSuccess,
  onCancel,
}: {
  initialName?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const meQuery = trpc.profiles.me.useQuery(undefined, { staleTime: 60_000 });
  const defaultCurrency =
    (meQuery.data as { defaultCurrency?: string })?.defaultCurrency ?? "INR";
  const [name, setName] = useState(initialName);
  const [currency, setCurrency] = useState<string>(defaultCurrency);

  const utils = trpc.useUtils();
  const createMutation = trpc.groups.create.useMutation({
    onSuccess: (group) => {
      utils.groups.list.invalidate();
      toast.success(`Created "${group.name}"`);
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        createMutation.mutate({ name: name.trim(), primaryCurrency: currency });
      }}
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="text-sm font-semibold">New group</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Goa weekend, Roommates, Office lunch…"
            autoFocus
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Primary currency
          </span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900"
          >
            {COMMON_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        All balances + settle-ups happen in this currency. Expenses can still be
        entered in any currency.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={!name.trim() || createMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          Create group
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
