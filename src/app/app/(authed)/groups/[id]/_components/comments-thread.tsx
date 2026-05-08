"use client";

import { useState } from "react";
import {
  Loader2,
  MessageSquare,
  Send,
  Trash2,
  Plus,
  Pencil,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { useMutationWithQueue } from "@/lib/offline/use-mutation-with-queue";

const HISTORY_LABELS: Record<string, string> = {
  "expense.added": "added this expense",
  "expense.updated": "edited this expense",
  "expense.deleted": "removed this expense",
  "comment.added": "commented",
};

function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function CommentsThread({
  expenseId,
  currentUserId,
  memberById,
}: {
  expenseId: string;
  currentUserId: string;
  memberById: Map<string, { id: string; name: string }>;
}) {
  const [draft, setDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const listQuery = trpc.comments.listByExpense.useQuery({ expenseId });
  const historyQuery = trpc.events.listByExpense.useQuery(
    { expenseId },
    { enabled: showHistory, staleTime: 30_000 },
  );
  const utils = trpc.useUtils();

  const addMutation = trpc.comments.add.useMutation({
    onSuccess: () => {
      utils.comments.listByExpense.invalidate({ expenseId });
    },
  });
  const deleteMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      utils.comments.listByExpense.invalidate({ expenseId });
    },
  });
  const submitAdd = useMutationWithQueue("comments.add", addMutation, {
    onQueued: (rawInput, clientEventId) => {
      const i = rawInput as { expenseId: string; body: string };
      utils.comments.listByExpense.setData({ expenseId: i.expenseId }, (old) => {
        if (!old) return old;
        const optimistic = {
          id: clientEventId,
          expenseId: i.expenseId,
          userId: currentUserId,
          body: i.body,
          createdAt: new Date(),
          _pending: true,
        } as unknown as (typeof old)[number];
        return [...old, optimistic];
      });
    },
  });
  const submitDelete = useMutationWithQueue("comments.delete", deleteMutation, {
    onQueued: (rawInput) => {
      const i = rawInput as { id: string };
      utils.comments.listByExpense.setData({ expenseId }, (old) =>
        old ? old.filter((c) => c.id !== i.id) : old,
      );
    },
  });

  const comments = listQuery.data ?? [];

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Comments
          {comments.length > 0 && (
            <span className="ml-0.5 text-slate-400">· {comments.length}</span>
          )}
        </h4>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-pressed={showHistory}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
            showHistory
              ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <History className="h-3 w-3" aria-hidden /> History
        </button>
      </div>

      {showHistory && (
        <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/40 p-2 dark:border-slate-800 dark:bg-slate-800/40">
          {historyQuery.isLoading ? (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Loading history…
            </p>
          ) : (historyQuery.data ?? []).length === 0 ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              No history yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {(historyQuery.data ?? []).map((e) => {
                const actor = memberById.get(e.actorId)?.name ?? "Former member";
                const label = HISTORY_LABELS[e.eventType] ?? e.eventType;
                const Icon =
                  e.eventType === "expense.added"
                    ? Plus
                    : e.eventType === "expense.updated"
                      ? Pencil
                      : e.eventType === "expense.deleted"
                        ? Trash2
                        : MessageSquare;
                const iconClass =
                  e.eventType === "expense.added"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : e.eventType === "expense.deleted"
                      ? "text-rose-600 dark:text-rose-400"
                      : e.eventType === "expense.updated"
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-violet-600 dark:text-violet-400";
                return (
                  <li
                    key={e.id}
                    className="flex items-start gap-2 text-[11px] leading-snug text-slate-600 dark:text-slate-300"
                  >
                    <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${iconClass}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{actor}</span>{" "}
                      <span className="text-slate-500 dark:text-slate-400">{label}</span>{" "}
                      <span className="text-slate-400">· {relativeTime(e.occurredAt)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {listQuery.isLoading ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Loading…
        </div>
      ) : comments.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          No comments yet.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {comments.map((c) => {
            const pending = (c as unknown as { _pending?: boolean })._pending;
            return (
            <li
              key={c.id}
              className={`group flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-xs ${
                pending
                  ? "bg-amber-50 dark:bg-amber-950/30"
                  : "bg-slate-50 dark:bg-slate-800/60"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                  <span>{memberById.get(c.userId)?.name ?? "Former member"}</span>
                  {pending && (
                    <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                      Pending
                    </span>
                  )}
                </p>
                <p className="mt-0.5 break-words text-slate-700 dark:text-slate-200">
                  {c.body}
                </p>
              </div>
              {c.userId === currentUserId && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await submitDelete({ id: c.id });
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Failed",
                      );
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="opacity-0 transition group-hover:opacity-100"
                  aria-label="Delete comment"
                >
                  <Trash2 className="h-3 w-3 text-slate-400 hover:text-rose-500" />
                </button>
              )}
            </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          const body = draft.trim();
          setDraft("");
          try {
            await submitAdd({ expenseId, body });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
            setDraft(body);
          }
        }}
        className="mt-2 flex gap-1.5"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment…"
          maxLength={1000}
          className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="submit"
          disabled={!draft.trim() || addMutation.isPending}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
          aria-label="Send comment"
        >
          {addMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </form>
    </div>
  );
}
