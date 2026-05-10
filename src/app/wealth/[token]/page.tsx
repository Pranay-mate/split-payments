/**
 * Public wealth-share page — opt-in only, gated by a 64-hex token in
 * the URL. Renders the user's net worth and type breakdown for share-
 * able context (think: Strava activity but for a portfolio).
 *
 * Privacy choices baked in:
 *   1. Sharing is OFF by default; user must explicitly enable in profile
 *      editor → token gets generated.
 *   2. Even when ON, rupee amounts default to HIDDEN. Only ratios + type
 *      mix render. Show-amounts is a second opt-in toggle.
 *   3. Token is 32 random bytes hex (~256 bits) — unguessable.
 *   4. Rotating the token invalidates any old shared URL.
 *   5. No PII beyond user's chosen displayName.
 *   6. No auth needed to view — this is a deliberately public surface.
 *
 * Server component: hits the DB directly (no tRPC) since this is
 * unauthenticated and Drizzle is already cheap on edge.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Lock, Sparkles, Wallet } from "lucide-react";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { personalHoldings, profiles } from "@/lib/db/schema";
import { decryptAmount } from "@/lib/encryption";
import { formatINR } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Same type list as in /app/personal/wealth — duplicated here to avoid
// pulling client-side icon code into a server component.
const TYPE_LABEL: Record<string, string> = {
  mutual_fund: "Mutual Funds",
  fd: "Fixed Deposits",
  stock: "Stocks",
  gold: "Gold",
  bond: "Bonds",
  other: "Other",
};

const TYPE_HEX: Record<string, string> = {
  mutual_fund: "#6366f1",
  fd: "#10b981",
  stock: "#f43f5e",
  gold: "#f59e0b",
  bond: "#06b6d4",
  other: "#94a3b8",
};

const TYPE_EMOJI: Record<string, string> = {
  mutual_fund: "📈",
  fd: "🏦",
  stock: "💹",
  gold: "🏅",
  bond: "📜",
  other: "💼",
};

type Params = Promise<{ token: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { token } = await params;
  // Don't leak whether the token is valid via metadata; just always
  // render share-flavoured OG meta.
  return buildMetadata({
    title: "Net worth · Shared on EasySplits",
    description:
      "A privacy-friendly snapshot of someone's investment portfolio mix, shared via EasySplits.",
    path: `/wealth/${token}`,
    noIndex: true, // never index user-shared pages
  });
}

export default async function PublicWealthPage({ params }: { params: Params }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/i.test(token)) notFound();

  const [profile] = await db
    .select({
      userId: profiles.id,
      displayName: profiles.displayName,
      showAmounts: profiles.wealthShareShowAmounts,
    })
    .from(profiles)
    .where(eq(profiles.wealthShareToken, token))
    .limit(1);

  if (!profile) notFound();

  // Pull active holdings; aggregate server-side after decryption.
  const rows = await db
    .select()
    .from(personalHoldings)
    .where(
      and(
        eq(personalHoldings.userId, profile.userId),
        isNull(personalHoldings.archivedAt),
      ),
    );

  let total = 0;
  const byType = new Map<string, number>();
  for (const r of rows) {
    let cv = 0;
    try {
      cv = decryptAmount(r.currentValue);
    } catch {
      // Skip rows we can't decrypt (key rotation, etc).
      continue;
    }
    total += cv;
    byType.set(r.type, (byType.get(r.type) ?? 0) + cv);
  }

  if (rows.length === 0 || total === 0) {
    return (
      <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
        <Wallet className="h-10 w-10 text-slate-300 dark:text-slate-700" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {profile.displayName} hasn&apos;t added holdings yet
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          When they do, this page will show a breakdown of where their net
          worth is invested.
        </p>
        <Link
          href="/use-cases/financial-health-india"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Get your own free score on EasySplits
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </main>
    );
  }

  const sortedTypes = Array.from(byType.entries())
    .map(([type, value]) => ({
      type,
      value,
      pct: total > 0 ? value / total : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Hero: name + (maybe) total */}
        <div className="bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 px-6 py-7 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
            <Sparkles className="-mt-0.5 mr-1 inline-block h-3 w-3" aria-hidden />
            Public wealth snapshot
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {profile.displayName}&apos;s portfolio mix
          </p>
          {profile.showAmounts ? (
            <p className="mt-3 text-2xl font-bold tabular-nums">
              {formatINR(total, 0)}
            </p>
          ) : (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur">
              <Lock className="h-3 w-3" aria-hidden />
              Amounts hidden — only ratios shown
            </p>
          )}
          <p className="mt-2 text-[11px] text-white/90">
            Shared via EasySplits. {rows.length} active holding
            {rows.length === 1 ? "" : "s"}.
          </p>
        </div>

        {/* Type breakdown */}
        <div className="space-y-3 px-6 py-6">
          <h2 className="text-sm font-semibold tracking-tight">By type</h2>
          <ul className="space-y-2.5 text-sm">
            {sortedTypes.map((t) => (
              <li key={t.type} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden>{TYPE_EMOJI[t.type] ?? "📦"}</span>
                    {TYPE_LABEL[t.type] ?? t.type}
                  </span>
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">
                    {profile.showAmounts && (
                      <>
                        {formatINR(t.value, 0)}
                        <span className="ml-1 text-[11px] text-slate-400">
                          ·{" "}
                        </span>
                      </>
                    )}
                    <span className="font-semibold">
                      {Math.round(t.pct * 100)}%
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${t.pct * 100}%`,
                      background: TYPE_HEX[t.type] ?? "#94a3b8",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Want to track your own net worth + run a 5-pillar Financial
            Health checkup?
          </p>
          <Link
            href="/use-cases/financial-health-india"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Try EasySplits — free, India-first
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-md text-center text-[11px] text-slate-400 dark:text-slate-500">
        This page is shared by {profile.displayName}. EasySplits never reveals
        amounts unless the owner explicitly opts in. Encrypted at rest.
      </p>
    </main>
  );
}
