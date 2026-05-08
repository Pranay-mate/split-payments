"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Loader2, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

const COMMON_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "JPY"] as const;

type ServerGroup = {
  id: string;
  name: string;
  primaryCurrency: string;
  inviteToken: string;
  createdAt: Date;
};

export function GroupsView({ initialGroups }: { initialGroups: ServerGroup[] }) {
  const [creating, setCreating] = useState(false);
  const groupsQuery = trpc.groups.list.useQuery(undefined, {
    initialData: initialGroups,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {groupsQuery.data ? `${groupsQuery.data.length} group${groupsQuery.data.length === 1 ? "" : "s"}` : "Loading"}
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
          onSuccess={() => {
            setCreating(false);
            groupsQuery.refetch();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {groupsQuery.isLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your groups…
        </div>
      ) : groupsQuery.data && groupsQuery.data.length > 0 ? (
        <ul className="space-y-2">
          {groupsQuery.data.map((g) => (
            <li key={g.id}>
              <Link
                href={`/app/groups/${g.id}`}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-xs font-semibold text-white">
                    {g.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Primary currency: {g.primaryCurrency}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700 dark:group-hover:text-slate-200"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        !creating && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <Users className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
            <p className="mt-3 text-sm font-medium">No groups yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Create one for your next trip, your roommates, or a recurring expense circle.
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" aria-hidden /> Create your first group
            </button>
          </div>
        )
      )}
    </div>
  );
}

function CreateGroupForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<string>("INR");

  const utils = trpc.useUtils();
  const createMutation = trpc.groups.create.useMutation({
    onSuccess: (group) => {
      utils.groups.list.invalidate();
      toast.success(`Created “${group.name}”`);
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
        All balances + settle-ups happen in this currency. Expenses can still be entered in any currency.
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
