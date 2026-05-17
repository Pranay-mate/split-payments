"use client";

type FeedItem = {
  id: string;
  actorPrefix: string;
  eventType: string;
  label: string;
  amountBucket: string | null;
  occurredAt: Date | string;
};

/**
 * Anonymised activity feed. We deliberately surface a 4-char user-id
 * prefix and bucket amounts (₹<100, ₹100-500, ...) so the admin can
 * sanity-check activity without re-identifying users or seeing exact
 * rupee values.
 */
export function ActivityFeed({
  data,
  loading,
}: {
  data: FeedItem[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <ul className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <li
            key={i}
            className="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900"
          />
        ))}
      </ul>
    );
  }
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
        No events yet — the feed will populate as users add expenses, settle
        balances, etc.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {data.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 py-2 text-xs"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-6 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {item.actorPrefix}
            </span>
            <span className="truncate font-medium text-slate-800 dark:text-slate-200">
              {item.label}
            </span>
            {item.amountBucket && (
              <span className="shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                {item.amountBucket}
              </span>
            )}
          </div>
          <time
            dateTime={new Date(item.occurredAt).toISOString()}
            className="shrink-0 tabular-nums text-slate-400"
          >
            {formatRelative(new Date(item.occurredAt))}
          </time>
        </li>
      ))}
    </ul>
  );
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
