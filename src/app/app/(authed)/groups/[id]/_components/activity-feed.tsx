"use client";

import { Activity, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

const EVENT_LABELS: Record<string, string> = {
  "group.created": "created the group",
  "group.updated": "updated group settings",
  "group.deleted": "deleted the group",
  "member.joined": "joined",
  "member.left": "left",
  "member.removed": "removed a member",
  "expense.added": "added an expense",
  "expense.updated": "edited an expense",
  "expense.deleted": "removed an expense",
  "settlement.recorded": "recorded a settlement",
  "settlement.deleted": "undid a settlement",
  "comment.added": "added a comment",
};

function relativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function ActivityFeed({
  groupId,
  memberById,
}: {
  groupId: string;
  memberById: Map<string, { id: string; name: string }>;
}) {
  const eventsQuery = trpc.events.listByGroup.useQuery({ groupId, limit: 20 });
  const items = eventsQuery.data ?? [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Activity className="h-4 w-4 text-violet-500" aria-hidden />
        Activity
      </h2>

      {eventsQuery.isLoading ? (
        <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Nothing yet — activity will appear here as you and others act.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((e) => {
            const actor = memberById.get(e.actorId)?.name ?? "Former member";
            const label = EVENT_LABELS[e.eventType] ?? e.eventType;
            const desc = describeEvent(e.eventType, e.payload);
            return (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-medium">{actor}</span>{" "}
                    <span className="text-slate-600 dark:text-slate-400">
                      {label}
                    </span>
                    {desc && (
                      <span className="text-slate-500 dark:text-slate-400">
                        {" — "}
                        {desc}
                      </span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {relativeTime(e.occurredAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function describeEvent(
  eventType: string,
  payload: Record<string, unknown>,
): string | null {
  switch (eventType) {
    case "expense.added":
    case "expense.updated":
      return typeof payload.description === "string" && payload.description
        ? `"${payload.description}"`
        : null;
    case "expense.deleted":
      return typeof payload.description === "string" && payload.description
        ? `"${payload.description}"`
        : null;
    case "group.updated":
      if (typeof payload.newName === "string") return `renamed to "${payload.newName}"`;
      if (typeof payload.newCurrency === "string") return `currency → ${payload.newCurrency}`;
      return null;
    default:
      return null;
  }
}
