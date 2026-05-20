"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Coins,
  Loader2,
  Shield,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { markFirstActionDone } from "@/lib/use-install-prompt";

type FormState = {
  age: number | "";
  retirementAge: number | "";
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
  retirementAge: 60, // sensible default — most users keep it
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

function NumField({
  label,
  hint,
  value,
  onChange,
  prefix = "₹",
  locked,
}: {
  label: string;
  hint?: string;
  value: number | "";
  onChange: (v: number | "") => void;
  prefix?: string;
  /** When set, the input is read-only and a small "auto-filled" banner
   *  appears under it linking to the source of truth (e.g. /wealth).
   *  Used by the Scorecard wizard to avoid double-entry of EMI /
   *  investment balance once those are tracked on /wealth. */
  locked?: { source: "wealth"; href: string; note: string } | null;
}) {
  const isLocked = !!locked;
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && (
        <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      )}
      <div
        className={`mt-1.5 flex items-center gap-1 rounded-lg border px-2 ${
          isLocked
            ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20"
            : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
        }`}
      >
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
          readOnly={isLocked}
          className={`w-full bg-transparent py-2 text-base outline-none tabular-nums ${
            isLocked ? "cursor-not-allowed text-slate-700 dark:text-slate-200" : ""
          }`}
        />
      </div>
      {locked && (
        <span className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
          🔒 {locked.note}{" "}
          <a
            href={locked.href}
            className="font-medium underline-offset-2 hover:underline"
          >
            Edit on /wealth →
          </a>
        </span>
      )}
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

/**
 * Section card. Header has an emoji + title; body holds the fields.
 * Keeps sections visually distinct without forcing the user through
 * a multi-step gauntlet.
 */
function Section({
  icon: Icon,
  iconClass,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  iconClass: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${iconClass}`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function OnboardWizard() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(BLANK);
  const [hydrated, setHydrated] = useState(false);

  const profileQuery = trpc.personal.profile.get.useQuery();
  // /wealth is the single source of truth for individual debts +
  // holdings since v5.1 / v5.2. Pull those so we can auto-fill the EMI
  // total + investment balance instead of asking the user to type them
  // again (and likely diverge from the real data).
  const debtsQuery = trpc.personal.debts.list.useQuery();
  const holdingsQuery = trpc.personal.holdings.list.useQuery();
  const upsertMutation = trpc.personal.profile.upsert.useMutation();
  const utils = trpc.useUtils();

  const autoEmi = (debtsQuery.data ?? [])
    .filter((d) => !d.archivedAt)
    .reduce((s, d) => s + d.emi, 0);
  const autoInvestmentBalance = (holdingsQuery.data ?? [])
    .filter((h) => !h.archivedAt)
    .reduce((s, h) => s + h.currentValue, 0);
  const hasAutoEmi = autoEmi > 0;
  const hasAutoInvestment = autoInvestmentBalance > 0;

  // Prefill if a profile already exists. queueMicrotask defer so React 19's
  // set-state-in-effect lint stays quiet — intentional first-render hydration.
  useEffect(() => {
    if (hydrated || !profileQuery.data?.exists || !profileQuery.data.inputs)
      return;
    const i = profileQuery.data.inputs;
    queueMicrotask(() => {
      setForm({
        age: i.age ?? "",
        retirementAge: i.retirementAge ?? 60,
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

  // Once /wealth data arrives, overwrite the EMI + investment fields
  // with the computed totals so the score uses the real numbers, not a
  // stale manual entry. We only do this when /wealth actually has
  // records — empty /wealth = let the user type freely.
  useEffect(() => {
    if (!hasAutoEmi && !hasAutoInvestment) return;
    queueMicrotask(() => {
      setForm((f) => ({
        ...f,
        ...(hasAutoEmi && { totalEmi: autoEmi }),
        ...(hasAutoInvestment && { investmentBalance: autoInvestmentBalance }),
      }));
    });
  }, [hasAutoEmi, hasAutoInvestment, autoEmi, autoInvestmentBalance]);

  // blankAsZero: "I have none of this" — common, valid answer.
  // blankAsNull: "I haven't told you yet" — score genuinely needs these.
  const blankAsNull = (v: number | "") => (v === "" ? null : v);
  const blankAsZero = (v: number | "") => (v === "" ? 0 : v);

  const isExisting = profileQuery.data?.exists ?? false;
  const canSubmit =
    form.monthlyIncome !== "" && form.monthlyExpenses !== "";

  const submit = async () => {
    if (!canSubmit) {
      toast.error("Monthly income and expenses are required");
      return;
    }
    try {
      await upsertMutation.mutateAsync({
        age: form.age === "" ? null : form.age,
        retirementAge: form.retirementAge === "" ? null : form.retirementAge,
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
        markCompleted: true,
      });
      utils.personal.profile.get.invalidate();
      markFirstActionDone();
      toast.success(isExisting ? "Score updated" : "Score computed");
      router.push("/app/personal");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <main className="flex-1 pb-44 sm:pb-8">
      <div className="mx-auto max-w-xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <button
          type="button"
          onClick={() => router.push("/app/personal")}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Personal
        </button>

        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-fuchsia-500" aria-hidden />
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              {isExisting
                ? "Update your Financial Health Score"
                : "Get your Financial Health Score"}
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            🔐 We encrypt every amount before storing — our database only ever
            sees scrambled text. Leave a field blank if you have none — counts
            as zero. Only income + expenses are required.
          </p>
        </div>

        <Section
          icon={Briefcase}
          iconClass="bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
          title="About you"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField
              label="Your age"
              hint="Drives the investing-pillar glide path — younger users have a more lenient target."
              value={form.age}
              onChange={(v) => set("age", v)}
              prefix="🎂"
            />
            <NumField
              label="Target retirement age"
              hint="60 for most. Lower (40–50) for FIRE, higher (65+) for late-career switchers."
              value={form.retirementAge}
              onChange={(v) => set("retirementAge", v)}
              prefix="🎯"
            />
          </div>
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
        </Section>

        <Section
          icon={Coins}
          iconClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
          title="Money in & out"
        >
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
        </Section>

        <Section
          icon={Shield}
          iconClass="bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
          title="Insurance"
        >
          <NumField
            label="Term life cover"
            hint={
              form.hasDependents
                ? "Sum assured of your term policy. Aim for 10–15× annual income."
                : "Skip if you don't have dependents — term insurance isn't needed."
            }
            value={form.termCoverAmount}
            onChange={(v) => set("termCoverAmount", v)}
          />
          <NumField
            label="Health insurance cover"
            hint="Total sum assured (base + super top-up). Employer-provided counts. Aim for ₹15L+."
            value={form.healthCoverAmount}
            onChange={(v) => set("healthCoverAmount", v)}
          />
        </Section>

        <Section
          icon={TrendingUp}
          iconClass="bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
          title="Debt & investing"
        >
          <NumField
            label="Total monthly EMIs"
            hint="Home loan + car + personal loan + credit-card EMI. Target: under 40% of income."
            value={form.totalEmi}
            onChange={(v) => set("totalEmi", v)}
            locked={
              hasAutoEmi
                ? {
                    source: "wealth",
                    href: "/app/personal/wealth",
                    note: "Auto-totalled from your Debts on /wealth.",
                  }
                : null
            }
          />
          <Toggle
            label="Carrying a credit-card balance month-to-month?"
            hint="High-interest debt should be cleared first — biggest financial-health drag."
            value={form.hasCcCarryover}
            onChange={(v) => set("hasCcCarryover", v)}
          />
          <NumField
            label="Investment balance"
            hint="Mutual funds + stocks + PPF + EPF + NPS — anything earning long-term returns."
            value={form.investmentBalance}
            onChange={(v) => set("investmentBalance", v)}
            locked={
              hasAutoInvestment
                ? {
                    source: "wealth",
                    href: "/app/personal/wealth",
                    note: "Auto-totalled from your Holdings on /wealth.",
                  }
                : null
            }
          />
          <NumField
            label="Monthly investment (SIP)"
            hint="Total per-month going into investments. Even ₹1,000 compounds significantly."
            value={form.monthlyInvestment}
            onChange={(v) => set("monthlyInvestment", v)}
          />
        </Section>

        {/* Inline compute button for desktop / when sticky isn't needed */}
        <div className="hidden sm:flex sm:justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || upsertMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {upsertMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {isExisting ? "Update my score" : "Compute my score"}
          </button>
        </div>
      </div>

      {/* Sticky CTA on mobile — always reachable without scrolling.
          Offset above the MobileBottomNav (Groups / Personal tabs) +
          iOS safe-area; otherwise the Compute button hides behind the
          tab bar at the bottom of the viewport. */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.75rem)] z-30 border-t border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/95 sm:bottom-0 sm:hidden">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || upsertMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          {upsertMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {isExisting ? "Update my score" : "Compute my score"}
        </button>
        {!canSubmit && (
          <p className="mt-1.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
            Add monthly income + expenses to compute
          </p>
        )}
      </div>
    </main>
  );
}
