"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { markFirstActionDone } from "@/lib/use-install-prompt";
import { equalSplits, type SplitMode } from "@/lib/calculators/trip-split";
import { formatINR } from "@/lib/format";
import { COMMON_CURRENCIES, getRate } from "@/lib/fx";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  DEFAULT_CATEGORY,
  toCategoryKey,
  type CategoryKey,
} from "@/lib/categories";
import { detectCategory } from "@/lib/category-detect";
import { splitsFromItems } from "@/lib/itemized-splits";
import { parseVoiceTranscript } from "@/lib/voice-input";
import { useVoiceInput } from "@/lib/use-voice-input";
import { useMutationWithQueue } from "@/lib/offline/use-mutation-with-queue";

const EPSILON = 0.01;

type EditingExpense = {
  id: string;
  description: string;
  /** Original amount (in `currency`). */
  amount: number;
  currency: string;
  /** Stored FX rate at time of original entry — used to back-convert splits. */
  fxRate: number;
  payerId: string;
  splitMode: SplitMode;
  category?: string | null;
  /** Splits in primary currency (as stored in DB). */
  splits: { userId: string; amount: number }[];
  /** Optional line items if the expense was created in itemized mode. */
  items?: {
    id: string;
    description: string;
    amount: number;
    sharerIds: string[];
  }[];
};

type ItemDraft = {
  description: string;
  amount: number | "";
  sharerIds: string[];
};

const blankItem = (sharerIds: string[]): ItemDraft => ({
  description: "",
  amount: "",
  sharerIds,
});

export function AddExpense({
  groupId,
  primaryCurrency,
  members,
  currentUserId,
  editing,
  onSuccess,
  onCancel,
}: {
  groupId: string;
  primaryCurrency: string;
  members: { id: string; name: string }[];
  /** Drives "Just me" + "Except me" quick-picks and the default payer.
   *  Optional so callers without auth context (tests, calculators) work. */
  currentUserId?: string | null;
  editing?: EditingExpense | null;
  onSuccess: (queued: boolean) => void;
  onCancel?: () => void;
}) {
  const isEditing = Boolean(editing);
  // Threshold at which we add a search input + quick-pick buttons to
  // the member picker. Below this, the chip list is fine on its own.
  const LARGE_GROUP_THRESHOLD = 8;
  const isLargeGroup = members.length >= LARGE_GROUP_THRESHOLD;

  const [description, setDescription] = useState(editing?.description ?? "");
  const [amount, setAmount] = useState<number | "">(editing?.amount ?? "");
  const [currency, setCurrency] = useState<string>(
    editing?.currency ?? primaryCurrency,
  );
  const [payerId, setPayerId] = useState<string>(
    editing?.payerId ??
      (currentUserId && members.some((m) => m.id === currentUserId)
        ? currentUserId
        : members[0]?.id ?? ""),
  );
  const [memberSearch, setMemberSearch] = useState("");
  const [splitMode, setSplitMode] = useState<SplitMode>(
    editing?.splitMode ?? "equal",
  );
  const [category, setCategory] = useState<CategoryKey>(
    toCategoryKey(editing?.category),
  );
  // True once the user has explicitly clicked a category chip. Once they
  // have, we stop auto-applying detected categories — their pick wins.
  const [categoryTouched, setCategoryTouched] = useState<boolean>(
    Boolean(editing?.category),
  );
  const [sharerIds, setSharerIds] = useState<string[]>(
    editing?.splits.map((s) => s.userId) ?? members.map((m) => m.id),
  );
  const [exactByPerson, setExactByPerson] = useState<Record<string, number>>(
    () => {
      if (editing && editing.splitMode === "exact") {
        const m: Record<string, number> = {};
        // Stored splits are in primary currency. Back-convert to the
        // expense's original currency so the form shows what the user
        // typed originally (with small rounding artefacts at 2dp).
        const rate = editing.fxRate || 1;
        for (const s of editing.splits) {
          m[s.userId] = Math.round((s.amount / rate) * 100) / 100;
        }
        return m;
      }
      return {};
    },
  );

  // Voice input — single-click mic dictates description + (best-effort) amount.
  // Browser Web Speech API; en-IN locale by default for Indian numerals.
  const voice = useVoiceInput({
    lang: "en-IN",
    onResult: (transcript) => {
      const parsed = parseVoiceTranscript(transcript);
      if (parsed.description) setDescription(parsed.description);
      if (typeof parsed.amount === "number" && parsed.amount > 0) {
        setAmount(parsed.amount);
      }
    },
    onError: (err) => {
      // 'no-speech' and 'aborted' are normal user-cancellations; suppress.
      if (err === "no-speech" || err === "aborted") return;
      toast.error(`Voice input: ${err}`);
    },
  });

  // Itemized mode — each row in `items` is a line of the bill.
  const [mode, setMode] = useState<"single" | "items">(
    editing?.items && editing.items.length > 0 ? "items" : "single",
  );
  const [items, setItems] = useState<ItemDraft[]>(
    editing?.items && editing.items.length > 0
      ? editing.items.map((it) => ({
          description: it.description,
          amount: it.amount,
          sharerIds: it.sharerIds,
        }))
      : [blankItem(members.map((m) => m.id))],
  );

  // Local keyword-based category detection. Runs on every description
  // change but skips once the user has clicked a chip — their pick wins.
  // Synchronous regex match, no debounce needed.
  const detectedCategory = useMemo(
    () => detectCategory(description),
    [description],
  );
  useEffect(() => {
    if (categoryTouched) return;
    if (!detectedCategory) return;
    if (detectedCategory === category) return;
    // Deferred to a microtask so React 19's set-state-in-effect lint
    // is satisfied — matches the convention used elsewhere in the app.
    queueMicrotask(() => setCategory(detectedCategory));
  }, [detectedCategory, categoryTouched, category]);

  // Live FX preview for non-primary expenses. We only render once the rate
  // has been fetched — no loading state in between, the API is fast (~150ms).
  const [livePreview, setLivePreview] = useState<{
    rate: number;
    converted: number;
  } | null>(null);
  const numericForFx = typeof amount === "number" ? amount : 0;

  useEffect(() => {
    // Stale livePreview is harmless — the display gates on currency !== primary
    // && numericForFx > 0, so a previous rate isn't shown for the wrong amount.
    if (currency === primaryCurrency || numericForFx <= 0) return;
    let cancelled = false;
    getRate(currency, primaryCurrency)
      .then((rate) => {
        if (!cancelled) {
          setLivePreview({
            rate,
            converted: Math.round(numericForFx * rate * 100) / 100,
          });
        }
      })
      .catch(() => {
        // Network/API failure — preview just stays at its last value (or null
        // initial). Submit will surface a server-side error if needed.
      });
    return () => {
      cancelled = true;
    };
  }, [currency, primaryCurrency, numericForFx]);

  const numericAmount = typeof amount === "number" ? amount : 0;

  const exactTotal = useMemo(
    () => sharerIds.reduce((sum, id) => sum + (exactByPerson[id] ?? 0), 0),
    [exactByPerson, sharerIds],
  );
  const exactDelta = numericAmount - exactTotal;

  const utils = trpc.useUtils();

  const createMutation = trpc.expenses.create.useMutation();
  const updateMutation = trpc.expenses.update.useMutation();

  const submitCreate = useMutationWithQueue("expenses.create", createMutation, {
    onQueued: (rawInput, clientEventId) => {
      const i = rawInput as {
        groupId: string;
        description: string;
        amount: number;
        currency: string;
        payerId: string;
        splitMode: SplitMode;
        category: CategoryKey;
        splits: { userId: string; amount: number }[];
      };
      // Optimistically add to the expenses list so the user sees their
      // change immediately. convertedAmount is wrong if currency != primary;
      // sync will correct it.
      utils.expenses.listByGroup.setData({ groupId: i.groupId }, (old) => {
        if (!old) return old;
        const optimistic = {
          id: clientEventId,
          groupId: i.groupId,
          description: i.description,
          amount: i.amount,
          currency: i.currency,
          convertedAmount:
            i.currency === primaryCurrency ? i.amount : i.amount,
          fxRate: 1,
          payerId: i.payerId,
          splitMode: i.splitMode,
          category: i.category,
          occurredAt: new Date(),
          createdBy: i.payerId,
          createdAt: new Date(),
          updatedAt: new Date(),
          splits: i.splits,
          _pending: true,
        } as unknown as (typeof old)[number];
        return [optimistic, ...old];
      });
    },
  });
  const submitUpdate = useMutationWithQueue("expenses.update", updateMutation, {
    onQueued: (rawInput) => {
      const i = rawInput as {
        id: string;
        description: string;
        amount: number;
        currency: string;
        payerId: string;
        splitMode: SplitMode;
        category: CategoryKey;
        splits: { userId: string; amount: number }[];
      };
      utils.expenses.listByGroup.setData({ groupId }, (old) => {
        if (!old) return old;
        return old.map((e) =>
          e.id === i.id
            ? ({
                ...e,
                description: i.description,
                amount: i.amount,
                currency: i.currency,
                convertedAmount: i.amount,
                payerId: i.payerId,
                splitMode: i.splitMode,
                category: i.category,
                splits: i.splits,
                _pending: true,
              } as typeof e)
            : e,
        );
      });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const itemsTotal = useMemo(
    () =>
      Math.round(
        items.reduce(
          (s, it) => s + (typeof it.amount === "number" ? it.amount : 0),
          0,
        ) * 100,
      ) / 100,
    [items],
  );

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setExactByPerson({});
    setSplitMode("equal");
    setCategory(DEFAULT_CATEGORY);
    setCategoryTouched(false);
    setSharerIds(members.map((m) => m.id));
    setMode("single");
    setItems([blankItem(members.map((m) => m.id))]);
  };

  const buildSplits = () => {
    if (mode === "items") {
      return splitsFromItems(
        items
          .filter(
            (it) => typeof it.amount === "number" && it.amount > 0 && it.sharerIds.length > 0,
          )
          .map((it) => ({ amount: it.amount as number, sharerIds: it.sharerIds })),
      );
    }
    if (splitMode === "equal") {
      return equalSplits(numericAmount, sharerIds).map((s) => ({
        userId: s.personId,
        amount: s.amount,
      }));
    }
    return sharerIds.map((id) => ({
      userId: id,
      amount: exactByPerson[id] ?? 0,
    }));
  };

  const valid = (() => {
    if (mode === "items") {
      if (!payerId) return false;
      if (items.length === 0) return false;
      if (itemsTotal <= 0) return false;
      for (const it of items) {
        if (typeof it.amount !== "number" || it.amount <= 0) return false;
        if (it.sharerIds.length === 0) return false;
      }
      return true;
    }
    if (numericAmount <= 0) return false;
    if (!payerId) return false;
    if (sharerIds.length === 0) return false;
    if (splitMode === "exact" && Math.abs(exactDelta) > EPSILON) return false;
    return true;
  })();

  const onSplitModeChange = (mode: SplitMode) => {
    if (mode === "exact" && numericAmount > 0 && sharerIds.length > 0) {
      const per = Math.round((numericAmount / sharerIds.length) * 100) / 100;
      const fresh: Record<string, number> = {};
      for (const id of sharerIds) fresh[id] = per;
      setExactByPerson(fresh);
    }
    setSplitMode(mode);
  };

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  };

  const removeItem = (idx: number) => {
    setItems((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx),
    );
  };

  const addItem = () => {
    // Seed the new row's sharers from the previous row so adding another
    // line in a "shared by everyone" bill doesn't make you re-pick.
    const last = items[items.length - 1];
    setItems((prev) => [
      ...prev,
      blankItem(last?.sharerIds ?? members.map((m) => m.id)),
    ]);
  };

  const toggleItemSharer = (idx: number, id: string) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const has = it.sharerIds.includes(id);
        return {
          ...it,
          sharerIds: has
            ? it.sharerIds.filter((x) => x !== id)
            : [...it.sharerIds, id],
        };
      }),
    );
  };

  const balanceToLast = () => {
    if (sharerIds.length === 0) return;
    const last = sharerIds[sharerIds.length - 1];
    const rest = sharerIds
      .slice(0, -1)
      .reduce((sum, id) => sum + (exactByPerson[id] ?? 0), 0);
    setExactByPerson((m) => ({
      ...m,
      [last]: Math.round((numericAmount - rest) * 100) / 100,
    }));
  };

  const toggleSharer = (id: string) => {
    setSharerIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      if (!next.includes(id)) {
        setExactByPerson((m) => {
          const c = { ...m };
          delete c[id];
          return c;
        });
      }
      return next;
    });
  };

  const allSelected = sharerIds.length === members.length;
  const toggleAll = () => {
    setSharerIds(allSelected ? [] : members.map((m) => m.id));
    if (allSelected) setExactByPerson({});
  };

  const handleSubmit = async () => {
    if (!valid) return;
    try {
      let result: { queued: boolean };
      const submittingItems = mode === "items";
      const payloadAmount = submittingItems ? itemsTotal : numericAmount;
      const payloadSplitMode: SplitMode = submittingItems ? "exact" : splitMode;
      const payloadItems = submittingItems
        ? items.map((it) => ({
            description: it.description.trim(),
            amount: typeof it.amount === "number" ? it.amount : 0,
            sharerIds: it.sharerIds,
          }))
        : // Empty array tells the server "this is no longer itemized" on update;
          // server clears existing items rows. Sending undefined would leave them.
          editing && (editing.items?.length ?? 0) > 0
          ? []
          : undefined;
      if (editing) {
        result = await submitUpdate({
          id: editing.id,
          description: description.trim(),
          amount: payloadAmount,
          currency,
          payerId,
          splitMode: payloadSplitMode,
          category,
          splits: buildSplits(),
          ...(payloadItems !== undefined && { items: payloadItems }),
          // For last-write-wins conflict resolution. The server compares
          // this against the row's current updated_at; if a newer edit
          // exists, our update is rejected with CONFLICT.
          clientUpdatedAt: new Date(),
        });
      } else {
        result = await submitCreate({
          groupId,
          description: description.trim(),
          amount: payloadAmount,
          currency,
          payerId,
          splitMode: payloadSplitMode,
          category,
          splits: buildSplits(),
          ...(payloadItems !== undefined && { items: payloadItems }),
        });
        resetForm();
      }
      // Mark "first meaningful action" so the install-prompt banner can
      // start nudging this user (it stays silent until earned).
      markFirstActionDone();
      onSuccess(result.queued);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30 sm:p-4">
      {isEditing && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Edit expense</h3>
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
      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
        <div className="flex items-stretch gap-1.5">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              voice.listening
                ? "Listening… try “pizza six hundred”"
                : "What's this expense for?"
            }
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
            aria-label="Expense description"
          />
          {voice.supported && (
            <button
              type="button"
              onClick={() => (voice.listening ? voice.stop() : voice.start())}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? "Stop dictation" : "Dictate expense"}
              title={
                voice.listening
                  ? "Listening — tap to stop"
                  : "Dictate (e.g. “uber 350” or “pizza six hundred”)"
              }
              className={`grid h-auto w-10 shrink-0 place-items-center rounded-lg border transition ${
                voice.listening
                  ? "animate-pulse border-rose-400 bg-rose-500 text-white"
                  : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
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
        <div
          className={`flex items-center gap-1 rounded-lg border pr-2 dark:border-slate-700 ${
            mode === "items"
              ? "border-slate-200 bg-slate-100/60 dark:bg-slate-800/40"
              : "border-slate-300 bg-white dark:bg-slate-900"
          }`}
        >
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            value={mode === "items" ? itemsTotal || "" : amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            disabled={mode === "items"}
            placeholder="0"
            className="w-full bg-transparent px-3 py-2 text-base outline-none tabular-nums disabled:cursor-not-allowed disabled:text-slate-500"
            aria-label="Amount"
            title={mode === "items" ? "Computed from items" : undefined}
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

      {currency !== primaryCurrency && numericForFx > 0 && (
        <p className="-mt-1 text-xs text-slate-500 dark:text-slate-400">
          {livePreview
            ? `≈ ${formatINR(livePreview.converted, 0)} ${primaryCurrency} (1 ${currency} = ${livePreview.rate.toFixed(2)} ${primaryCurrency})`
            : `Fetching ${currency} → ${primaryCurrency} rate…`}
        </p>
      )}

      <div>
        <div className="flex items-baseline justify-between">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Category
          </span>
          {!categoryTouched && detectedCategory && (
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="block">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Paid by
          </span>
          <PayerSelect
            members={members}
            value={payerId}
            onChange={setPayerId}
            currentUserId={currentUserId ?? null}
          />
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Split mode
          </span>
          <div className="mt-1 grid grid-cols-3 gap-1.5 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            {(["equal", "exact", "items"] as const).map((opt) => {
              const active =
                opt === "items" ? mode === "items" : mode === "single" && splitMode === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    if (opt === "items") {
                      setMode("items");
                    } else {
                      setMode("single");
                      onSplitModeChange(opt);
                    }
                  }}
                  aria-pressed={active}
                  className={`rounded-md px-2 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-emerald-500 text-white"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {opt === "equal" ? "Equal" : opt === "exact" ? "Exact ₹" : "Itemized"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {mode === "single" ? (
      <div>
        <div className="flex items-baseline justify-between">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            {splitMode === "equal" ? "Split between" : "Each person owes"}
            <span className="ml-1.5 font-normal text-slate-400">
              · {sharerIds.length}/{members.length}
            </span>
          </span>
          {splitMode === "equal" && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              {allSelected ? "Clear" : "Select all"}
            </button>
          )}
        </div>

        {/* Search + quick-picks for larger groups — picking from a list
            of 15+ scrollable chips is painful. Below the threshold we
            keep the original chip-list-only UX to stay uncluttered. */}
        {isLargeGroup && splitMode === "equal" && (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <QuickPick
                label="Everyone"
                onClick={() => setSharerIds(members.map((m) => m.id))}
              />
              {currentUserId && members.some((m) => m.id === currentUserId) && (
                <>
                  <QuickPick
                    label="Just me"
                    onClick={() => setSharerIds([currentUserId])}
                  />
                  <QuickPick
                    label="Everyone except me"
                    onClick={() =>
                      setSharerIds(
                        members
                          .filter((m) => m.id !== currentUserId)
                          .map((m) => m.id),
                      )
                    }
                  />
                </>
              )}
            </div>
            <input
              type="search"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder={`Search ${members.length} members…`}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        )}

        {splitMode === "equal" ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {members
              .filter((m) =>
                memberSearch
                  ? m.name.toLowerCase().includes(memberSearch.toLowerCase())
                  : true,
              )
              .map((m) => {
              const selected = sharerIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleSharer(m.id)}
                  aria-pressed={selected}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    selected
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
            {isLargeGroup &&
              memberSearch &&
              members.filter((m) =>
                m.name.toLowerCase().includes(memberSearch.toLowerCase()),
              ).length === 0 && (
                <p className="w-full text-[11px] text-slate-500 dark:text-slate-400">
                  No members match &ldquo;{memberSearch}&rdquo;.
                </p>
              )}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {members.map((m) => {
              const included = sharerIds.includes(m.id);
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-2 rounded-lg border p-2 ${
                    included
                      ? "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
                      : "border-slate-200 bg-slate-50/60 opacity-60 dark:border-slate-800 dark:bg-slate-800/40"
                  }`}
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => toggleSharer(m.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{m.name}</span>
                  </label>
                  {included && (
                    <div className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950">
                      <span className="text-slate-400">
                        {primaryCurrency === "INR" ? "₹" : primaryCurrency}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={1}
                        value={exactByPerson[m.id] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setExactByPerson((map) => ({
                            ...map,
                            [m.id]: v === "" ? 0 : Number(v),
                          }));
                        }}
                        placeholder="0"
                        className="w-20 bg-transparent text-right outline-none tabular-nums"
                        aria-label={`${m.name}'s share`}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">
              <span className="text-slate-600 dark:text-slate-300">
                {formatINR(exactTotal, 2)} of {formatINR(numericAmount, 2)}
                {Math.abs(exactDelta) > EPSILON && (
                  <span className="ml-2 font-medium text-rose-600 dark:text-rose-400">
                    ({exactDelta > 0 ? "+" : "−"}
                    {formatINR(Math.abs(exactDelta), 2)} off)
                  </span>
                )}
              </span>
              {Math.abs(exactDelta) > EPSILON && sharerIds.length > 0 && (
                <button
                  type="button"
                  onClick={balanceToLast}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Auto-balance
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      ) : (
      <div>
        <div className="flex items-baseline justify-between">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Line items
          </span>
          <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
            Total: {formatINR(itemsTotal, 0)}
          </span>
        </div>
        <ul className="mt-2 space-y-3">
          {items.map((it, idx) => (
            <li
              key={idx}
              className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center gap-1.5">
                <input
                  value={it.description}
                  onChange={(e) =>
                    updateItem(idx, { description: e.target.value })
                  }
                  placeholder={`Item ${idx + 1}`}
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"
                  aria-label={`Item ${idx + 1} description`}
                />
                <div className="flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 dark:border-slate-700 dark:bg-slate-950">
                  <span className="text-xs text-slate-400">
                    {currency === "INR" ? "₹" : currency}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={1}
                    value={it.amount}
                    onChange={(e) =>
                      updateItem(idx, {
                        amount:
                          e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    placeholder="0"
                    className="w-16 bg-transparent py-1.5 text-right text-sm outline-none tabular-nums"
                    aria-label={`Item ${idx + 1} amount`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800"
                  aria-label={`Remove item ${idx + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const selected = it.sharerIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleItemSharer(idx, m.id)}
                      aria-pressed={selected}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                        selected
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      }`}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
              {it.sharerIds.length === 0 && (
                <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                  Pick at least one sharer for this item.
                </p>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addItem}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50/40 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add item
        </button>
      </div>
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
        {isEditing ? "Save changes" : "Add expense"}
      </button>
    </div>
  );
}

/** Small quick-pick chip — used for "Everyone / Just me / Except me"
 *  presets above the member chip list in larger groups. */
function QuickPick({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50/60 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
    >
      {label}
    </button>
  );
}

/**
 * Searchable payer combobox. Plain native <select> works at <8 members
 * but breaks at scale — you can't filter, scrolling is slow, names
 * become a wall of text. This renders the current selection as a
 * trigger button + opens a popover with a search input and filterable
 * list. Click outside / Esc closes.
 */
function PayerSelect({
  members,
  value,
  onChange,
  currentUserId,
}: {
  members: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  currentUserId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const selectedName =
    members.find((m) => m.id === value)?.name ?? "Choose payer";

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = search
    ? members.filter((m) =>
        m.name.toLowerCase().includes(search.toLowerCase()),
      )
    : members;

  return (
    <div ref={wrapRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none transition focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
      >
        <span className="truncate">{selectedName}</span>
        <span aria-hidden className="text-slate-400">
          ▾
        </span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {members.length >= 8 && (
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members…"
              className="w-full border-b border-slate-200 bg-transparent px-3 py-2 text-xs outline-none dark:border-slate-800"
            />
          )}
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                No match
              </li>
            ) : (
              filtered.map((m) => {
                const isSelf = m.id === currentUserId;
                const isSelected = m.id === value;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(m.id);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        isSelected
                          ? "bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : ""
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {m.name}
                        {isSelf && (
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[9.5px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            you
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <span
                          aria-hidden
                          className="text-emerald-500"
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
