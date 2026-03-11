import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface AccuracyRecord {
  date: string;
  horizon1D: number;
  horizon7D: number;
  horizon30D: number;
  overall: number;
}

const horizonConfig = [
  { key: "1D", label: "1-Day", color: "#3b82f6" },
  { key: "7D", label: "7-Day", color: "#10b981" },
  { key: "30D", label: "30-Day", color: "#f59e0b" },
];

export function AccuracyTracker({ records, isLoading }: { records?: AccuracyRecord[]; isLoading: boolean }) {
  if (isLoading || !records) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[240px] w-full rounded-lg" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      </div>
    );
  }

  const latest = records[records.length - 1];
  const prev = records.length >= 8 ? records[records.length - 8] : records[0];

  const stats = [
    {
      label: "1-Day",
      value: latest?.horizon1D ?? 0,
      change: latest && prev ? latest.horizon1D - prev.horizon1D : 0,
      color: "#3b82f6",
    },
    {
      label: "7-Day",
      value: latest?.horizon7D ?? 0,
      change: latest && prev ? latest.horizon7D - prev.horizon7D : 0,
      color: "#10b981",
    },
    {
      label: "30-Day",
      value: latest?.horizon30D ?? 0,
      change: latest && prev ? latest.horizon30D - prev.horizon30D : 0,
      color: "#f59e0b",
    },
  ];

  const chartData = records.map((r) => ({
    date: r.date.slice(5),
    "1D": +(r.horizon1D * 100).toFixed(1),
    "7D": +(r.horizon7D * 100).toFixed(1),
    "30D": +(r.horizon30D * 100).toFixed(1),
  }));

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        {horizonConfig.map((h) => (
          <div key={h.key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: h.color }} />
            <span className="text-[10px] text-muted-foreground">{h.label}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <motion.div
        className="h-[220px] -ml-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              domain={[40, 85]}
              tickFormatter={(v: number) => `${v}%`}
              width={35}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#e4e4e7",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
              formatter={(value: number) => [`${value}%`]}
            />
            <Line
              type="monotone"
              dataKey="1D"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: "#3b82f6" }}
            />
            <Line
              type="monotone"
              dataKey="7D"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: "#10b981" }}
            />
            <Line
              type="monotone"
              dataKey="30D"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: "#f59e0b" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            className="p-2.5 rounded-lg bg-surface/40 border border-border/20 text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08 }}
          >
            <div className="text-[10px] text-muted-foreground mb-0.5">{s.label}</div>
            <div className="font-mono text-lg font-bold" style={{ color: s.color }}>
              {(s.value * 100).toFixed(1)}%
            </div>
            <div className={`font-mono text-[10px] ${s.change >= 0 ? "text-emerald" : "text-rose"}`}>
              {s.change >= 0 ? "+" : ""}{(s.change * 100).toFixed(1)}% vs 7d
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
