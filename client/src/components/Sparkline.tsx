import { useMemo } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  color?: string;
  fillOpacity?: number;
  showDots?: boolean;
  label?: string;
}

/**
 * Lightweight SVG sparkline chart.
 * Renders a smooth line with optional gradient fill.
 */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  strokeWidth = 1.5,
  color,
  fillOpacity = 0.15,
  showDots = false,
  label,
}: SparklineProps) {
  const { path, fillPath, points, autoColor, changePercent } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: "", fillPath: "", points: [], autoColor: "#64748b", changePercent: 0 };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const w = width - padding * 2;
    const h = height - padding * 2;

    const pts = data.map((v, i) => ({
      x: padding + (i / (data.length - 1)) * w,
      y: padding + h - ((v - min) / range) * h,
    }));

    // Build SVG path
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      // Smooth curve using quadratic bezier
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` Q ${cpx} ${prev.y}, ${curr.x} ${curr.y}`;
    }

    // Fill path (close to bottom)
    const fd = `${d} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;

    // Auto color based on trend
    const first = data[0];
    const last = data[data.length - 1];
    const change = ((last - first) / first) * 100;
    const ac = change >= 0 ? "#10b981" : "#ef4444";

    return { path: d, fillPath: fd, points: pts, autoColor: ac, changePercent: change };
  }, [data, width, height]);

  const strokeColor = color || autoColor;

  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-slate-600 text-[10px]"
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`sparkline-fill-${strokeColor.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <path
          d={fillPath}
          fill={`url(#sparkline-fill-${strokeColor.replace("#", "")})`}
        />

        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {showDots && points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={1.5}
            fill={strokeColor}
            opacity={i === points.length - 1 ? 1 : 0.5}
          />
        ))}

        {/* End dot (always show last point) */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={2}
            fill={strokeColor}
          />
        )}
      </svg>

      {label && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500">{label}</span>
          <span className={`text-[10px] font-medium ${changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Generate simulated historical price data for a ticker.
 * Uses a seeded random walk based on the ticker symbol for consistency.
 */
export function generateHistoricalPrices(
  ticker: string,
  currentPrice: number,
  days: number = 30
): number[] {
  // Simple seed from ticker string
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) {
    seed = ((seed << 5) - seed + ticker.charCodeAt(i)) | 0;
  }

  const prices: number[] = [];
  const volatility = 0.015; // 1.5% daily volatility
  let price = currentPrice * (0.85 + (Math.abs(seed % 30) / 100)); // Start 85-115% of current

  for (let i = 0; i < days; i++) {
    // Deterministic pseudo-random based on seed + day
    const x = Math.sin(seed * 9301 + i * 49297 + 233280) * 10000;
    const rand = x - Math.floor(x);
    const change = (rand - 0.48) * volatility; // Slight upward bias
    price = price * (1 + change);
    prices.push(Math.round(price * 100) / 100);
  }

  // Ensure the last price matches the current price
  prices[prices.length - 1] = currentPrice;

  return prices;
}
