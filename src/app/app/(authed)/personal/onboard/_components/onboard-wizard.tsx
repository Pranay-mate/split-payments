"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

type FormState = {
  age: number | "";
  isFreelancer: boolean;
  hasDependents: boolean;
  hasCcCarryover: boolean;
  monthlyIncome: number | "";
  monthlyExpenses: number | "";
  liquidSavings: number | "";
  termCoverAmount: number | "";
  healthCoverAmount: number | "";
  totalEmi: number | "";
  investmentBalance: number | "";
  monthlyInvestment: number | "";
};

const BLANK: FormState = {
  age: "",
  isFreelancer: false,
  hasDependents: false,
  hasCcCarryover: false,
  monthlyIncome: "",
  monthlyExpenses: "",
  liquidSavings: "",
  termCoverAmount: "",
  healthCoverAmount: "",
  totalEmi: "",
  investmentBalance: "",
  monthlyInvestment: "",
};

const STEPS = [
  { key: "about", title: "About you" },
  { key: "money", title: "Money in & out" },
  { key: "insurance", title: "Insurance" },
  { key: "debt", title: "Debt & investing" },
] as const;

function NumField({
  label,
  hint,
  value,
  onChange,
  prefix = "₹",
  optional = false,
}: {
  label: string;
  hint?: string;
  value: number | "";
  onChange: (v: number | "") => void;
  prefix?: string;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm font-medium">
        {label}
        {optional && (
          <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
            optional
          </span>
        )}
      </span>
      {hint && (
        <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      )}
      <div className="mt-1.5 flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900">
        <span className="text-sm font-semibold text-slate-500">{prefix}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={1}
          value={value}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder="0"
          className="w-full bg-transparent py-2 text-base outline-none tabular-nums"
        />
      </div>
    </label>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <span className="block text-sm font-medium">{label}</span>
      {hint && (
        <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      )}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => onChange(false)}
          aria-pressed={!value}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            !value
              ? "bg-emerald-500 text-white"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          No
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          aria-pressed={value}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            value
              ? "bg-emerald-500 text-white"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Yes
        </button>
      </div>
    </div>
  );
}

export function OnboardWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(BLANK);
  const [hydrated, setHydrated] = useState(false);

  const profileQuery = trpc.personal.profile.get.useQuery();
  const upsertMutation = trpc.personal.profile.upsert.useMutation();
  const utils = trpc.useUtils();

  // Prefill if a profile already exists. Defer the setState into a
  // microtask to satisfy React 19's set-state-in-effect lint — these
  // are intentional first-render hydrations, not effect-driven loops.
  useEffect(() => {
    if (hydrated || !profileQuery.data?.exists || !profileQuery.data.inputs)
      return;
    const i = profileQuery.data.inputs;
    queueMicrotask(() => {
      setForm({
        age: i.age ?? "",
        isFreelancer: i.isFreelancer,
        hasDependents: i.hasDependents,
        hasCcCarryover: i.hasCcCarryover,
        monthlyIncome: i.monthlyIncome ?? "",
        monthlyExpenses: i.monthlyExpenses ?? "",
        liquidSavings: i.liquidSavings ?? "",
        termCoverAmount: i.termCoverAmount ?? "",
        healthCoverAmount: i.healthCoverAmount ?? "",
        totalEmi: i.totalEmi ?? "",
        investmentBalance: i.investmentBalance ?? "",
        monthlyInvestment: i.monthlyInvestment ?? "",
      });
      setHydrated(true);
    });
  }, [profileQuery.data, hydrated]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Two coercions:
  //   blankAsNull → use null when the user hasn't told us yet (income,
  //     expenses, age — the score literally doesn't work without these,
  //     and hasEnoughData gates the UI on them).
  //   blankAsZero → use 0 for fields where "I have none of this" is a
  //     real, common answer. Otherwise users had to type "0" to get the
  //     "No EMIs → full marks" branch in the scorer; surprising UX.
  const blankAsNull = (v: number | "") => (v === "" ? null : v);
  const blankAsZero = (v: number | "") => (v === "" ? 0 : v);

  const submit = async (markCompleted: boolean) => {
    try {
      await upsertMutation.mutateAsync({
        age: form.age === "" ? null : form.age,
        isFreelancer: form.isFreelancer,
        hasDependents: form.hasDependents,
        hasCcCarryover: form.hasCcCarryover,
        monthlyIncome: blankAsNull(form.monthlyIncome),
        monthlyExpenses: blankAsNull(form.monthlyExpenses),
        liquidSavings: blankAsZero(form.liquidSavings),
        termCoverAmount: blankAsZero(form.termCoverAmount),
        healthCoverAmount: blankAsZero(form.healthCoverAmount),
        totalEmi: blankAsZero(form.totalEmi),
        investmentBalance: blankAsZero(form.investmentBalance),
        monthlyInvestment: blankAsZero(form.monthlyInvestment),
        markCompleted,
      });
      utils.personal.profile.get.invalidate();
      if (markCompleted) {
        toast.success("Score updated");
        router.push("/app/personal");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  const isLast = step === STEPS.length - 1;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <button
          type="button"
          onClick={() => router.push("/app/personal")}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Personal
        </button>

        {/* Progress */}
        <div>
          <div className="flex items-center gap-2">
            <Sparkles
              className="h-4 w-4 text-fuchsia-500"
              aria-hidden
            />
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              Financial Health check — {STEPS[step].title}
            </h1>
          </div>
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`h-1.5 flex-1 rounded-full transition ${
                  i <= step ? "bg-fuchsia-500" : "bg-slate-200 dark:bg-slate-800"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Step {step + 1} of {STEPS.length} · 🔐 We encrypt every amount
            before storing — our database only ever sees scrambled text.
          </p>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            Tip: leave a field blank if you have none — we&apos;ll count it
            as zero. Only income + expenses are required.
          </p>
        </div>

        {/* Step content */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          {step === 0 && (
            <>
              <NumField
                label="Your age"
                hint="Used for retirement-targeting math (no exact figure stored beyond what you enter)."
                value={form.age}
                onChange={(v) => set("age", v)}
                prefix="🎂"
                optional
              />
              <Toggle
                label="Freelance / business income?"
                hint="Freelancers should target a 9-month emergency fund (vs 6 for stable jobs)."
                value={form.isFreelancer}
                onChange={(v) => set("isFreelancer", v)}
              />
              <Toggle
                label="Anyone financially dependent on you?"
                hint="Spouse, kids, parents — affects whether term life insurance is required."
                value={form.hasDependents}
                onChange={(v) => set("hasDependents", v)}
              />
            </>
          )}

          {step === 1 && (
            <>
              <NumField
                label="Monthly income"
                hint="Take-home, after tax + PF. Salary, freelance, side income."
                value={form.monthlyIncome}
                onChange={(v) => set("monthlyIncome", v)}
              />
              <NumField
                label="Monthly expenses"
                hint="Roughly what you spend each month — rent, food, bills, the usual."
                value={form.monthlyExpenses}
                onChange={(v) => set("monthlyExpenses", v)}
              />
              <NumField
                label="Liquid savings"
                hint="Cash, savings account, FDs you could break in 24h. Excludes investments."
                value={form.liquidSavings}
                onChange={(v) => set("liquidSavings", v)}
              />
            </>
          )}

          {step === 2 && (
            <>
              <NumField
                label="Term life cover"
                hint={
                  form.hasDependents
                    ? "Sum assured of your term policy. Aim for 10–15× annual income."
                    : "Skip if you don't have dependents — term insurance isn't needed."
                }
                value={form.termCoverAmount}
                onChange={(v) => set("termCoverAmount", v)}
                optional={!form.hasDependents}
              />
              <NumField
                label="Health insurance cover"
                hint="Total sum assured (base + super top-up). Employer-provided counts. Aim for ₹15L+."
                value={form.healthCoverAmount}
                onChange={(v) => set("healthCoverAmount", v)}
              />
            </>
          )}

          {step === 3 && (
            <>
              <NumField
                label="Total monthly EMIs"
                hint="Home loan + car + personal loan + credit-card EMI. Target: under 40% of income."
                value={form.totalEmi}
                onChange={(v) => set("totalEmi", v)}
              />
              <Toggle
                label="Carrying a credit-card balance month-to-month?"
                hint="High-interest debt should be cleared first — this is the biggest financial-health drag."
                value={form.hasCcCarryover}
                onChange={(v) => set("hasCcCarryover", v)}
              />
              <NumField
                label="Investment balance"
                hint="Mutual funds + stocks + PPF + EPF + NPS — anything earning long-term returns."
                value={form.investmentBalance}
                onChange={(v) => set("investmentBalance", v)}
              />
              <NumField
                label="Monthly investment (SIP)"
                hint="Total per-month going into investments. Even ₹1,000 compounds significantly."
                value={form.monthlyInvestment}
                onChange={(v) => set("monthlyInvestment", v)}
              />
            </>
          )}
        </section>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
          </button>
          {!isLast ? (
            <button
              type="button"
              onClick={async () => {
                // Save partial progress on each Next so back-button doesn't lose work.
                await submit(false);
                setStep((s) => Math.min(STEPS.length - 1, s + 1));
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500"
            >
              Next
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={upsertMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {upsertMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              )}
              Compute my score
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
