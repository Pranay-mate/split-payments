/**
 * Four ProductHunt gallery images — one per feature highlight. Same
 * 1270×760 spec + Satori-safe constraints as /api/og/launch.
 *
 *   - ?type=encryption  → privacy + AES-256-GCM
 *   - ?type=offline     → offline PWA + queued mutations
 *   - ?type=scorecard   → 5-pillar Financial Health score
 *   - ?type=simplify    → minimum-transfers settlement algorithm
 *
 * Each frame leads with an oversized headline + a single supporting
 * "evidence" visual (mini chart, mock pill, big numbers). Designed to
 * read at the size PH renders gallery thumbs (~ 240×140) AND at the
 * full lightbox size when a viewer clicks in.
 */

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WIDTH = 1270;
const HEIGHT = 760;

const FONT_STACK =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
};

type Feature = "encryption" | "offline" | "scorecard" | "simplify";

function parseFeature(req: NextRequest): Feature {
  const raw = new URL(req.url).searchParams.get("type");
  if (
    raw === "offline" ||
    raw === "scorecard" ||
    raw === "simplify" ||
    raw === "encryption"
  )
    return raw;
  return "encryption";
}

export async function GET(req: NextRequest) {
  const feature = parseFeature(req);
  try {
    return new ImageResponse(<FeatureCard feature={feature} />, {
      width: WIDTH,
      height: HEIGHT,
      headers: CACHE_HEADERS,
    });
  } catch (err) {
    console.error("OG launch-feature render failed", err);
    return new ImageResponse(<Fallback feature={feature} />, {
      width: WIDTH,
      height: HEIGHT,
      headers: CACHE_HEADERS,
    });
  }
}

/* ─────────── Layout primitives ─────────── */

function BrandStrip() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "white",
          color: "#6366f1",
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        ₹
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}
      >
        EasySplits
      </div>
    </div>
  );
}

function Shell({
  gradient,
  eyebrow,
  headline,
  subline,
  children,
}: {
  gradient: string;
  eyebrow: string;
  headline: string;
  subline: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: gradient,
        color: "white",
        fontFamily: FONT_STACK,
        padding: 56,
      }}
    >
      <BrandStrip />
      <div
        style={{
          display: "flex",
          flex: 1,
          gap: 40,
          marginTop: 32,
          alignItems: "center",
        }}
      >
        {/* Copy column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.18em",
              opacity: 0.92,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 60,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            {headline}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 500,
              opacity: 0.92,
              lineHeight: 1.4,
              marginTop: 4,
            }}
          >
            {subline}
          </div>
        </div>
        {/* Evidence column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─────────── The four cards ─────────── */

function FeatureCard({ feature }: { feature: Feature }) {
  if (feature === "encryption") return <EncryptionCard />;
  if (feature === "offline") return <OfflineCard />;
  if (feature === "scorecard") return <ScorecardCard />;
  return <SimplifyCard />;
}

function EncryptionCard() {
  return (
    <Shell
      gradient="linear-gradient(135deg, #1e293b 0%, #6366f1 50%, #ec4899 100%)"
      eyebrow="PRIVACY"
      headline="Your salary is your secret."
      subline="Every amount encrypted before storing — our database only ever sees scrambled text. AES-256-GCM at the application layer."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          background: "rgba(255,255,255,0.95)",
          color: "#0f172a",
          padding: 32,
          borderRadius: 24,
          width: 460,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 12,
              fontWeight: 700,
              color: "#64748b",
              letterSpacing: "0.14em",
            }}
          >
            WHAT YOU SEE
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}
          >
            ₹ 1,24,500
          </div>
        </div>
        <div
          style={{
            display: "flex",
            height: 1,
            background: "#e2e8f0",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 12,
              fontWeight: 700,
              color: "#64748b",
              letterSpacing: "0.14em",
            }}
          >
            WHAT THE DATABASE STORES
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              fontWeight: 600,
              color: "#475569",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              wordBreak: "break-all",
            }}
          >
            7c4d:f1a8b3:9e02ab:7d5c…
          </div>
        </div>
      </div>
    </Shell>
  );
}

function OfflineCard() {
  return (
    <Shell
      gradient="linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #06b6d4 100%)"
      eyebrow="OFFLINE-FIRST"
      headline="Works without internet."
      subline="Add expenses, edit splits, record settlements — queued locally and replayed when you reconnect. PWA install on iOS + Android."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: 440,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "12px 20px",
            borderRadius: 999,
            background: "rgba(251, 191, 36, 0.18)",
            color: "#fde68a",
            border: "2px solid rgba(251, 191, 36, 0.6)",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          OFFLINE · 3 queued
        </div>
        <PseudoExpenseRow
          title="Tea + samosa"
          amount="₹240"
          tag="Will sync"
        />
        <PseudoExpenseRow
          title="Petrol — Goa road trip"
          amount="₹1,800"
          tag="Will sync"
        />
        <PseudoExpenseRow
          title="Settled — Anjali → you"
          amount="₹500"
          tag="Will sync"
        />
      </div>
    </Shell>
  );
}

function ScorecardCard() {
  return (
    <Shell
      gradient="linear-gradient(135deg, #064e3b 0%, #10b981 50%, #6366f1 100%)"
      eyebrow="FINANCIAL HEALTH"
      headline="Score 5 pillars in 60 seconds."
      subline="Emergency · Insurance · Debt · Savings · Investing. India-tuned with NCAER/RBI peer benchmarks. Streaks + monthly review."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          background: "rgba(255,255,255,0.95)",
          color: "#0f172a",
          padding: 28,
          borderRadius: 24,
          width: 460,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 100,
              height: 100,
              borderRadius: 999,
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "white",
              fontSize: 44,
              fontWeight: 800,
            }}
          >
            78
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 13,
                fontWeight: 700,
                color: "#475569",
                letterSpacing: "0.12em",
              }}
            >
              FINANCIAL HEALTH
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                fontWeight: 800,
                color: "#065f46",
              }}
            >
              Solid foundations
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 13,
                fontWeight: 600,
                color: "#059669",
              }}
            >
              4-month streak
            </div>
          </div>
        </div>
        <Pillar label="Emergency" pct={0.9} hex="#10b981" />
        <Pillar label="Insurance" pct={0.75} hex="#6366f1" />
        <Pillar label="Debt" pct={0.85} hex="#0ea5e9" />
        <Pillar label="Savings" pct={0.7} hex="#f59e0b" />
        <Pillar label="Investing" pct={0.6} hex="#8b5cf6" />
      </div>
    </Shell>
  );
}

function SimplifyCard() {
  return (
    <Shell
      gradient="linear-gradient(135deg, #312e81 0%, #6366f1 50%, #f59e0b 100%)"
      eyebrow="SETTLE FAST"
      headline="Fewest transfers, every time."
      subline="When 4 friends owe each other 12 different amounts, EasySplits computes the minimum payments to close out. Multi-currency for trips."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          background: "rgba(255,255,255,0.95)",
          color: "#0f172a",
          padding: 32,
          borderRadius: 24,
          width: 460,
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 80,
                fontWeight: 800,
                color: "#94a3b8",
                letterSpacing: "-0.04em",
                textDecoration: "line-through",
              }}
            >
              12
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 13,
                fontWeight: 600,
                color: "#94a3b8",
                letterSpacing: "0.12em",
              }}
            >
              PAIRWISE
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 56,
              fontWeight: 800,
              color: "#6366f1",
            }}
          >
            →
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 96,
                fontWeight: 800,
                color: "#10b981",
                letterSpacing: "-0.04em",
              }}
            >
              3
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 13,
                fontWeight: 700,
                color: "#059669",
                letterSpacing: "0.12em",
              }}
            >
              SIMPLIFIED
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 14,
            fontWeight: 600,
            color: "#475569",
            textAlign: "center",
          }}
        >
          4 friends · ₹18,400 of expenses · 3 cleanest payments
        </div>
      </div>
    </Shell>
  );
}

/* ─────────── Small shared bits ─────────── */

function PseudoExpenseRow({
  title,
  amount,
  tag,
}: {
  title: string;
  amount: string;
  tag: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 18px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.95)",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 12,
            color: "#0284c7",
            fontWeight: 600,
          }}
        >
          {tag}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 18,
          fontWeight: 800,
        }}
      >
        {amount}
      </div>
    </div>
  );
}

function Pillar({
  label,
  pct,
  hex,
}: {
  label: string;
  pct: number;
  hex: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
        }}
      >
        <div
          style={{
            display: "flex",
            fontWeight: 600,
            color: "#475569",
          }}
        >
          {label}
        </div>
        <div
          style={{
            display: "flex",
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          {Math.round(pct * 100)}/100
        </div>
      </div>
      <div
        style={{
          display: "flex",
          height: 6,
          background: "#e2e8f0",
          borderRadius: 999,
        }}
      >
        <div
          style={{
            display: "flex",
            width: Math.max(8, Math.round(pct * 380)),
            background: hex,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function Fallback({ feature }: { feature: Feature }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #10b981 100%)",
        color: "white",
        fontFamily: FONT_STACK,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: "-0.03em",
        }}
      >
        EasySplits
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 28,
          fontWeight: 600,
          marginTop: 12,
          opacity: 0.92,
        }}
      >
        {feature.toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 22,
          fontWeight: 600,
          marginTop: 30,
          background: "rgba(255,255,255,0.18)",
          padding: "8px 22px",
          borderRadius: 999,
        }}
      >
        easysplits.in
      </div>
    </div>
  );
}
