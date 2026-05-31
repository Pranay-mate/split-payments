"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "@/lib/format";
import { formatDate } from "@/lib/format-date";

type Snapshot = {
  snapshotDate: string;
  totalValue: number;
  liquidSavings: number;
  holdingsValue: number;
};

/** Lazy-loaded recharts inner — kept in its own file so the dynamic
 *  import on the parent doesn't drag recharts into the wealth-view
 *  bundle until the trajectory section actually renders. */
export default function NetWorthChartInner({
  data,
  userTz,
  tooltipStyle,
}: {
  data: Snapshot[];
  userTz: string;
  tooltipStyle: React.CSSProperties;
}) {
  const chartData = data.map((s) => ({
    label: formatDate(`${s.snapshotDate}T00:00:00`, userTz, "short"),
    total: s.totalValue,
  }));

  const min = Math.max(0, Math.min(...data.map((s) => s.totalValue)) * 0.92);
  const max = Math.max(...data.map((s) => s.totalValue)) * 1.05;

  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 5, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "currentColor" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "currentColor" }}
            axisLine={false}
            tickLine={false}
            domain={[min, max]}
            width={56}
            tickFormatter={(v: number) =>
              v >= 1e7
                ? `${(v / 1e7).toFixed(1)}Cr`
                : v >= 1e5
                  ? `${(v / 1e5).toFixed(1)}L`
                  : `${Math.round(v / 1000)}k`
            }
          />
          <Tooltip
            formatter={(value) =>
              typeof value === "number" ? formatINR(value, 0) : `${value}`
            }
            contentStyle={tooltipStyle}
            cursor={{ stroke: "#10b981", strokeOpacity: 0.4, strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#netWorthFill)"
            isAnimationActive
            animationDuration={700}
            dot={false}
            activeDot={{
              r: 5,
              fill: "#10b981",
              stroke: "white",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
