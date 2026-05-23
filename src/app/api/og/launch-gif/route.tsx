/**
 * Server-rendered animated GIF for the ProductHunt launch demo.
 *
 * Renders 6 marketing-style frames via Next.js's `ImageResponse` (the
 * same Satori+resvg pipeline as `/api/og/launch` and `/api/og/milestone`),
 * decodes each PNG to RGBA pixels, quantizes to a 256-color palette,
 * and composites the sequence into an animated GIF via `gifenc`.
 *
 * Single endpoint, single URL — drop it straight into PH's video/GIF
 * slot at https://easysplits.in/api/og/launch-gif.
 *
 * Trade-offs:
 *   - GIF is a slideshow (4s/frame × 6 = 24s loop), not a true motion
 *     demo. PH viewers see it as marketing creative, which is the
 *     intent.
 *   - At 800×600 with 6 quantized frames, output is typically
 *     400-900 KB. Comfortably under PH's 5 MB limit.
 *   - Lambda runtime ~4-8s end-to-end (6 × ImageResponse + 6 ×
 *     pngjs decode + 6 × quantize). 1 hour CDN cache keeps repeat
 *     requests off the Lambda.
 *
 * If this ever fails on Vercel: fall back to multi-frame static PNGs
 * (Option A — `/api/og/launch?frame=N`) which user assembles via
 * ezgif.com in ~30 seconds. No new deps required for that path.
 */

import { ImageResponse } from "next/og";
import { PNG } from "pngjs";
import { GIFEncoder, quantize, applyPalette } from "gifenc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 800;
const HEIGHT = 600;
/** Per-frame display time in MILLISECONDS. gifenc converts to the
 *  GIF-spec centiseconds internally — passing 400 here gave us 0.4s
 *  per frame (whole loop ran in 2.4s). 4000 = 4 sec/frame, 24s loop. */
const FRAME_DELAY_MS = 4000;

const FONT_STACK =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const GRADIENT_BG =
  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #10b981 100%)";

async function frameToRgba(jsx: React.ReactElement): Promise<Uint8Array> {
  const response = new ImageResponse(jsx, { width: WIDTH, height: HEIGHT });
  const pngBytes = Buffer.from(await response.arrayBuffer());
  const png = PNG.sync.read(pngBytes);
  // png.data is a Buffer in RGBA order. gifenc wants a plain Uint8Array
  // (or Uint8ClampedArray) backed by ArrayBuffer; Buffer extends Uint8Array
  // so we can pass it through, but be explicit for clarity.
  return new Uint8Array(
    png.data.buffer,
    png.data.byteOffset,
    png.data.byteLength,
  );
}

export async function GET() {
  try {
    const frames: React.ReactElement[] = [
      <FrameBrand key="brand" />,
      <FrameGroupsIntro key="g-intro" />,
      <FrameGroupsDetail key="g-detail" />,
      <FrameWealthIntro key="w-intro" />,
      <FrameWealthDetail key="w-detail" />,
      <FrameEnd key="end" />,
    ];

    const gif = GIFEncoder();
    for (const frame of frames) {
      const rgba = await frameToRgba(frame);
      // 256 colors is enough for our gradient + flat-color palette.
      // Smaller palettes would compress better but introduce visible
      // banding on the gradient backgrounds.
      const palette = quantize(rgba, 256);
      const indexed = applyPalette(rgba, palette);
      gif.writeFrame(indexed, WIDTH, HEIGHT, {
        palette,
        delay: FRAME_DELAY_MS,
      });
    }
    gif.finish();

    return new Response(Buffer.from(gif.bytes()), {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control":
          "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("Launch GIF render failed", err);
    return new Response("GIF generation failed", { status: 500 });
  }
}

/* ─────────── Shared visual primitives (all satori-safe) ─────────── */

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: GRADIENT_BG,
        color: "white",
        fontFamily: FONT_STACK,
        padding: 48,
      }}
    >
      {children}
    </div>
  );
}

function BrandRow() {
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

/* ─────────── Six frames ─────────── */

function FrameBrand() {
  return (
    <Backdrop>
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 24,
            background: "white",
            color: "#6366f1",
            fontSize: 56,
            fontWeight: 800,
          }}
        >
          ₹
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          EasySplits
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 500,
            opacity: 0.92,
          }}
        >
          Track money + split bills.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 16,
            fontWeight: 500,
            opacity: 0.75,
            marginTop: 4,
          }}
        >
          India-first · encrypted · free
        </div>
      </div>
    </Backdrop>
  );
}

function FrameGroupsIntro() {
  return (
    <Backdrop>
      <BrandRow />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.15em",
            opacity: 0.85,
          }}
        >
          1 · SPLIT BILLS
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginTop: 8,
          }}
        >
          With friends,
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginTop: -8,
          }}
        >
          without the math.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 20,
            fontWeight: 500,
            opacity: 0.9,
            marginTop: 14,
          }}
        >
          Groups · simplified payments · multi-currency · offline-ready
        </div>
      </div>
    </Backdrop>
  );
}

function FrameGroupsDetail() {
  return (
    <Backdrop>
      <BrandRow />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "white",
            color: "#0f172a",
            borderRadius: 24,
            padding: 24,
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "#6366f1",
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: 13,
                fontWeight: 700,
                color: "#475569",
                letterSpacing: "0.12em",
              }}
            >
              GROUPS
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            Goa Trip · 4 friends
          </div>
          <ExpenseRow title="Hotel · 3 nights" amount="₹12,400" share={1.0} />
          <ExpenseRow title="Scooter rental" amount="₹3,200" share={0.26} />
          <ExpenseRow title="Dinner at Britto's" amount="₹2,800" share={0.23} />
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 4,
            }}
          >
            <Pill tone="amber" label="You owe" value="₹1,200" />
            <Pill tone="emerald" label="You're owed" value="₹500" />
          </div>
        </div>
      </div>
    </Backdrop>
  );
}

function FrameWealthIntro() {
  return (
    <Backdrop>
      <BrandRow />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.15em",
            opacity: 0.85,
          }}
        >
          2 · TRACK YOUR MONEY
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginTop: 8,
          }}
        >
          Net worth +
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginTop: -8,
          }}
        >
          financial health.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 20,
            fontWeight: 500,
            opacity: 0.9,
            marginTop: 14,
          }}
        >
          5-pillar scorecard · India-tuned · encrypted end-to-end
        </div>
      </div>
    </Backdrop>
  );
}

function FrameWealthDetail() {
  return (
    <Backdrop>
      <BrandRow />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "white",
            color: "#0f172a",
            borderRadius: 24,
            padding: 24,
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "#10b981",
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: 13,
                fontWeight: 700,
                color: "#475569",
                letterSpacing: "0.12em",
              }}
            >
              PERSONAL FINANCE
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            Net worth · ₹4.2 L
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: 12,
              borderRadius: 16,
              background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 56,
                height: 56,
                borderRadius: 999,
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "white",
                fontSize: 22,
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
                  display: "flex",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#065f46",
                }}
              >
                Financial Health
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 12,
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
        </div>
      </div>
    </Backdrop>
  );
}

function FrameEnd() {
  return (
    <Backdrop>
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "white",
            color: "#6366f1",
            fontSize: 48,
            fontWeight: 800,
          }}
        >
          ₹
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 56,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginTop: 4,
          }}
        >
          EasySplits
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 500,
            opacity: 0.92,
          }}
        >
          Track money + split bills. India-first, encrypted, free.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 700,
            marginTop: 16,
            background: "white",
            color: "#6366f1",
            padding: "10px 24px",
            borderRadius: 999,
          }}
        >
          easysplits.in
        </div>
      </div>
    </Backdrop>
  );
}

/* ─────────── Reusable row components ─────────── */

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
        gap: 4,
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
            fontSize: 14,
            fontWeight: 600,
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 14,
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
          height: 5,
          background: "#f1f5f9",
          borderRadius: 999,
        }}
      >
        <div
          style={{
            display: "flex",
            width: Math.max(8, Math.round(share * 300)),
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
        gap: 3,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
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
          height: 5,
          background: "#f1f5f9",
          borderRadius: 999,
        }}
      >
        <div
          style={{
            display: "flex",
            width: Math.max(6, Math.round(pct * 300)),
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
        padding: "6px 12px",
        borderRadius: 999,
        background: palette.bg,
        color: palette.fg,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  );
}
