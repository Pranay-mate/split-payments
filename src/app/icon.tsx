import { ImageResponse } from "next/og";

/**
 * EasySplits app icon — v2.6 "gradient sweep donut + ₹".
 *
 * One source, six exports via `generateImageMetadata`:
 *   /icon/32, /icon/64, /icon/192, /icon/512
 *   /icon/192-maskable, /icon/512-maskable
 *
 * Standard variants fill ~70 % of the canvas. Maskable variants fit the
 * Android adaptive-icon safe zone (inner 80 %), so the donut shrinks to
 * ~55 % of the canvas and the dark navy bleeds to the edges.
 */

const SIZES = {
  "32": 32,
  "64": 64,
  "192": 192,
  "512": 512,
  "192-maskable": 192,
  "512-maskable": 512,
} as const;

export const dynamic = "force-static";
export const contentType = "image/png";

export function generateImageMetadata() {
  return Object.entries(SIZES).map(([id, n]) => ({
    id,
    size: { width: n, height: n },
    contentType: "image/png",
  }));
}

export default function Icon({ id }: { id: string }) {
  const size = SIZES[id as keyof typeof SIZES] ?? 64;
  const isMaskable = id.endsWith("-maskable");

  // % of canvas for the outer ring diameter
  const ringPct = isMaskable ? 0.56 : 0.72;
  const ringPx = Math.round(size * ringPct);
  const holePx = Math.round(ringPx * 0.62);
  const fontPx = Math.round(holePx * 0.7);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
        }}
      >
        <div
          style={{
            width: ringPx,
            height: ringPx,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, #10b981 0%, #6366f1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: holePx,
              height: holePx,
              borderRadius: "50%",
              background: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontFamily:
                "'Noto Sans', ui-sans-serif, system-ui, -apple-system, sans-serif",
              fontSize: fontPx,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            ₹
          </div>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
