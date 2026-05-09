"use client";

/**
 * Per-pillar mini-sparkline. Inline SVG (no recharts) so it's
 * essentially free to render even with one per pillar.
 *
 * Renders nothing if fewer than 2 data points — single-point
 * "trend" is misleading.
 */
export function PillarSparkline({
  series,
  hex = "#10b981",
  width = 64,
  height = 22,
}: {
  series: number[];
  hex?: string;
  width?: number;
  height?: number;
}) {
  if (series.length < 2) return null;

  const max = 20;
  const min = 0;
  const xStep = width / (series.length - 1);

  const points = series.map((v, i) => {
    const x = i * xStep;
    const y = height - ((v - min) / (max - min)) * height;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="shrink-0"
    >
      <path
        d={path}
        fill="none"
        stroke={hex}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <circle cx={last[0]} cy={last[1]} r={2} fill={hex} />
    </svg>
  );
}
