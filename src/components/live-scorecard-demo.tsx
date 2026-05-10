"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { computeScore, type ScoreInputs } from "@/lib/financial-score";
import { formatINR } from "@/lib/format";

/**
 * Live demo of the 5-pillar Financial Health Scorecard, embedded on the
 * landing page. Drives top-of-funnel: visitors see the actual product
 * (not a screenshot) before signing up.
 *
 * Three personas pre-fill the sliders so a visitor can compare profiles
 * in two clicks. Sliders themselves are live — every drag re-computes
 * the score in-memory using the same `computeScore` shipped with the
 * authed app, so the demo number is the real number.
 *
 * No persistence, no signup, no backend — pure client compute.
 */

type Persona = {
  key: string;
  label: string;
  hint: string;
  inputs: ScoreInputs;
};

const PERSONAS: Persona[] = [
  {
    key: "junior",
    label: "Junior dev · ₹8L CTC",
    hint: "1-2yrs in, no SIP yet, rents in Bangalore",
    inputs: {
      age: 24,
      retirementAge: 60,
      isFreelancer: false,
      hasDependents: false,
      hasCcCarryover: true,
      monthlyIncome: 55000,
      monthlyExpenses: 40000,
      liquidSavings: 60000,
      termCoverAmount: 0,
      healthCoverAmount: 500000,
      totalEmi: 0,
      investmentBalance: 30000,
      monthlyInvestment: 2000,
    },
  },
  {
    key: "mid",
    label: "Mid-career · ₹24L CTC",
    hint: "5yrs in, SIP runner, 1 EMI, married",
    inputs: {
      age: 30,
      retirementAge: 60,
      isFreelancer: false,
      hasDependents: true,
      hasCcCarryover: false,
      monthlyIncome: 175000,
      monthlyExpenses: 110000,
      liquidSavings: 800000,
      termCoverAmount: 15000000,
      healthCoverAmount: 1500000,
      totalEmi: 35000,
      investmentBalance: 1500000,
      monthlyInvestment: 30000,
    },
  },
  {
    key: "freelancer",
    label: "Freelancer · variable",
    hint: "Gig income, no PF, runs own taxes",
    inputs: {
      age: 32,
      retirementAge: 55,
      isFreelancer: true,
      hasDependents: false,
      hasCcCarryover: false,
      monthlyIncome: 130000,
      monthlyExpenses: 75000,
      liquidSavings: 1200000,
      termCoverAmount: 10000000,
      healthCoverAmount: 1000000,
      totalEmi: 0,
      investmentBalance: 800000,
      monthlyInvestment: 18000,
    },
  },
];

const BAND_BG: Record<"red" | "amber" | "emerald" | "green", string> = {
  red: "from-rose-500 to-red-500",
  amber: "from-amber-500 to-orange-500",
  emerald: "from-emerald-500 to-teal-500",
  green: "from-emerald-400 to-emerald-600",
};

const BAND_LABEL: Record<"red" | "amber" | "emerald" | "green", string> = {
  red: "Needs work",
  amber: "Getting there",
  emerald: "Solid",
  green: "Excellent",
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function LiveScorecardDemo() {
  const [personaKey, setPersonaKey] = useState<string>("mid");
  const [overrides, setOverrides] = useState<Partial<ScoreInputs>>({});

  const inputs = useMemo<ScoreInputs>(() => {
    const base =
      PERSONAS.find((p) => p.key === personaKey)?.inputs ?? PERSONAS[1].inputs;
    return { ...base, ...overrides };
  }, [personaKey, overrides]);

  const score = useMemo(() => computeScore(inputs), [inputs]);

  const setField = (key: keyof ScoreInputs, value: number) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const choosePersona = (key: string) => {
    setPersonaKey(key);
    setOverrides({});
  };

  return (
    <section className="border-t border-slate-200 bg-gradient-to-b from-emerald-50/40 to-white dark:border-slate-800 dark:from-emerald-950/20 dark:to-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <div className="mb-8 text-center sm:mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 shadow-sm dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300">
            <Sparkles className="h-3 w-3" aria-hidden /> Live demo
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Try the scorecard right here
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 sm:text-base">
            Pick a persona, drag the sliders. Same engine the signed-in app
            uses — no signup, nothing saved.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Inputs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Persona
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {PERSONAS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => choosePersona(p.key)}
                  className={`rounded-lg border px-2 py-2 text-left text-[11px] transition ${
                    personaKey === p.key
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <span className="block truncate font-semibold">
                    {p.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-500 dark:text-slate-400">
                    {p.hint}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-4">
              <SliderRow
                label="Monthly income"
                value={inputs.monthlyIncome ?? 0}
                min={10000}
                max={500000}
                step={5000}
                onChange={(v) => setField("monthlyIncome", v)}
              />
              <SliderRow
                label="Monthly expenses"
                value={inputs.monthlyExpenses ?? 0}
                min={5000}
                max={400000}
                step={2500}
                onChange={(v) => setField("monthlyExpenses", v)}
              />
              <SliderRow
                label="Liquid savings"
                value={inputs.liquidSavings ?? 0}
                min={0}
                max={3000000}
                step={10000}
                onChange={(v) => setField("liquidSavings", v)}
              />
              <SliderRow
                label="Total EMI / month"
                value={inputs.totalEmi ?? 0}
                min={0}
                max={150000}
                step={1000}
                onChange={(v) => setField("totalEmi", v)}
              />
              <SliderRow
                label="Term insurance cover"
                value={inputs.termCoverAmount ?? 0}
                min={0}
                max={50000000}
                step={500000}
                onChange={(v) => setField("termCoverAmount", v)}
              />
              <SliderRow
                label="Monthly SIP / investment"
                value={inputs.monthlyInvestment ?? 0}
                min={0}
                max={150000}
                step={1000}
                onChange={(v) => setField("monthlyInvestment", v)}
              />
            </div>
          </div>

          {/* Score panel */}
          <div className="space-y-4">
            <div
              className={`rounded-2xl bg-gradient-to-br ${BAND_BG[score.band]} p-6 text-white shadow-lg`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                Your score
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
                  {score.total}
                </span>
                <span className="text-lg font-medium text-white/90">
                  / 100
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-white/95">
                {BAND_LABEL[score.band]} · {score.band} band
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white/90 transition-[width] duration-500"
                  style={{ width: `${clamp(score.total, 0, 100)}%` }}
                />
              </div>
            </div>

            <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {score.pillars.map((p) => (
                <li key={p.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span aria-hidden>{p.emoji}</span>
                      {p.label}
                    </span>
                    <span className="tabular-nums text-slate-600 dark:text-slate-300">
                      {p.score}/20
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${
                        p.score >= 16
                          ? "bg-emerald-500"
                          : p.score >= 10
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }`}
                      style={{ width: `${clamp((p.score / 20) * 100, 0, 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <Link
              href="/app/groups"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:from-emerald-600 hover:to-teal-600"
            >
              Save it & track it over time
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
              Free forever · ~30s to sign up · India-first benchmarks
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-2 text-[11.5px]">
        <span className="font-medium text-slate-600 dark:text-slate-300">
          {label}
        </span>
        <span className="tabular-nums text-slate-700 dark:text-slate-200">
          {formatINR(value, 0)}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-emerald-500"
      />
    </label>
  );
}
