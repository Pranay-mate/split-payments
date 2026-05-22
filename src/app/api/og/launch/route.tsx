/**
 * ProductHunt launch hero image — 1270×760 PNG.
 *
 * Renders the two product pillars side-by-side as stylised mobile-screen
 * panels: Groups (left, indigo) showing a trip-style expense breakdown,
 * and Wealth (right, emerald) showing the scorecard + net-worth. The
 * locked tagline sits below.
 *
 * Use cases:
 *   - PH submission hero image
 *   - Twitter/X launch announcement card
 *   - WhatsApp / LinkedIn launch posts
 *
 * Same Satori constraints as src/app/api/og/milestone/route.tsx:
 *   - Node runtime (edge fonts choke on some Unicode)
 *   - Every div with >1 child has explicit `display: flex`
 *   - No backdrop-filter, box-shadow, animations, percent dimensions
 *   - Numeric absolute pixel sizes (Satori dislikes some CSS units)
 */

import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WIDTH = 1270;
const HEIGHT = 760;
const TAGLINE = "Track money + split bills.";
const TAGLINE_SUB = "India-first · encrypted · free";
const URL_LABEL = "easysplits.in";

export async function GET() {
  try {
    return new ImageResponse(<Hero />, {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("OG launch hero render failed", err);
    return new Response("hero render failed", { status: 500 });
  }
}

function Hero() {
  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #10b981 100%)",
        color: "white",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 56,
      }}
    >
      {/* Brand row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "white",
            color: "#6366f1",
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: -1,
          }}
        >
          ₹
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: -0.5,
          }}
        >
          EasySplits
        </div>
      </div>

      {/* Two phone panels */}
      <div
        style={{
          display: "flex",
          flex: 1,
          gap: 36,
          marginTop: 36,
        }}
      >
        <GroupsPanel />
        <WealthPanel />
      </div>

      {/* Tagline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 28,
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: -1.5,
          }}
        >
          {TAGLINE}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            marginTop: 6,
            opacity: 0.92,
          }}
        >
          {TAGLINE_SUB}
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginTop: 12,
            background: "rgba(255,255,255,0.18)",
            padding: "6px 16px",
            borderRadius: 999,
          }}
        >
          {URL_LABEL}
        </div>
      </div>
    </div>
  );
}

function PanelShell({
  accent,
  label,
  children,
}: {
  accent: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: "white",
        color: "#0f172a",
        borderRadius: 28,
        padding: 26,
        gap: 16,
      }}
    >
      {/* Tiny header strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 10,
            height: 10,
            borderRadius: 999,
            background: accent,
          }}
        />
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "#475569",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
      </div>
      {children}
    </div>
  );
}

function GroupsPanel() {
  return (
    <PanelShell accent="#6366f1" label="Groups">
      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: -0.8,
        }}
      >
        🏖️ Goa Trip · 4
      </div>
      <div
        style={{
          fontSize: 16,
          color: "#64748b",
          marginTop: -4,
        }}
      >
        Settled in 3 transfers
      </div>

      {/* Expense rows */}
      <ExpenseRow
        emoji="🏨"
        title="Hotel · 3 nights"
        amount="₹12,400"
        share={1.0}
        accent="#6366f1"
      />
      <ExpenseRow
        emoji="🛵"
        title="Scooter rental"
        amount="₹3,200"
        share={0.26}
        accent="#6366f1"
      />
      <ExpenseRow
        emoji="🍽️"
        title="Britto's dinner"
        amount="₹2,800"
        share={0.23}
        accent="#6366f1"
      />

      {/* Balance pills */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 6,
        }}
      >
        <Pill
          tone="amber"
          label="You owe"
          value="₹1,200"
        />
        <Pill
          tone="emerald"
          label="You're owed"
          value="₹500"
        />
      </div>
    </PanelShell>
  );
}

function WealthPanel() {
  return (
    <PanelShell accent="#10b981" label="Personal finance">
      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: -0.8,
        }}
      >
        Net worth · ₹4.2 L
      </div>
      <div
        style={{
          fontSize: 16,
          color: "#64748b",
          marginTop: -4,
        }}
      >
        +₹18,200 this month
      </div>

      {/* Scorecard */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: 14,
          borderRadius: 18,
          background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: 999,
            background:
              "linear-gradient(135deg, #10b981, #059669)",
            color: "white",
            fontSize: 26,
            fontWeight: 800,
          }}
        >
          78
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#065f46",
            }}
          >
            Financial Health
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#047857",
              marginTop: 2,
            }}
          >
            Solid foundations · 🔥 4-month streak
          </div>
        </div>
      </div>

      {/* Pillar bars */}
      <PillarRow label="Emergency" pct={0.85} hex="#10b981" />
      <PillarRow label="Insurance" pct={0.7} hex="#6366f1" />
      <PillarRow label="Investing" pct={0.6} hex="#8b5cf6" />
    </PanelShell>
  );
}

function ExpenseRow({
  emoji,
  title,
  amount,
  share,
  accent,
}: {
  emoji: string;
  title: string;
  amount: string;
  share: number;
  accent: string;
}) {
  return (
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
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 16,
            color: "#0f172a",
          }}
        >
          <div style={{ fontSize: 22 }}>{emoji}</div>
          <div style={{ fontWeight: 600 }}>{title}</div>
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          {amount}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          height: 6,
          background: "#f1f5f9",
          borderRadius: 999,
        }}
      >
        <div
          style={{
            display: "flex",
            width: Math.max(8, share * 360),
            background: accent,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function PillarRow({
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
          fontSize: 14,
          color: "#475569",
        }}
      >
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>
          {Math.round(pct * 100)}/100
        </div>
      </div>
      <div
        style={{
          display: "flex",
          height: 6,
          background: "#f1f5f9",
          borderRadius: 999,
        }}
      >
        <div
          style={{
            display: "flex",
            width: Math.max(8, pct * 360),
            background: hex,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function Pill({
  tone,
  label,
  value,
}: {
  tone: "amber" | "emerald";
  label: string;
  value: string;
}) {
  const palette =
    tone === "amber"
      ? { bg: "#fef3c7", fg: "#92400e" }
      : { bg: "#d1fae5", fg: "#065f46" };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 999,
        background: palette.bg,
        color: palette.fg,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
