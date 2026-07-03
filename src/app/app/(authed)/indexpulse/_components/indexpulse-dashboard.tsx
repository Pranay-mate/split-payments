"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Search,
  Bell,
  BellRing,
  TrendingUp,
  TrendingDown,
  Trash2,
  Pencil,
  Plus,
  RefreshCw,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import type { IndexFundAlert } from "@/lib/db/schema";
import { AlertModal, type AlertTarget } from "./alert-modal";

type FundRow = {
  key: string;
  type: "etf" | "mf";
  name: string;
  symbol: string;
  category: string;
  quote: {
    price: number | null;
    previousClose: number | null;
    changePct: number | null;
    asOf: string | null;
    stale: boolean;
  };
};

type Tab = "all" | "etf" | "mf";

/**
 * IndexPulse dashboard. Lists the free AMFI + Yahoo catalog with live
 * price/NAV, search + type/category filters, and a per-instrument
 * "set alert" action. The user's active alerts sit up top so the
 * founder sees what's armed at a glance.
 */
export function IndexPulseDashboard() {
  const funds = trpc.indexpulse.funds.useQuery(undefined, {
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const alerts = trpc.indexpulse.listAlerts.useQuery(undefined, {
    staleTime: 30_000,
  });

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [category, setCategory] = useState<string>("all");
  const [target, setTarget] = useState<AlertTarget | null>(null);

  const rows = useMemo(() => (funds.data ?? []) as FundRow[], [funds.data]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.category) set.add(r.category);
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (tab === "all" ? true : r.type === tab))
      .filter((r) => (category === "all" ? true : r.category === category))
      .filter(
        (r) =>
          !needle ||
          r.name.toLowerCase().includes(needle) ||
          r.symbol.toLowerCase().includes(needle),
      );
  }, [rows, q, tab, category]);

  // Map instrumentKey → all alerts on that instrument (a fund can carry
  // several — e.g. an upper + lower bound + a couple of % triggers).
  const alertsByKey = useMemo(() => {
    const m = new Map<string, IndexFundAlert[]>();
    for (const a of alerts.data ?? []) {
      const list = m.get(a.instrumentKey);
      if (list) list.push(a);
      else m.set(a.instrumentKey, [a]);
    }
    return m;
  }, [alerts.data]);

  // Open the modal to EDIT an existing alert (from the panel or a row bell
  // when a fund has exactly one alert).
  const openEdit = useCallback(
    (a: IndexFundAlert) => {
      const fund = rows.find((r) => r.key === a.instrumentKey);
      setTarget({
        instrumentKey: a.instrumentKey,
        instrumentType: a.instrumentType as "etf" | "mf",
        name: a.name,
        symbol: a.symbol,
        currentPrice: fund?.quote.price ?? null,
        existing: {
          id: a.id,
          mode: a.mode as "amount" | "percent",
          condition: a.condition as "above" | "below",
          threshold: Number(a.threshold),
          basePrice: a.basePrice != null ? Number(a.basePrice) : null,
          channels: safeParseChannels(a.channels),
          enabled: a.enabled,
        },
      });
    },
    [rows],
  );

  // Open the modal to CREATE a fresh alert on a fund.
  const openCreate = useCallback((r: FundRow) => {
    setTarget({
      instrumentKey: r.key,
      instrumentType: r.type,
      name: r.name,
      symbol: r.symbol,
      currentPrice: r.quote.price,
    });
  }, []);

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
            <Activity className="h-4 w-4" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Admin · IndexPulse
            </span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            Index funds &amp; ETFs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Live NSE ETF prices + AMFI index-fund NAVs. Set alerts, get
            pinged.
          </p>
        </div>
        <button
          onClick={() => {
            funds.refetch();
            toast.message("Refreshing quotes…");
          }}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${funds.isFetching ? "animate-spin" : ""}`}
            aria-hidden
          />
          Refresh
        </button>
      </div>

      {/* Active alerts */}
      <AlertsPanel alerts={alerts.data ?? []} onEdit={openEdit} />

      {/* Controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-violet-500 dark:border-slate-700">
          <Search className="h-4 w-4 text-slate-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search NIFTYBEES, gold, sensex…"
            className="w-full bg-transparent py-2.5 text-sm outline-none dark:text-slate-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-slate-200 p-0.5 dark:border-slate-700">
            {(
              [
                ["all", "All"],
                ["etf", "ETFs"],
                ["mf", "Index funds"],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  tab === key
                    ? "bg-violet-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All categories" : c}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-slate-400">
            {filtered.length} instruments
          </span>
        </div>
      </div>

      {/* List */}
      {funds.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900"
            />
          ))}
        </div>
      ) : funds.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          Couldn&apos;t load the catalog. {funds.error?.message}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          No instruments match your filters.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {filtered.map((r) => (
            <FundListItem
              key={r.key}
              row={r}
              alerts={alertsByKey.get(r.key) ?? []}
              onCreate={() => openCreate(r)}
              onEdit={openEdit}
            />
          ))}
        </ul>
      )}

      <p className="pb-4 text-center text-[11px] text-slate-400">
        ETF prices via Yahoo Finance (delayed, unofficial) · index-fund NAVs
        via AMFI (updated once daily). For information only — not investment
        advice.
      </p>

      {target && (
        <AlertModal
          key={target.instrumentKey + (target.existing?.id ?? "")}
          target={target}
          onClose={() => setTarget(null)}
        />
      )}
    </main>
  );
}

function FundListItem({
  row,
  alerts,
  onCreate,
  onEdit,
}: {
  row: FundRow;
  alerts: IndexFundAlert[];
  onCreate: () => void;
  onEdit: (a: IndexFundAlert) => void;
}) {
  const { quote } = row;
  const up = (quote.changePct ?? 0) >= 0;
  const count = alerts.length;
  const armed = count > 0;
  // Bell: no alerts → create; exactly one → edit it (no accidental dupes);
  // several → add another (edits happen in the Active alerts panel).
  const onBell = () => {
    if (count === 1) onEdit(alerts[0]);
    else onCreate();
  };
  return (
    <li className="flex items-center gap-3 bg-white px-3 py-3 transition hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 sm:px-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {row.name}
          </span>
          {armed && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 text-violet-500"
              aria-label={`${count} alert${count > 1 ? "s" : ""} set`}
            >
              <BellRing className="h-3.5 w-3.5" aria-hidden />
              {count > 1 && (
                <span className="text-[10px] font-semibold tabular-nums">
                  {count}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              row.type === "etf"
                ? "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
            }`}
          >
            {row.type === "etf" ? "ETF" : "MF"}
          </span>
          <span className="truncate">
            {row.category} · {row.symbol}
          </span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        {quote.price != null ? (
          <>
            <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              ₹{quote.price.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            {quote.changePct != null ? (
              <div
                className={`flex items-center justify-end gap-0.5 text-xs font-medium tabular-nums ${
                  up
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {up ? (
                  <TrendingUp className="h-3 w-3" aria-hidden />
                ) : (
                  <TrendingDown className="h-3 w-3" aria-hidden />
                )}
                {up ? "+" : ""}
                {quote.changePct.toFixed(2)}%
              </div>
            ) : (
              <div className="text-[11px] text-slate-400">NAV</div>
            )}
          </>
        ) : (
          <div className="text-xs text-slate-400">—</div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {/* When exactly one alert exists, the bell edits it — so offer a
            distinct "add another" affordance alongside. */}
        {count === 1 && (
          <button
            onClick={onCreate}
            aria-label="Add another alert"
            title="Add another alert"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onBell}
          aria-label={
            count === 0
              ? "Set alert"
              : count === 1
                ? "Edit alert"
                : "Add another alert"
          }
          className={`rounded-full p-2 transition ${
            armed
              ? "bg-violet-100 text-violet-600 hover:bg-violet-200 dark:bg-violet-950/50 dark:text-violet-300"
              : "text-slate-400 hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-800"
          }`}
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function AlertsPanel({
  alerts,
  onEdit,
}: {
  alerts: IndexFundAlert[];
  onEdit: (a: IndexFundAlert) => void;
}) {
  const utils = trpc.useUtils();
  const toggle = trpc.indexpulse.toggleAlert.useMutation({
    onSuccess: () => utils.indexpulse.listAlerts.invalidate(),
  });
  const del = trpc.indexpulse.deleteAlert.useMutation({
    onSuccess: () => {
      utils.indexpulse.listAlerts.invalidate();
      toast.success("Alert removed.");
    },
  });

  if (!alerts || alerts.length === 0) return null;

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/60 dark:bg-violet-950/20 sm:p-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
        <BellRing className="h-3.5 w-3.5" aria-hidden />
        Active alerts ({alerts.length})
      </h2>
      <ul className="space-y-1.5">
        {alerts.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm dark:bg-slate-900"
          >
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {a.name}
              </span>{" "}
              <span className="text-slate-500 dark:text-slate-400">
                {a.mode === "percent" ? (
                  <>
                    {Number(a.threshold) < 0 ? "↓ −" : "↑ +"}
                    {Math.abs(Number(a.threshold)).toLocaleString("en-IN")}%
                    {a.basePrice != null && (
                      <>
                        {" from ₹"}
                        {Number(a.basePrice).toLocaleString("en-IN")}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {a.condition === "above" ? "↑ above" : "↓ below"} ₹
                    {Number(a.threshold).toLocaleString("en-IN")}
                  </>
                )}
              </span>
              {isRecentlyTriggered(a.lastTriggeredAt) && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                  <BellRing className="h-3 w-3" aria-hidden /> triggered
                </span>
              )}
            </span>
            <span className="hidden shrink-0 gap-1 sm:flex">
              {safeParseChannels(a.channels).map((c) => (
                <span
                  key={c}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                >
                  {c === "in_app" ? "in-app" : c}
                </span>
              ))}
            </span>
            <button
              onClick={() => toggle.mutate({ id: a.id, enabled: !a.enabled })}
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                a.enabled
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {a.enabled ? "On" : "Off"}
            </button>
            <button
              onClick={() => onEdit(a)}
              aria-label="Edit alert"
              className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => del.mutate({ id: a.id })}
              aria-label="Delete alert"
              className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** True if the alert fired within the last 24h — drives the in-app
 *  "triggered" badge (the in_app delivery channel). */
function isRecentlyTriggered(at: Date | string | null): boolean {
  if (!at) return false;
  const t = new Date(at).getTime();
  return Number.isFinite(t) && Date.now() - t < 24 * 60 * 60 * 1000;
}

function safeParseChannels(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
