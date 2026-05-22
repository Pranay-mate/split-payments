/**
 * ProductHunt launch hero image — 1270×760 PNG.
 *
 * Renders the two product pillars side-by-side as stylised mobile-screen
 * panels: Groups (left, indigo) showing a trip-style expense breakdown,
 * and Personal finance (right, emerald) showing the scorecard + net-worth.
 * Locked tagline below.
 *
 * Same Satori constraints as src/app/api/og/milestone/route.tsx — they
 * matter and they are not optional:
 *   - Node runtime (edge fonts choke on some Unicode)
 *   - Outer container uses string "100%" sizing; ImageResponse options
 *     define the actual pixel dimensions
 *   - Every div with multiple children OR a single text child has an
 *     explicit `display: flex` — missing this silently fails the whole
 *     render
 *   - No backdrop-filter, box-shadow, animations
 *   - `letterSpacing` must be a string ("-0.04em"), not a number
 *   - Avoid emoji with variation selectors (U+FE0F) — they trip Satori's
 *     emoji renderer on Node. Plain text labels everywhere.
 *   - All dynamic-number text wrapped in String(...) so React doesn't
 *     pass numeric children that Satori doesn't know how to layout
 */

import { ImageResponse } from "next/og";

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

export async function GET() {
  try {
    return new ImageResponse(<Hero />, {
      width: WIDTH,
      height: HEIGHT,
      headers: CACHE_HEADERS,
    });
  } catch (err) {
    console.error("OG launch hero render failed", err);
    // Last-resort fallback — solid-gradient card with the brand only.
    // Avoids returning a 500 (which Vercel surfaces as
    // FUNCTION_INVOCATION_FAILED to the user); a degraded image still
    // works as a share card.
    return new ImageResponse(<Fallback />, {
      width: WIDTH,
      height: HEIGHT,
      headers: CACHE_HEADERS,
    });
  }
}

function Hero() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #10b981 100%)",
        color: "white",
        fontFamily: FONT_STACK,
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
            letterSpacing: "-0.02em",
          }}
        >
          ₹
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          EasySplits
        </div>
      </div>

      {/* Two product panels */}
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
            display: "flex",
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          Track money + split bills.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 500,
            marginTop: 6,
            opacity: 0.92,
          }}
        >
          India-first · encrypted · free
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 18,
            fontWeight: 600,
            marginTop: 12,
            background: "rgba(255,255,255,0.18)",
            padding: "6px 16px",
            borderRadius: 999,
          }}
        >
          easysplits.in
        </div>
      </div>
    </div>
  );
}

function GroupsPanel() {
  return (
    <PanelShell accent="#6366f1" label="GROUPS">
      <div
        style={{
          display: "flex",
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        Goa Trip · 4 friends
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 16,
          color: "#64748b",
          marginTop: -4,
        }}
      >
        Settled in 3 transfers
      </div>

      <ExpenseRow title="Hotel · 3 nights" amount="₹12,400" share={1.0} />
      <ExpenseRow title="Scooter rental" amount="₹3,200" share={0.26} />
      <ExpenseRow title="Dinner at Britto's" amount="₹2,800" share={0.23} />

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 6,
        }}
      >
        <Pill tone="amber" label="You owe" value="₹1,200" />
        <Pill tone="emerald" label="You're owed" value="₹500" />
      </div>
    </PanelShell>
  );
}

function WealthPanel() {
  return (
    <PanelShell accent="#10b981" label="PERSONAL FINANCE">
      <div
        style={{
          display: "flex",
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        Net worth · ₹4.2 L
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 16,
          color: "#64748b",
          marginTop: -4,
        }}
      >
        +₹18,200 this month
      </div>

      {/* Scorecard pill */}
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
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "white",
            fontSize: 26,
            fontWeight: 800,
          }}
        >
          {String(78)}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 18,
              fontWeight: 700,
              color: "#065f46",
            }}
          >
            Financial Health
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 14,
              color: "#047857",
              marginTop: 2,
            }}
          >
            Solid foundations · 4-month streak
          </div>
        </div>
      </div>

      <PillarRow label="Emergency" pct={0.85} hex="#10b981" />
      <PillarRow label="Insurance" pct={0.7} hex="#6366f1" />
      <PillarRow label="Investing" pct={0.6} hex="#8b5cf6" />
    </PanelShell>
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
            display: "flex",
            fontSize: 16,
            fontWeight: 700,
            color: "#475569",
            letterSpacing: "0.1em",
          }}
        >
          {label}
        </div>
      </div>
      {children}
    </div>
  );
}

function ExpenseRow({
  title,
  amount,
  share,
}: {
  title: string;
  amount: string;
  share: number;
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
            fontSize: 16,
            fontWeight: 600,
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
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
            width: Math.max(8, Math.round(share * 360)),
            background: "#6366f1",
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
  const pctText = String(Math.round(pct * 100));
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
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          {pctText}/100
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
            width: Math.max(8, Math.round(pct * 360)),
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
      <div
        style={{
          display: "flex",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 15,
          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Fallback() {
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
          fontSize: 32,
          fontWeight: 500,
          marginTop: 16,
          opacity: 0.92,
        }}
      >
        Track money + split bills · India-first
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 22,
          fontWeight: 600,
          marginTop: 32,
          background: "rgba(255,255,255,0.18)",
          padding: "8px 20px",
          borderRadius: 999,
        }}
      >
        easysplits.in
      </div>
    </div>
  );
}
