"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Trash2, LogOut, Loader2, X, Save } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

type GroupForSettings = {
  id: string;
  name: string;
  primaryCurrency: string;
};

export function GroupSettings({
  group,
  expenseCount,
  isCreator,
}: {
  group: GroupForSettings;
  expenseCount: number;
  /** Only the group creator can delete the whole group. */
  isCreator: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group.name);

  const utils = trpc.useUtils();

  const updateMutation = trpc.groups.update.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      utils.groups.byId.invalidate({ id: group.id });
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Settings className="h-3.5 w-3.5" aria-hidden /> Settings
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
