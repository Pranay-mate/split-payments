"use client";

import { useMemo, useState } from "react";
import {
  calculateSplitBill,
  type RoundingMode,
} from "@/lib/calculators/split-bill";
import { formatINR } from "@/lib/format";

const TIP_PRESETS = [0, 5, 10, 15, 20];
const ROUNDING_OPTIONS: { value: RoundingMode; label: string }[] = [
  { value: "none", label: "Off" },
  { value: "10", label: "₹10" },
  { value: "50", label: "₹50" },
  { value: "100", label: "₹100" },
];

export function SplitBillForm() {
  const [billAmount, setBillAmount] = useState(1500);
  const [numPeople, setNumPeople] = useState(4);
  const [tipPercent, setTipPercent] = useState(10);
  const [extraServiceChargePercent, setExtraServiceChargePercent] = useState(0);
  const [rounding, setRounding] = useState<RoundingMode>("10");

  const result = useMemo(
    () =>
      calculateSplitBill({
        billAmount,
        numPeople,
        tipPercent,
        extraServiceChargePercent,
        rounding,
      }),
    [billAmount, numPeople, tipPercent, extraServiceChargePercent, rounding],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <NumberField
          id="bill"
          label="Bill amount"
          prefix="₹"
          value={billAmount}
          min={0}
          step={10}
          onChange={setBillAmount}
        />

        <NumberField
          id="people"
          label="Number of people"
          value={numPeople}
          min={1}
          max={50}
          step={1}
          onChange={setNumPeople}
        />

        <div>
          <label className="block text-sm font-medium">Tip</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIP_PRESETS.map((tip) => (
              <button
                key={tip}
                type="button"
                onClick={() => setTipPercent(tip)}
                aria-pressed={tipPercent === tip}
                className={`min-w-12 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  tipPercent === tip
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {tip}%
              </button>
            ))}
            <input
              type="number"
              inputMode="decimal"
              value={tipPercent}
              onChange={(e) => setTipPercent(Number(e.target.value))}
              className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              min={0}
              max={100}
              step={0.5}
              aria-label="Custom tip percentage"
            />
          </div>
        </div>

        <NumberField
          id="service"
          label="Extra service charge"
          suffix="%"
          value={extraServiceChargePercent}
          min={0}
          max={20}
          step={0.5}
          onChange={setExtraServiceChargePercent}
          help="Some restaurants already include this in the bill — set to 0 if so."
        />

        <div>
          <label className="block text-sm font-medium">
            Round each person up to
          </label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {ROUNDING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRounding(opt.value)}
                aria-pressed={rounding === opt.value}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  rounding === opt.value
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Cleaner amounts to UPI — small excess covers tip rounding.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-6 dark:border-slate-800 dark:from-indigo-950/40 dark:to-violet-950/40">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Each person pays
          </p>
          <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums">
            {formatINR(result.perPerson)}
          </p>
          {rounding !== "none" && result.roundingExcess > 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Raw share {formatINR(result.rawPerPerson)} · rounded up by{" "}
              {formatINR(result.roundingExcess / numPeople)}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Breakdown
          </h3>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Bill" value={formatINR(result.baseAmount)} />
            <Stat
              label={`Tip (${tipPercent}%)`}
              value={formatINR(result.tipAmount)}
            />
            {extraServiceChargePercent > 0 && (
              <Stat
                label={`Service (${extraServiceChargePercent}%)`}
                value={formatINR(result.serviceCharge)}
              />
            )}
            <Stat label="Grand total" value={formatINR(result.grandTotal)} />
            <Stat label="People" value={String(numPeople)} />
            {rounding !== "none" && result.roundingExcess > 0 && (
              <Stat
                label="Rounding excess"
                value={`+${formatINR(result.roundingExcess)}`}
              />
            )}
          </dl>
        </div>

        <button
          type="button"
          onClick={() => {
            const text = `Each: ${formatINR(result.perPerson)}\nBill: ${formatINR(result.baseAmount)} + ${tipPercent}% tip = ${formatINR(result.grandTotal)}\nSplit ${numPeople} ways · via EasySplits`;
            if (typeof navigator !== "undefined" && navigator.share) {
              navigator.share({ title: "Split bill", text }).catch(() => {});
            } else if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard.writeText(text).catch(() => {});
            }
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Share split with friends
        </button>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  min,
  max,
  step,
  help,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        {prefix && (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-full bg-transparent text-base outline-none tabular-nums"
        />
        {suffix && (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      {help && (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {help}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-b-0 dark:border-slate-800">
      <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
