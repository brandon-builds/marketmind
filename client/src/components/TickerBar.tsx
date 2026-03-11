import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import type { LivePrice } from "@/hooks/useWebSocket";

interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface DisplayQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  flash: "up" | "down" | null;
}

export function TickerBar({
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
      <div className="h-8 bg-surface border-b border-border/30 flex items-center gap-8 px-4 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-28 shrink-0" />
        ))}
      </div>
    );
  }

  const keySymbols = [
    "SPY", "QQQ", "^VIX", "XLK", "XLE", "XLF", "XLI", "XLY", "XLP", "XLV",
    "XLB", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "GLD", "USO", "TLT",
  ];

  const filtered: DisplayQuote[] = keySymbols
    .map((s) => {
      const base = quotes.find((q) => q.symbol === s);
      if (!base) return null;
      const live = livePrices?.get(s);
      if (live) {
        return {
          symbol: base.symbol,
          name: base.name,
          price: live.price,
          change: live.change,
          changePercent: live.changePercent,
          flash: live.flash ?? null,
        };
      }
      return { ...base, flash: null as "up" | "down" | null };
    })
    .filter(Boolean) as DisplayQuote[];

  return (
    <div className="h-8 bg-surface/80 border-b border-border/20 flex items-center overflow-hidden relative">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-surface/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-surface/80 to-transparent z-10 pointer-events-none" />
      <div className="flex items-center gap-0 animate-marquee whitespace-nowrap">
        {[...filtered, ...filtered].map((q, i) => (
          <TickerItem key={`${q.symbol}-${i}`} quote={q} />
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 80s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
        @keyframes flashGreen {
          0% { background-color: rgba(16, 185, 129, 0.2); }
          100% { background-color: transparent; }
        }
        @keyframes flashRed {
          0% { background-color: rgba(244, 63, 94, 0.2); }
          100% { background-color: transparent; }
        }
        .flash-up {
          animation: flashGreen 0.6s ease-out;
        }
        .flash-down {
          animation: flashRed 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}

function TickerItem({ quote }: { quote: DisplayQuote }) {
  const [, navigate] = useLocation();
  const isPositive = quote.changePercent > 0;
  const isNegative = quote.changePercent < 0;
  const colorClass = isPositive ? "text-emerald" : isNegative ? "text-rose" : "text-muted-foreground";
  const flashClass = quote.flash === "up" ? "flash-up" : quote.flash === "down" ? "flash-down" : "";

  return (
    <div
      onClick={() => navigate(`/ticker/${encodeURIComponent(quote.symbol)}`)}
      className={`flex items-center gap-2 text-[11px] shrink-0 px-4 py-1 border-r border-border/10 cursor-pointer hover:bg-surface/50 transition-colors ${flashClass}`}
    >
      <span className="font-mono font-bold text-foreground/90 tracking-tight">
        {quote.symbol.replace("^", "")}
      </span>
      <span className="font-mono text-foreground/50 tabular-nums">
        {quote.symbol === "^VIX" ? "" : "$"}
        {quote.price.toFixed(2)}
      </span>
      <span className={`font-mono font-medium tabular-nums ${colorClass}`}>
        {isPositive ? "+" : ""}
        {quote.changePercent.toFixed(2)}%
      </span>
    </div>
  );
}
