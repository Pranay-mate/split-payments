/**
 * Embeddable scorecard widget — designed for iframe embedding on
 * personal-finance blogs, portfolios, etc. Self-contained: no auth,
 * no JS state, single fetch of Tailwind CSS, ~30 KB transferred.
 *
 * Usage:
 *   <iframe src="https://easysplits.in/embed/scorecard?score=85&band=green&label=Pranay"
 *           width="320" height="200"
 *           style="border:0; border-radius:16px"
 *           loading="lazy"
 *           referrerpolicy="no-referrer-when-downgrade"></iframe>
 *
 * Query params:
 *   score  — 0..100 (clamped server-side)
 *   band   — red | amber | emerald | green (defaults emerald)
 *   label  — display text (max 24 chars; PII-light by convention,
 *            but the embedder controls this)
 *
 * Why this exists: PFs/financial bloggers can showcase their
 * scorecard score on their site, with attribution back to EasySplits
 * baked in. Distribution multiplier — every embed is a backlink.
 */

import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = buildMetadata({
  title: "Embed: Financial Health Scorecard",
  description: "Embeddable EasySplits Financial Health Scorecard widget.",
  path: "/embed/scorecard",
  noIndex: true,
});

const BAND_GRADIENT = {
  red: "linear-gradient(135deg, #f43f5e, #b91c1c)",
  amber: "linear-gradient(135deg, #f59e0b, #f43f5e)",
  emerald: "linear-gradient(135deg, #10b981, #0d9488)",
  green: "linear-gradient(135deg, #10b981, #059669)",
} as const;

const BAND_LABEL = {
  red: "Needs attention",
  amber: "Room to grow",
  emerald: "Solid foundations",
  green: "Excellent shape",
} as const;

type Band = keyof typeof BAND_GRADIENT;

function parseBand(s: string | undefined): Band {
  if (s === "red" || s === "amber" || s === "emerald" || s === "green") {
    return s;
  }
  return "emerald";
}

function clampScore(s: string | undefined): number {
  const n = Number(s ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

type SearchParams = Promise<{
  score?: string;
  band?: string;
  label?: string;
}>;

export default async function EmbedScorecardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const score = clampScore(params.score);
  const band = parseBand(params.band);
  const rawLabel = params.label?.slice(0, 24) ?? "Financial Health";

  return (
    <div
      // Inline styles only — embedded widgets shouldn't inherit any
      // parent-page CSS that could break the layout. Inline = portable.
      style={{
        width: "100%",
        minHeight: 200,
        margin: 0,
        padding: 0,
        background: BAND_GRADIENT[band],
        color: "white",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
      }}
    >
      <div style={{ padding: "20px 24px 12px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            opacity: 0.9,
          }}
        >
          {rawLabel}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: 4,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {score}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              marginLeft: 6,
              opacity: 0.7,
            }}
          >
            /100
          </div>
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            marginTop: 4,
            opacity: 0.95,
          }}
        >
          {BAND_LABEL[band]}
        </div>
      </div>

      <a
        // Attribution. Clickable; opens parent _blank so embedder's site
        // doesn't get hijacked.
        href="https://easysplits.in/use-cases/financial-health-india"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 24px",
          background: "rgba(0,0,0,0.18)",
          color: "white",
          textDecoration: "none",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        <span style={{ opacity: 0.95 }}>Get your free score on EasySplits</span>
        <span style={{ opacity: 0.7 }}>→</span>
      </a>
    </div>
  );
}
