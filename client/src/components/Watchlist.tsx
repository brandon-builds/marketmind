import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

const WATCHLIST_KEY = "marketmind_watchlist";

export function getWatchlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
  } catch { return []; }
}

export function setWatchlist(list: string[]) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
}

export function toggleWatchlistItem(symbol: string): string[] {
  const list = getWatchlist();
  const idx = list.indexOf(symbol);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(symbol);
  setWatchlist(list);
  return [...list];
}

export function isInWatchlist(symbol: string): boolean {
  return getWatchlist().includes(symbol);
}

interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export function Watchlist({ quotes, isLoading }: { quotes?: Quote[]; isLoading: boolean }) {
  const [, navigate] = useLocation();
  const [watchlist, setWl] = useState<string[]>([]);

  useEffect(() => {
    setWl(getWatchlist());
    // Listen for storage events from other tabs
    const handler = () => setWl(getWatchlist());
    window.addEventListener("storage", handler);
    // Also poll every 2s for same-tab updates
    const interval = setInterval(handler, 2000);
    return () => {
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, []);

  const removeFromWatchlist = useCallback((symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newList = watchlist.filter(s => s !== symbol);
    setWatchlist(newList);
    setWl(newList);
  }, [watchlist]);

  const quickAddTickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META"];

  const handleQuickAdd = useCallback((symbol: string) => {
    const newList = [...watchlist, symbol];
    setWatchlist(newList);
    setWl(newList);
  }, [watchlist]);

  if (watchlist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <Star className="w-6 h-6 text-amber-400/30 mb-2" />
        <p className="text-xs font-medium text-foreground/70 mb-1">Build your watchlist</p>
        <p className="text-[10px] text-muted-foreground/50 mb-3 max-w-[220px] leading-relaxed">
          Add tickers to track prices, get personalized signals, and see sparkline charts on the Watchlist page.
        </p>
        <p className="text-[9px] text-muted-foreground/40 mb-2 uppercase tracking-wider font-medium">Quick add popular tickers</p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {quickAddTickers.map(t => (
            <button
              key={t}
              onClick={() => handleQuickAdd(t)}
              className="px-2 py-1 rounded-md text-[10px] font-mono font-medium bg-surface/40 border border-border/20 text-muted-foreground/70 hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
            >
              +{t}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const watchedQuotes = watchlist
    .map(s => quotes?.find(q => q.symbol === s))
    .filter(Boolean) as Quote[];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[200px]">
      <div className="space-y-1.5 pr-2">
        <AnimatePresence>
          {watchedQuotes.map((q) => {
            const isPositive = q.changePercent > 0;
            const isNegative = q.changePercent < 0;
            const colorClass = isPositive ? "text-emerald" : isNegative ? "text-rose" : "text-muted-foreground";
            const DirIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

            return (
              <motion.div
                key={q.symbol}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onClick={() => navigate(`/ticker/${encodeURIComponent(q.symbol)}`)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface/30 border border-border/10 cursor-pointer hover:border-border/30 hover:bg-surface/50 transition-all group"
              >
                <DirIcon className={`w-3.5 h-3.5 ${colorClass} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground/90">{q.symbol.replace("^", "")}</span>
                    <span className="text-[9px] text-muted-foreground/50 truncate">{q.name}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xs font-medium text-foreground/80">
                    {q.symbol === "^VIX" ? "" : "$"}{q.price.toFixed(2)}
                  </div>
                  <div className={`font-mono text-[10px] font-medium ${colorClass}`}>
                    {isPositive ? "+" : ""}{q.changePercent.toFixed(2)}%
                  </div>
                </div>
                <button
                  onClick={(e) => removeFromWatchlist(q.symbol, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-rose/10"
                >
                  <X className="w-3 h-3 text-muted-foreground hover:text-rose" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Show symbols not found in quotes */}
        {watchlist
          .filter(s => !quotes?.find(q => q.symbol === s))
          .map(s => (
            <div key={s} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface/20 border border-border/10 opacity-50">
              <Minus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs text-muted-foreground">{s.replace("^", "")}</span>
              <span className="text-[9px] text-muted-foreground/40 ml-auto">No data</span>
              <button
                onClick={(e) => removeFromWatchlist(s, e)}
                className="p-0.5 rounded hover:bg-rose/10"
              >
                <X className="w-3 h-3 text-muted-foreground hover:text-rose" />
              </button>
            </div>
          ))}
      </div>
    </ScrollArea>
  );
}
