"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "@/lib/format";

/**
 * Lazy-loaded recharts inner for the multi-month trend card. Grouped
 * bars: income (green), expense (rose), investment (cyan) per month.
 * Kept in a separate file so the dynamic import on the parent
 * doesn't drag recharts into the personal-dashboard bundle until
 * this card actually renders.
 */

type Row = {
  monthLabel: string;
  income: number;
  expenses: number;
  investments: number;
  savingsRate: number;
  entryCount: number;
};

const tooltipStyle: React.CSSProperties = {
  background: "rgba(15,23,42,0.96)",
  border: "none",
  borderRadius: 10,
  color: "white",
  fontSize: 11,
  padding: "6px 10px",
};

export default function YearlyTrendChartInner({
  series,
}: {
  series: Row[];
}) {
  const formatTick = (v: number): string => {
    if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
    if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
    if (v >= 1000) return `${Math.round(v / 1000)}k`;
    return String(v);
  };

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <BarChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <CartesianGrid
            stroke="currentColor"
            strokeOpacity={0.08}
            vertical={false}
          />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 10, fill: "currentColor" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "currentColor" }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={formatTick}
          />
          <Tooltip
            formatter={(value, name) =>
              typeof value === "number"
                ? [formatINR(value, 0), name]
                : [String(value), name]
            }
            contentStyle={tooltipStyle}
            cursor={{ fill: "currentColor", fillOpacity: 0.05 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar
            dataKey="expenses"
            name="Expenses"
            fill="#f43f5e"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="investments"
            name="Investments"
            fill="#06b6d4"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
