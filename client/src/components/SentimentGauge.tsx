import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SentimentGaugeProps {
  score?: number;
  label?: string;
  isLoading: boolean;
}

const labelColors: Record<string, string> = {
  "Extreme Fear": "text-rose",
  "Fear": "text-rose/80",
  "Neutral": "text-amber",
  "Greed": "text-emerald/80",
  "Extreme Greed": "text-emerald",
};

const labelDescriptions: Record<string, string> = {
  "Extreme Fear": "Markets in panic — contrarian buy signal",
  "Fear": "Elevated caution — risk-off positioning",
  "Neutral": "Balanced — no clear directional bias",
  "Greed": "Risk appetite rising — bulls in control",
  "Extreme Greed": "Euphoria — historically precedes corrections",
};

// Sub-indicators for richer detail
const subIndicators = [
  { name: "Put/Call Ratio", value: 0.87, direction: "bearish" as const },
  { name: "VIX Trend", value: -2.3, direction: "bullish" as const },
  { name: "Breadth", value: 52, direction: "neutral" as const },
  { name: "Momentum", value: 1.4, direction: "bullish" as const },
];

export function SentimentGauge({ score, label, isLoading }: SentimentGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    if (score === undefined) return;
    const duration = 1200;
    const startTime = Date.now();
    const startVal = animatedScore;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(startVal + (score - startVal) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score]);

  if (isLoading || score === undefined) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <Skeleton className="w-36 h-36 rounded-full" />
        <Skeleton className="h-5 w-24" />
        <div className="w-full space-y-2 mt-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    );
  }

  const displayLabel = label ?? "Neutral";

  const getColor = (s: number) => {
    if (s < 20) return { ring: "#f43f5e", text: "text-rose" };
    if (s < 40) return { ring: "#fb7185", text: "text-rose/80" };
    if (s < 60) return { ring: "#f59e0b", text: "text-amber" };
    if (s < 80) return { ring: "#34d399", text: "text-emerald/80" };
    return { ring: "#10b981", text: "text-emerald" };
  };

  const { ring, text } = getColor(animatedScore);
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (animatedScore / 100) * circumference * 0.75;
  const rotation = 135;

  return (
    <div className="flex flex-col items-center gap-2 py-1">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 140 140" className="w-full h-full">
          {/* Background arc */}
          <circle
            cx="70" cy="70" r="60"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="7"
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            strokeLinecap="round"
            transform={`rotate(${rotation} 70 70)`}
          />
          {/* Value arc */}
          <circle
            cx="70" cy="70" r="60"
            fill="none"
            stroke={ring}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(${rotation} 70 70)`}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 10px ${ring}50)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-mono text-3xl font-bold ${text}`}>{animatedScore}</span>
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">/ 100</span>
        </div>
      </div>

      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <span className={`font-display text-sm font-bold ${labelColors[displayLabel] || text}`}>{displayLabel}</span>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5 max-w-[180px] leading-relaxed">
          {labelDescriptions[displayLabel] || "Composite market sentiment"}
        </p>
      </motion.div>

      {/* Sub-indicators */}
      <motion.div
        className="w-full mt-2 pt-2 border-t border-border/15 space-y-1.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {subIndicators.map((ind) => {
          const dirColor = ind.direction === "bullish" ? "text-emerald" : ind.direction === "bearish" ? "text-rose" : "text-muted-foreground";
          const DirIcon = ind.direction === "bullish" ? TrendingUp : ind.direction === "bearish" ? TrendingDown : Minus;
          return (
            <div key={ind.name} className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground/70">{ind.name}</span>
              <div className="flex items-center gap-1">
                <DirIcon className={`w-2.5 h-2.5 ${dirColor}`} />
                <span className={`font-mono font-medium ${dirColor}`}>
                  {ind.direction === "neutral" ? "Neutral" : ind.direction === "bullish" ? "Bullish" : "Bearish"}
                </span>
              </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
