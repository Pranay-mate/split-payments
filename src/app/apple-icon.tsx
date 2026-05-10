import { ImageResponse } from "next/og";

/**
 * iOS home-screen icon — same v2.6 "gradient sweep donut + ₹" design as
 * the standard icon, sized 180×180. iOS adds its own rounded corners,
 * so we use a flat dark-navy bleed to the edges.
 */

export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const ringPx = Math.round(size.width * 0.7);
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
            background: "linear-gradient(135deg, #10b981 0%, #6366f1 100%)",
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
    { ...size },
  );
}
