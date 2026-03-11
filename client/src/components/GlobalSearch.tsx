import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, TrendingUp, ArrowRight, X } from "lucide-react";
import { TICKER_UNIVERSE, type TickerInfo } from "@shared/tickers";
import { motion, AnimatePresence } from "framer-motion";

const typeColors: Record<string, string> = {
  equity: "text-blue-400",
  etf: "text-emerald-400",
  index: "text-amber-400",
  commodity: "text-orange-400",
};

const typeBadgeColors: Record<string, string> = {
  equity: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  etf: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  index: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  commodity: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const results = query.length > 0
    ? TICKER_UNIVERSE.filter(t => {
        const q = query.toLowerCase();
        return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  const handleSelect = useCallback((ticker: TickerInfo) => {
    setQuery("");
    setIsOpen(false);
    navigate(`/ticker/${ticker.symbol}`);
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }, [results, selectedIndex, handleSelect]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+K to focus search
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 ${
        isOpen
          ? "bg-card/80 border-primary/30 ring-1 ring-primary/10 w-64 md:w-80"
          : "bg-card/40 border-border/30 hover:border-border/50 w-48 md:w-64"
      }`}>
        <Search className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search tickers..."
          className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none w-full font-mono"
        />
        {query ? (
          <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="text-muted-foreground/40 hover:text-foreground/60 transition-colors">
            <X className="w-3 h-3" />
          </button>
        ) : (
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted/30 border border-border/20 text-[9px] text-muted-foreground/40 font-mono">
            <span className="text-[10px]">⌘</span>K
          </kbd>
        )}
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 left-0 right-0 min-w-[320px] bg-card/95 backdrop-blur-xl border border-border/30 rounded-lg shadow-2xl shadow-black/40 overflow-hidden z-50"
          >
            <div className="px-3 py-2 border-b border-border/15">
              <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {results.map((ticker, i) => (
                <button
                  key={ticker.symbol}
                  onClick={() => handleSelect(ticker)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    i === selectedIndex
                      ? "bg-primary/8 border-l-2 border-primary/40"
                      : "border-l-2 border-transparent hover:bg-muted/20"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                    i === selectedIndex ? "bg-primary/15" : "bg-muted/20"
                  }`}>
                    <TrendingUp className={`w-3.5 h-3.5 ${typeColors[ticker.type] || "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">{ticker.symbol}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${typeBadgeColors[ticker.type] || ""}`}>
                        {ticker.type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 truncate">{ticker.name}</p>
                  </div>
                  {ticker.sector && (
                    <span className="text-[9px] text-muted-foreground/30 hidden sm:inline">{ticker.sector}</span>
                  )}
                  {i === selectedIndex && (
                    <ArrowRight className="w-3 h-3 text-primary/50 shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="px-3 py-1.5 border-t border-border/15 flex items-center gap-3 text-[9px] text-muted-foreground/30">
              <span><kbd className="px-1 py-0.5 rounded bg-muted/20 border border-border/15 font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 rounded bg-muted/20 border border-border/15 font-mono">↵</kbd> select</span>
              <span><kbd className="px-1 py-0.5 rounded bg-muted/20 border border-border/15 font-mono">esc</kbd> close</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
