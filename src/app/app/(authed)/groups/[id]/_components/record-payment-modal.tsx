"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { COMMON_CURRENCIES } from "@/lib/fx";

/**
 * Standalone "Record a payment" modal. Top-level entry point for
 * logging arbitrary member-to-member transfers — independent of the
 * Suggested Payments rows.
 *
 * Solves the discoverability gap where users couldn't record pre-trip
 * cash advances (no debt → no suggested row → no "Mark as paid" button).
 *
 * Server `settlements.create` already accepts `occurredAt`, so we expose
 * a date picker to backdate transfers ("I gave Dpk ₹2000 last Tuesday").
 */
export function RecordPaymentModal({
  groupId,
  primaryCurrency,
  members,
  currentUserId,
  open,
  onClose,
}: {
  groupId: string;
  primaryCurrency: string;
  members: { id: string; name: string }[];
  currentUserId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const createMutation = trpc.settlements.create.useMutation({
    onSuccess: () => {
      utils.settlements.listByGroup.invalidate({ groupId });
      utils.events.listByGroup.invalidate({ groupId });
    },
  });

  const [fromUserId, setFromUserId] = useState<string>("");
  const [toUserId, setToUserId] = useState<string>("");
  const [amount, setAmount] = useState<number | "">("");
  const [currency, setCurrency] = useState(primaryCurrency);
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 10),
  );

  // Re-seed defaults when the modal opens — current user as the "from"
  // (most common case: "I paid X"), first other member as the "to".
  // queueMicrotask wrap satisfies react-hooks/set-state-in-effect — same
  // pattern used elsewhere in the codebase for legitimate effect-driven
  // resets.
  useEffect(() => {
    if (!open) return;
    const me = currentUserId ?? "";
    const firstOther = members.find((m) => m.id !== me)?.id ?? "";
    queueMicrotask(() => {
      setFromUserId(me);
      setToUserId(firstOther);
      setAmount("");
      setCurrency(primaryCurrency);
      setNote("");
      setOccurredAt(new Date().toISOString().slice(0, 10));
    });
  }, [open, currentUserId, members, primaryCurrency]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const numericAmount = typeof amount === "number" ? amount : 0;
  const valid =
    fromUserId &&
    toUserId &&
    fromUserId !== toUserId &&
    numericAmount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    try {
      await createMutation.mutateAsync({
        groupId,
        fromUserId,
        toUserId,
        amount: numericAmount,
        note: note.trim(),
        occurredAt: new Date(`${occurredAt}T00:00:00`),
      });
      toast.success("Payment recorded");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Record a payment"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {/* Hero */}
        <div className="bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 px-5 py-5 text-white sm:px-6">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-white/85">
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Payment
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">
            Record a payment
          </h2>
          <p className="mt-1.5 text-[12px] text-white/95">
            Did someone pay another member directly? Cash, UPI, anything —
            log it here so balances stay accurate. Works for pre-trip
            advances too.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {/* From → To */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                From
              </span>
              <select
                value={fromUserId}
                onChange={(e) => setFromUserId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === currentUserId ? `${m.name} (you)` : m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                To
              </span>
              <select
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {members.map((m) => (
                  <option
                    key={m.id}
                    value={m.id}
                    disabled={m.id === fromUserId}
                  >
                    {m.id === currentUserId ? `${m.name} (you)` : m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {fromUserId === toUserId && (
            <p className="text-[11.5px] text-rose-600 dark:text-rose-400">
              From and To must be different.
            </p>
          )}

          {/* Amount + currency */}
          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Amount
            </span>
            <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white pr-2 dark:border-slate-700 dark:bg-slate-950">
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
                autoFocus
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

          {/* Date */}
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Date
            </span>
            <input
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 sm:w-auto"
            />
            <span className="ml-2 text-[10.5px] text-slate-500 dark:text-slate-400">
              Pick a past date for advances or back-fills
            </span>
          </label>

          {/* Note */}
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Note <span className="font-normal opacity-60">(optional)</span>
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. UPI advance · cash for groceries"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <button
            type="submit"
            disabled={!valid || createMutation.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
            )}
            Record payment
          </button>

          <p className="text-center text-[10.5px] text-slate-500 dark:text-slate-400">
            Settlements are visible in the group&apos;s activity feed and
            update Suggested Payments automatically.
          </p>
        </div>
      </form>
    </div>,
    document.body,
  );
}
