import { TrendingUp, TrendingDown, Star } from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useMemo, useState, useCallback, useEffect } from "react";
import { getWatchlist, toggleWatchlistItem } from "@/components/Watchlist";
import type { LivePrice } from "@/hooks/useWebSocket";

interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
}

export function MarketGrid({
  quotes,
  isLoading,
  livePrices,
}: {
  quotes?: Quote[];
  isLoading: boolean;
  livePrices?: Map<string, LivePrice>;
}) {
  if (isLoading || !quotes) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-lg" />
        ))}
      </div>
    );
  }

  const display = ["SPY", "QQQ", "^VIX", "XLK", "XLE", "XLF", "XLI", "XLY", "XLP", "XLV", "XLB", "GLD"];
  const filtered = display
    .map((s) => quotes.find((q) => q.symbol === s))
    .filter(Boolean) as Quote[];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
      {filtered.map((q, i) => {
        const live = livePrices?.get(q.symbol);
        const mergedQuote = live
          ? { ...q, price: live.price, change: live.change, changePercent: live.changePercent }
          : q;
        return (
          <motion.div
            key={q.symbol}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
          >
            <QuoteCard quote={mergedQuote} flash={live?.flash} />
          </motion.div>
        );
      })}
    </div>
  );
}

function MiniSparkline({ positive, seed }: { positive: boolean; seed: number }) {
  const points = useMemo(() => {
    const pts: number[] = [];
    let val = 50;
    for (let i = 0; i < 20; i++) {
      const noise = Math.sin(seed * 17 + i * 3.7) * 8 + Math.cos(seed * 11 + i * 2.3) * 5;
      val = Math.max(10, Math.min(90, val + noise * 0.3 + (positive ? 0.3 : -0.3)));
      pts.push(val);
    }
    return pts;
  }, [positive, seed]);

  const width = 80;
  const height = 24;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - (p / 100) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;
  const color = positive ? "rgb(16, 185, 129)" : "rgb(244, 63, 94)";
  const gradientId = `spark-${seed}`;

  return (
    <svg width={width} height={height} className="opacity-40 group-hover:opacity-70 transition-opacity duration-300">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function QuoteCard({ quote, flash }: { quote: Quote; flash?: "up" | "down" | null }) {
  const [, navigate] = useLocation();
  const [isWatched, setIsWatched] = useState(false);

  useEffect(() => {
    setIsWatched(getWatchlist().includes(quote.symbol));
  }, [quote.symbol]);

  const handleStar = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const newList = toggleWatchlistItem(quote.symbol);
      setIsWatched(newList.includes(quote.symbol));
    },
    [quote.symbol]
  );

  const isPositive = quote.changePercent > 0;
  const isNegative = quote.changePercent < 0;
  const isVix = quote.symbol === "^VIX";

  const borderColor = isPositive
    ? "border-emerald/15 hover:border-emerald/35"
    : isNegative
    ? "border-rose/15 hover:border-rose/35"
    : "border-border/20 hover:border-border/50";

  const bgGlow = isPositive
    ? "hover:shadow-[inset_0_1px_24px_rgba(16,185,129,0.06)]"
    : isNegative
    ? "hover:shadow-[inset_0_1px_24px_rgba(244,63,94,0.06)]"
    : "";

  const textColor = isPositive ? "text-emerald" : isNegative ? "text-rose" : "text-muted-foreground";
  const Icon = isPositive ? TrendingUp : TrendingDown;

  const seed = quote.symbol.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

  // Flash animation classes
  const flashClass = flash === "up"
    ? "ring-1 ring-emerald/40 bg-emerald/5"
    : flash === "down"
    ? "ring-1 ring-rose/40 bg-rose/5"
    : "";

  return (
    <div
      onClick={() => navigate(`/ticker/${encodeURIComponent(quote.symbol)}`)}
      className={`rounded-lg border ${borderColor} bg-surface/40 p-3 transition-all duration-300 cursor-pointer ${bgGlow} ${flashClass} group relative overflow-hidden hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]`}
    >
      {/* Sparkline background */}
      <div className="absolute bottom-0 right-0">
        <MiniSparkline positive={isPositive} seed={seed} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-xs font-bold text-foreground/90 tracking-tight">
            {quote.symbol.replace("^", "")}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleStar}
              className={`p-0.5 rounded transition-all ${
                isWatched ? "opacity-100" : "opacity-0 group-hover:opacity-60"
              } hover:opacity-100`}
            >
              <Star
                className={`w-3 h-3 ${isWatched ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`}
              />
            </button>
            <Icon
              className={`w-3 h-3 ${textColor} opacity-40 group-hover:opacity-100 transition-opacity duration-300`}
            />
          </div>
        </div>
        <div className={`font-mono text-[15px] font-bold text-foreground mb-0.5 tracking-tight transition-colors duration-300 ${flash === "up" ? "text-emerald" : flash === "down" ? "text-rose" : ""}`}>
          {isVix ? quote.price.toFixed(2) : `$${quote.price.toFixed(2)}`}
        </div>
        <div className={`font-mono text-[11px] font-semibold ${textColor}`}>
          {isPositive ? "+" : ""}
          {quote.changePercent.toFixed(2)}%
        </div>
        <div className="text-[9px] text-muted-foreground/60 mt-1 truncate">{quote.name}</div>
      </div>
    </div>
  );
}
