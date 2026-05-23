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
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FONT_STACK =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
};

/**
 * Output formats. `landscape` is the PH default (1270×760). `portrait`
 * is 1080×1920 for vertical share channels — Instagram Story, Reels,
 * WhatsApp Status. Same content in both, layout adapted to the aspect.
 */
type Format = "landscape" | "portrait";

const FORMAT_DIMENSIONS: Record<Format, { width: number; height: number }> = {
  landscape: { width: 1270, height: 760 },
  portrait: { width: 1080, height: 1920 },
};

function parseFormat(req: NextRequest): Format {
  const raw = new URL(req.url).searchParams.get("format");
  return raw === "portrait" ? "portrait" : "landscape";
}

export async function GET(req: NextRequest) {
  const format = parseFormat(req);
  const { width, height } = FORMAT_DIMENSIONS[format];
  try {
    return new ImageResponse(
      format === "portrait" ? <HeroPortrait /> : <Hero />,
      { width, height, headers: CACHE_HEADERS },
    );
  } catch (err) {
    console.error("OG launch hero render failed", err);
    // Last-resort fallback — solid-gradient card with the brand only.
    // Avoids returning a 500 (which Vercel surfaces as
    // FUNCTION_INVOCATION_FAILED to the user); a degraded image still
    // works as a share card.
    return new ImageResponse(<Fallback />, {
      width,
      height,
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

/**
 * Portrait variant (1080×1920) for Instagram Story, Reels, WhatsApp
 * Status. Same content as Hero(), stacked vertically instead of
 * side-by-side. Tagline gets larger because we have ~3× more vertical
 * room — and because vertical scrolling viewers read top→bottom in
 * larger eye sweeps.
 */
function HeroPortrait() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        // Pack brand / panels / tagline as a centered stack with tight
        // 80px gaps between sections. Surplus vertical space now sits
        // as ambient gradient at the top + bottom of the image rather
        // than as 340px voids between sections — the gradient padding
        // reads as deliberate framing; an internal void reads as a
        // broken layout.
        justifyContent: "center",
        gap: 80,
        background:
          "linear-gradient(160deg, #6366f1 0%, #8b5cf6 50%, #10b981 100%)",
        color: "white",
        fontFamily: FONT_STACK,
        padding: 56,
      }}
    >
      {/* Brand row — same shape as landscape but larger */}
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
            width: 68,
            height: 68,
            borderRadius: 18,
            background: "white",
            color: "#6366f1",
            fontSize: 40,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          ₹
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          EasySplits
        </div>
      </div>

      {/* Two stacked panels — content-height so the surplus vertical
          space accrues to the parent's `justifyContent: space-between`
          (i.e. distributes between brand and tagline), not inside the
          panels themselves. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <GroupsPanel stretch={false} scale={1.3} />
        <WealthPanel stretch={false} scale={1.3} />
      </div>

      {/* Tagline — larger fonts since portrait reads top-to-bottom in
          larger sweeps and we have vertical room to spend. No marginTop
          here — the outer justifyContent: space-between sets the gap
          to brand and panels automatically. */}
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
            fontSize: 56,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            textAlign: "center",
          }}
        >
          Track money +
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 56,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginTop: -8,
          }}
        >
          split bills.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 500,
            marginTop: 14,
            opacity: 0.92,
          }}
        >
          India-first · encrypted · free
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 600,
            marginTop: 20,
            background: "rgba(255,255,255,0.18)",
            padding: "10px 22px",
            borderRadius: 999,
          }}
        >
          easysplits.in
        </div>
      </div>
    </div>
  );
}

type PanelProps = { stretch?: boolean; scale?: number };

function GroupsPanel({ stretch = true, scale = 1 }: PanelProps = {}) {
  return (
    <PanelShell accent="#6366f1" label="GROUPS" stretch={stretch} scale={scale}>
      <div
        style={{
          display: "flex",
          fontSize: 30 * scale,
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        Goa Trip · 4 friends
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 16 * scale,
          color: "#64748b",
          marginTop: -4,
        }}
      >
        Settled in 3 transfers
      </div>

      <ExpenseRow title="Hotel · 3 nights" amount="₹12,400" share={1.0} scale={scale} />
      <ExpenseRow title="Scooter rental" amount="₹3,200" share={0.26} scale={scale} />
      <ExpenseRow title="Dinner at Britto's" amount="₹2,800" share={0.23} scale={scale} />

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 6,
        }}
      >
        <Pill tone="amber" label="You owe" value="₹1,200" scale={scale} />
        <Pill tone="emerald" label="You're owed" value="₹500" scale={scale} />
      </div>
    </PanelShell>
  );
}

function WealthPanel({ stretch = true, scale = 1 }: PanelProps = {}) {
  return (
    <PanelShell accent="#10b981" label="PERSONAL FINANCE" stretch={stretch} scale={scale}>
      <div
        style={{
          display: "flex",
          fontSize: 30 * scale,
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        Net worth · ₹4.2 L
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 16 * scale,
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
          gap: 16 * scale,
          padding: 14 * scale,
          borderRadius: 18,
          background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64 * scale,
            height: 64 * scale,
            borderRadius: 999,
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "white",
            fontSize: 26 * scale,
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
              fontSize: 18 * scale,
              fontWeight: 700,
              color: "#065f46",
            }}
          >
            Financial Health
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 14 * scale,
              color: "#047857",
              marginTop: 2,
            }}
          >
            Solid foundations · 4-month streak
          </div>
        </div>
      </div>

      <PillarRow label="Emergency" pct={0.85} hex="#10b981" scale={scale} />
      <PillarRow label="Insurance" pct={0.7} hex="#6366f1" scale={scale} />
      <PillarRow label="Investing" pct={0.6} hex="#8b5cf6" scale={scale} />
    </PanelShell>
  );
}

function PanelShell({
  accent,
  label,
  stretch = true,
  scale = 1,
  children,
}: {
  accent: string;
  label: string;
  /** Landscape stretches each panel to fill half the row (`flex: 1`).
   *  Portrait wants content-height panels so the surplus vertical
   *  space distributes around the panels (via the outer container's
   *  justifyContent), not inside them as fake row-gap. */
  stretch?: boolean;
  /** Multiplier for all type + spacing sizes. 1 = landscape default;
   *  portrait uses ~1.3 to compensate for the image being viewed at
   *  ~36% scale on mobile (1080px image fit to ~390px phone width).
   *  Without this multiplier, body copy renders at sub-pixel sizes in
   *  IG Story / WhatsApp Status previews and reads as illegible. */
  scale?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: stretch ? 1 : "0 0 auto",
        background: "white",
        color: "#0f172a",
        borderRadius: 28,
        padding: 26 * scale,
        gap: 16 * scale,
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
            width: 10 * scale,
            height: 10 * scale,
            borderRadius: 999,
            background: accent,
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 16 * scale,
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
  scale = 1,
}: {
  title: string;
  amount: string;
  share: number;
  scale?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6 * scale,
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
            fontSize: 16 * scale,
            fontWeight: 600,
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 16 * scale,
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
          height: 6 * scale,
          background: "#f1f5f9",
          borderRadius: 999,
        }}
      >
        <div
          style={{
            display: "flex",
            width: Math.max(8, Math.round(share * 360 * scale)),
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
  scale = 1,
}: {
  label: string;
  pct: number;
  hex: string;
  scale?: number;
}) {
  const pctText = String(Math.round(pct * 100));
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4 * scale,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 14 * scale,
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
          height: 6 * scale,
          background: "#f1f5f9",
          borderRadius: 999,
        }}
      >
        <div
          style={{
            display: "flex",
            width: Math.max(8, Math.round(pct * 360 * scale)),
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
  scale = 1,
}: {
  tone: "amber" | "emerald";
  label: string;
  value: string;
  scale?: number;
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
        gap: 8 * scale,
        padding: `${8 * scale}px ${14 * scale}px`,
        borderRadius: 999,
        background: palette.bg,
        color: palette.fg,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 13 * scale,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 15 * scale,
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
