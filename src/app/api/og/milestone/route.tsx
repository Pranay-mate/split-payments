/**
 * OG share-card generator. 1200×630 PNG suitable for Twitter/X cards,
 * WhatsApp link previews, LinkedIn shares, etc.
 *
 * Privacy-safe by design:
 *   - No PII other than user-supplied initials (first letter of name).
 *   - All inputs come via URL params; the server doesn't read the
 *     viewing user's auth cookie. Anyone with the URL sees the card.
 *   - Amounts in INR are accepted but the caller is expected to round
 *     or omit them when sharing — we don't enforce.
 *
 * Supported milestone types:
 *   ?type=score   — shows the 5-pillar score (0..100) + band label
 *   ?type=badge   — shows a single achievement (emoji + label)
 *   ?type=goal    — shows a goal hit (label + 100% progress)
 *   ?type=settled — shows a group fully settled (group name)
 */

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge"; // ImageResponse runs on edge

const BAND_GRADIENTS = {
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

type Band = keyof typeof BAND_GRADIENTS;

/** Defensive parse: returns the param if it's a known band, else "emerald". */
function parseBand(s: string | null): Band {
  if (s === "red" || s === "amber" || s === "emerald" || s === "green") {
    return s;
  }
  return "emerald";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "score";
  const initial = (url.searchParams.get("initial") ?? "ES").slice(0, 2);

  if (type === "badge") {
    return badgeCard({
      emoji: url.searchParams.get("emoji") ?? "🏆",
      label: url.searchParams.get("label") ?? "Badge unlocked",
      initial,
    });
  }
  if (type === "goal") {
    return goalCard({
      label: url.searchParams.get("label") ?? "Goal hit",
      initial,
    });
  }
  if (type === "settled") {
    return settledCard({
      groupName: url.searchParams.get("group") ?? "Group settled",
      initial,
    });
  }
  // default: score
  return scoreCard({
    score: Number(url.searchParams.get("score") ?? 0),
    band: parseBand(url.searchParams.get("band")),
    initial,
  });
}

function scoreCard({
  score,
  band,
  initial,
}: {
  score: number;
  band: Band;
  initial: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BAND_GRADIENTS[band],
          color: "white",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: 80,
        }}
      >
        <Brand initial={initial} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            marginTop: 40,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              opacity: 0.9,
            }}
          >
            Financial Health Score
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              marginTop: 16,
            }}
          >
            <div
              style={{
                fontSize: 240,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              {score}
            </div>
            <div
              style={{
                fontSize: 80,
                fontWeight: 600,
                marginLeft: 16,
                opacity: 0.7,
              }}
            >
              /100
            </div>
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 600,
              marginTop: 12,
              opacity: 0.95,
            }}
          >
            {BAND_LABEL[band]}
          </div>
        </div>
        <Footer />
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function badgeCard({
  emoji,
  label,
  initial,
}: {
  emoji: string;
  label: string;
  initial: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #ea580c 100%)",
          color: "white",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: 80,
        }}
      >
        <Brand initial={initial} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
            marginTop: 20,
          }}
        >
          <div style={{ fontSize: 240, lineHeight: 1 }}>{emoji}</div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginTop: 32,
              opacity: 0.95,
            }}
          >
            Achievement unlocked
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginTop: 12,
              textAlign: "center",
            }}
          >
            {label}
          </div>
        </div>
        <Footer />
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function goalCard({ label, initial }: { label: string; initial: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #10b981 100%)",
          color: "white",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: 80,
        }}
      >
        <Brand initial={initial} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            marginTop: 40,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              opacity: 0.9,
            }}
          >
            🎯 Goal hit
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginTop: 16,
              lineHeight: 1.1,
            }}
          >
            {label}
          </div>
          <div
            style={{
              marginTop: 40,
              height: 24,
              borderRadius: 12,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              padding: 4,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 8,
                background: "white",
              }}
            />
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 24,
              fontWeight: 600,
              opacity: 0.95,
            }}
          >
            100% complete
          </div>
        </div>
        <Footer />
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function settledCard({
  groupName,
  initial,
}: {
  groupName: string;
  initial: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #10b981 0%, #059669 50%, #0d9488 100%)",
          color: "white",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: 80,
        }}
      >
        <Brand initial={initial} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            marginTop: 40,
          }}
        >
          <div style={{ fontSize: 200, lineHeight: 1 }}>✓</div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginTop: 16,
              opacity: 0.95,
            }}
          >
            All settled
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginTop: 12,
            }}
          >
            {groupName}
          </div>
          <div
            style={{
              fontSize: 32,
              marginTop: 16,
              opacity: 0.9,
            }}
          >
            Zero open balances
          </div>
        </div>
        <Footer />
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

/** Top-left brand block. Initial is in a gradient avatar pill.
 *  No backdrop-filter — Satori (the OG image engine) doesn't support
 *  it; using opaque rgba background instead. */
function Brand({ initial }: { initial: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.22)",
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        {initial.toUpperCase()}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          opacity: 0.95,
        }}
      >
        EasySplits
      </div>
    </div>
  );
}

/** Bottom-right URL footer. Subtle, non-cluttering. */
function Footer() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        opacity: 0.8,
        fontSize: 22,
        fontWeight: 500,
      }}
    >
      <div>India-first split + personal finance</div>
      <div>split-payments-sigma.vercel.app</div>
    </div>
  );
}
