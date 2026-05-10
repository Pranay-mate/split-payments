/**
 * Shared JSX builder for the EasySplits brand icon — v2.6 "gradient
 * sweep donut + ₹". Used by every icon route file (`app/icon.tsx`,
 * `app/icon0.tsx`, etc.) so all sizes render the exact same mark.
 *
 * Returned JSX is fed into `next/og` ImageResponse, which uses Satori
 * under the hood (CSS-only, no <svg> primitives).
 */
export function brandIconJSX(size: number, isMaskable: boolean) {
  // Maskable icons need to fit the inner-80 % safe zone so Android's
  // adaptive-icon crop doesn't slice the donut.
  const ringPct = isMaskable ? 0.56 : 0.72;
  const ringPx = Math.round(size * ringPct);
  const holePx = Math.round(ringPx * 0.62);
  const fontPx = Math.round(holePx * 0.7);

  return (
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
  );
}
