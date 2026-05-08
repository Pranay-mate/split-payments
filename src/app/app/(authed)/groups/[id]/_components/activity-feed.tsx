"use client";

import {
  Activity,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  Settings,
  HandCoins,
  MessageSquare,
} from "lucide-react";
import type { ComponentType } from "react";
import { trpc } from "@/lib/trpc/client";

type EventStyle = {
  label: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  iconClass: string;
};

const EVENT_STYLES: Record<string, EventStyle> = {
  "group.created": {
    label: "created the group",
    Icon: Plus,
    iconClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  "group.updated": {
    label: "updated group settings",
    Icon: Settings,
    iconClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  "group.deleted": {
    label: "deleted the group",
    Icon: Trash2,
    iconClass: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  },
  "member.joined": {
    label: "joined",
    Icon: UserPlus,
    iconClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
  },
  "member.left": {
    label: "left",
    Icon: UserMinus,
    iconClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  "member.removed": {
    label: "removed a member",
    Icon: UserMinus,
    iconClass: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  },
  "expense.added": {
    label: "added an expense",
    Icon: Plus,
    iconClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  "expense.updated": {
    label: "edited an expense",
    Icon: Pencil,
    iconClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
  },
  "expense.deleted": {
    label: "removed an expense",
    Icon: Trash2,
    iconClass: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  },
  "settlement.recorded": {
    label: "marked a payment",
    Icon: HandCoins,
    iconClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  "settlement.deleted": {
    label: "undid a settlement",
    Icon: HandCoins,
    iconClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  "comment.added": {
    label: "commented",
    Icon: MessageSquare,
    iconClass: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
  },
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
        <ul className="mt-3 space-y-3">
          {items.map((e) => {
            const actor = memberById.get(e.actorId)?.name ?? "Former member";
            const style = EVENT_STYLES[e.eventType] ?? {
              label: e.eventType,
              Icon: Activity,
              iconClass:
                "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
            };
            const desc = describeEvent(e.eventType, e.payload);
            const Icon = style.Icon;
            return (
              <li
                key={e.id}
                className="flex items-start gap-3"
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${style.iconClass}`}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug break-words">
                    <span className="font-semibold">{actor}</span>{" "}
                    <span className="text-slate-600 dark:text-slate-400">
                      {style.label}
                    </span>
                    {desc && (
                      <span className="text-slate-700 dark:text-slate-200">
                        {" — "}
                        {desc}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                    {relativeTime(e.occurredAt)}
                  </p>
                </div>
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
