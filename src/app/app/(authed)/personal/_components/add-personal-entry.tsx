"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Mic, MicOff, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { COMMON_CURRENCIES } from "@/lib/fx";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  DEFAULT_CATEGORY,
  toCategoryKey,
  type CategoryKey,
} from "@/lib/categories";
import { detectCategory } from "@/lib/category-detect";
import { parseVoiceTranscript } from "@/lib/voice-input";
import { useVoiceInput } from "@/lib/use-voice-input";
import { useMutationWithQueue } from "@/lib/offline/use-mutation-with-queue";

export type EntryType = "income" | "expense" | "investment";

export type EditingPersonalEntry = {
  id: string;
  type: EntryType;
  amount: number;
  currency: string;
  category: string | null;
  description: string;
  occurredAt: Date | string;
};

const TYPE_META: Record<
  EntryType,
  { label: string; emoji: string; defaultCategory: CategoryKey; chip: string }
> = {
  income: {
    label: "Income",
    emoji: "💰",
    defaultCategory: "income",
    chip:
      "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
  },
  expense: {
    label: "Expense",
    emoji: "💸",
    defaultCategory: "other",
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  },
  investment: {
    label: "Investment",
    emoji: "📈",
    defaultCategory: "investment",
    chip: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300",
  },
};

export function AddPersonalEntry({
  editing,
  onDone,
  onCancel,
}: {
  editing?: EditingPersonalEntry | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const isEditing = Boolean(editing);

  const [type, setType] = useState<EntryType>(editing?.type ?? "expense");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [amount, setAmount] = useState<number | "">(editing?.amount ?? "");
  const [currency, setCurrency] = useState(editing?.currency ?? "INR");
  const [category, setCategory] = useState<CategoryKey>(
    toCategoryKey(editing?.category ?? null),
  );
  const [categoryTouched, setCategoryTouched] = useState<boolean>(
    Boolean(editing?.category),
  );
  const [occurredAt, setOccurredAt] = useState<string>(
    () =>
      (editing?.occurredAt
        ? new Date(editing.occurredAt)
        : new Date()
      )
        .toISOString()
        .slice(0, 10),
  );
  // "Make this recurring" — when checked on a NEW entry, after save we
  // also create a personal_recurrences row for the same fields. Disabled
  // when editing (use the Recurrences card directly for those).
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [recurrenceDay, setRecurrenceDay] = useState<number>(
    new Date().getDate(),
  );
  // Progressive disclosure — category, date, and the "make recurring"
  // checkbox hide behind a summary chip until the user taps to edit.
  // Open by default when editing an existing entry.
  const [showDetails, setShowDetails] = useState<boolean>(Boolean(editing));

  // Auto-detect category from description (same heuristics as group expenses).
  // Skips once the user has clicked a chip — explicit picks win.
  const detected = useMemo(() => detectCategory(description), [description]);
  useEffect(() => {
    if (categoryTouched) return;
    if (!detected) return;
    if (detected === category) return;
    queueMicrotask(() => setCategory(detected));
  }, [detected, categoryTouched, category]);

  // Re-seed defaults when type flips, but only if the user hasn't already
  // picked a category for this entry.
  useEffect(() => {
    if (categoryTouched) return;
    const def = TYPE_META[type].defaultCategory;
    queueMicrotask(() => setCategory(def));
  }, [type, categoryTouched]);

  const voice = useVoiceInput({
    lang: "en-IN",
    onResult: (transcript) => {
      const parsed = parseVoiceTranscript(transcript);
      if (parsed.description) setDescription(parsed.description);
      if (typeof parsed.amount === "number" && parsed.amount > 0) {
        setAmount(parsed.amount);
      }
      // Auto-detect category from the voice description — only if
      // the user hasn't manually overridden the picker yet. Doesn't
      // mark category as "touched" so the type-default reset still
      // applies if they later change income/expense/investment.
      if (parsed.description && !categoryTouched) {
        const guess = detectCategory(parsed.description);
        if (guess) setCategory(guess);
      }
    },
    onError: (err) => {
      if (err === "no-speech" || err === "aborted") return;
      toast.error(`Voice input: ${err}`);
    },
  });

  const numericAmount = typeof amount === "number" ? amount : 0;
  const valid = numericAmount > 0;

  const utils = trpc.useUtils();
  const createMutation = trpc.personal.create.useMutation();
  const updateMutation = trpc.personal.update.useMutation();
  const recurrenceCreateMutation =
    trpc.personal.recurrences.create.useMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Optimistically prepend a queued create into the list cache for the
  // entry's own month, so the user sees their row immediately while
  // offline. _pending lets the row class indicate "syncs later" if we
  // ever surface that in the UI.
  const submitCreate = useMutationWithQueue("personal.create", createMutation, {
    onQueued: (rawInput, clientEventId) => {
      const i = rawInput as {
        type: EntryType;
        amount: number;
        currency: string;
        category: string;
        description: string;
        occurredAt: Date;
      };
      const occurred = i.occurredAt ?? new Date();
      const monthKey = `${occurred.getFullYear()}-${String(occurred.getMonth() + 1).padStart(2, "0")}`;
      utils.personal.list.setData({ month: monthKey }, (old) => {
        const optimistic = {
          id: clientEventId,
          userId: "",
          type: i.type,
          amount: i.amount,
          currency: i.currency,
          category: i.category,
          description: i.description,
          occurredAt: occurred,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          _pending: true,
        } as unknown as NonNullable<typeof old>[number];
        return old ? [optimistic, ...old] : [optimistic];
      });
    },
  });

  // For update we don't know which month-cache the row currently lives
  // in (user could be editing a row whose occurredAt moved to a different
  // month). Map any cached row matching the id in the entry's-new month
  // bucket; if the row isn't there yet, the replayed mutation will fix
  // it on sync.
  const submitUpdate = useMutationWithQueue("personal.update", updateMutation, {
    onQueued: (rawInput) => {
      const i = rawInput as {
        id: string;
        type: EntryType;
        amount: number;
        currency: string;
        category: string;
        description: string;
        occurredAt: Date;
      };
      const occurred = i.occurredAt ?? new Date();
      const monthKey = `${occurred.getFullYear()}-${String(occurred.getMonth() + 1).padStart(2, "0")}`;
      utils.personal.list.setData({ month: monthKey }, (old) => {
        if (!old) return old;
        return old.map((e) =>
          e.id === i.id
            ? ({
                ...e,
                type: i.type,
                amount: i.amount,
                currency: i.currency,
                category: i.category,
                description: i.description,
                occurredAt: occurred,
                _pending: true,
              } as typeof e)
            : e,
        );
      });
    },
  });

  const reset = () => {
    setDescription("");
    setAmount("");
    setCurrency("INR");
    setType("expense");
    setCategory(DEFAULT_CATEGORY);
    setCategoryTouched(false);
    setOccurredAt(new Date().toISOString().slice(0, 10));
    setMakeRecurring(false);
    setRecurrenceDay(new Date().getDate());
  };

  const handleSubmit = async () => {
    if (!valid) return;
    try {
      // Parse the YYYY-MM-DD picker value as UTC midnight, NOT local
      // midnight. The old `new Date(\`${occurredAt}T00:00:00\`)` form
      // parses as the user's local timezone — so an IST user picking
      // "2026-06-01" produced 2026-05-31T18:30:00Z, which falls into
      // May from the server's UTC month-bounds POV. Net-this-month
      // and the trend bars would silently miss those entries.
      const [oy, om, od] = occurredAt.split("-").map(Number);
      const occurred = new Date(Date.UTC(oy, om - 1, od));
      if (editing) {
        const { queued } = await submitUpdate({
          id: editing.id,
          type,
          amount: numericAmount,
          currency,
          category,
          description: description.trim(),
          occurredAt: occurred,
          clientUpdatedAt: new Date(),
        });
        // The queue helper already toasts "Saved offline" — only toast
        // the green path here so we don't double-up.
        if (!queued) toast.success("Entry updated");
      } else {
        const { queued } = await submitCreate({
          type,
          amount: numericAmount,
          currency,
          category,
          description: description.trim(),
          occurredAt: occurred,
        });
        // Recurrence creation isn't on the offline queue path — skip it
        // when offline; user can re-toggle "Make recurring" on the
        // dedicated card once connectivity is back. Failure here doesn't
        // roll back the entry either.
        if (
          !queued &&
          makeRecurring &&
          recurrenceDay >= 1 &&
          recurrenceDay <= 31
        ) {
          try {
            await recurrenceCreateMutation.mutateAsync({
              type,
              amount: numericAmount,
              description: description.trim(),
              category,
              currency,
              scheduleDay: recurrenceDay,
            });
            utils.personal.recurrences.list.invalidate();
            toast.success(
              `Entry added · also recurring on day ${recurrenceDay}`,
            );
          } catch (err) {
            toast.error(
              err instanceof Error
                ? `Recurrence failed: ${err.message}`
                : "Recurrence creation failed",
            );
          }
        } else if (!queued) {
          toast.success("Entry added");
        }
        reset();
      }
      // Online: refresh server-truth caches. Offline: invalidate is
      // harmless — refetch attempts will fail, but onQueued already
      // wrote the optimistic row into the cache above.
      utils.personal.list.invalidate();
      utils.personal.summary.invalidate();
      utils.personal.topCategoriesThisMonth.invalidate();
      utils.personal.availableMonths.invalidate();
      // monthlyTrend powers the "Last 6 months" bar chart on the
      // Trends card — it was missing from the invalidation set, so
      // bars only refreshed on a hard reload.
      utils.personal.monthlyTrend.invalidate();
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30 sm:p-4">
      {isEditing && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Edit entry</h3>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <X className="h-3 w-3" aria-hidden /> Cancel
            </button>
          )}
        </div>
      )}

      <div>
        <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
          Type
        </span>
        <div className="mt-1 grid grid-cols-3 gap-1.5 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          {(["income", "expense", "investment"] as const).map((t) => {
            const meta = TYPE_META[t];
            const active = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={active}
                className={`flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition sm:gap-1.5 sm:px-2 sm:text-sm ${
                  active
                    ? t === "income"
                      ? "bg-green-500 text-white"
                      : t === "expense"
                        ? "bg-rose-500 text-white"
                        : "bg-cyan-500 text-white"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <span aria-hidden>{meta.emoji}</span>
                <span className="truncate">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-stretch gap-1.5">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              voice.listening
                ? "Listening…"
                : type === "income"
                  ? "What's this income for?"
                  : type === "investment"
                    ? "What's this investment?"
                    : "What's this expense for?"
            }
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
            aria-label="Entry description"
          />
          {voice.supported && (
            <button
              type="button"
              onClick={() => (voice.listening ? voice.stop() : voice.start())}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? "Stop dictation" : "Dictate"}
              className={`grid h-auto w-10 shrink-0 place-items-center rounded-lg border transition ${
                voice.listening
                  ? "animate-pulse border-rose-400 bg-rose-500 text-white"
                  : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {voice.listening ? (
                <MicOff className="h-4 w-4" aria-hidden />
              ) : (
                <Mic className="h-4 w-4" aria-hidden />
              )}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white pr-2 dark:border-slate-700 dark:bg-slate-900">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="0"
            className="w-full bg-transparent px-3 py-2 text-base outline-none tabular-nums"
            aria-label="Amount"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="border-l border-slate-300 bg-transparent py-2 pl-2 text-xs font-semibold text-slate-600 outline-none dark:border-slate-700 dark:text-slate-300"
            aria-label="Currency"
          >
            {COMMON_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!showDetails ? (
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-xs text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20"
        >
          <span className="min-w-0 flex-1 truncate">
            <span aria-hidden>{CATEGORIES[category].emoji}</span>{" "}
            {CATEGORIES[category].label}
            {" · "}
            {occurredAt === new Date().toISOString().slice(0, 10)
              ? "Today"
              : new Date(`${occurredAt}T00:00:00`).toLocaleDateString(
                  undefined,
                  { day: "numeric", month: "short" },
                )}
          </span>
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-400">
            Edit
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-slate-400"
            aria-hidden
          />
        </button>
      ) : (
      <>
      <div>
        <div className="flex items-baseline justify-between">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Category
          </span>
          {!categoryTouched && detected && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Auto-detected from description
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {CATEGORY_KEYS.map((key) => {
            const meta = CATEGORIES[key];
            const active = category === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setCategory(key);
                  setCategoryTouched(true);
                }}
                aria-pressed={active}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? `${meta.chipClass} border-current/20 ring-2 ring-current/20`
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <span aria-hidden>{meta.emoji}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
          Date
        </span>
        <input
          type="date"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          // Allow future dates (scheduled rent, planned salary, etc.).
          // Keep the 5-year-past floor so an off-by-decade tap doesn't
          // skew the trend; no cap on the future side.
          min={(() => {
            const d = new Date();
            d.setFullYear(d.getFullYear() - 5);
            return d.toISOString().slice(0, 10);
          })()}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 sm:w-auto"
        />
      </label>

      {/* Make-recurring checkbox — only on new entries (editing existing
          ones routes to the dedicated Recurrences card to avoid coupling
          edits to schedule changes). */}
      {!isEditing && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={makeRecurring}
              onChange={(e) => setMakeRecurring(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-violet-400 text-violet-600 focus:ring-violet-500 dark:border-violet-700 dark:bg-slate-900"
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium">Make this recurring</span>
              <span className="ml-1 text-[11px] text-slate-500 dark:text-slate-400">
                — auto-add the same amount every month
              </span>
            </span>
          </label>
          {makeRecurring && (
            <label className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-slate-600 dark:text-slate-300">
                Day of month
              </span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                value={recurrenceDay}
                onChange={(e) =>
                  setRecurrenceDay(
                    Math.min(31, Math.max(1, Number(e.target.value) || 1)),
                  )
                }
                className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <span className="text-[10.5px] text-slate-400">
                (29-31 fall back to last day in shorter months)
              </span>
            </label>
          )}
        </div>
      )}
      </>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!valid || isPending}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:bg-slate-300 disabled:dark:bg-slate-700 sm:w-auto ${
          isEditing
            ? "bg-indigo-600 hover:bg-indigo-500"
            : "bg-emerald-600 hover:bg-emerald-500"
        }`}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : isEditing ? null : (
          <Plus className="h-4 w-4" aria-hidden />
        )}
        {isEditing ? "Save changes" : `Add ${TYPE_META[type].label.toLowerCase()}`}
      </button>
    </div>
  );
}
