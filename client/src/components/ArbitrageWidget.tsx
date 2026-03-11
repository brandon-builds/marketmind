/**
 * ArbitrageWidget — Dashboard widget showing arbitrage opportunities
 * between MarketMind AI predictions and prediction market probabilities
 */

import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Zap, TrendingUp, TrendingDown, Minus, ArrowLeftRight,
  AlertTriangle, Target, Flame,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const strengthConfig = {
  extreme: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", label: "EXTREME", glow: "shadow-red-500/20" },
  high: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", label: "HIGH", glow: "shadow-amber-500/20" },
  medium: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", label: "MEDIUM", glow: "" },
  low: { color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/30", label: "LOW", glow: "" },
};

const directionIcon = {
  bullish: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
  bearish: <TrendingDown className="w-3.5 h-3.5 text-rose-400" />,
  neutral: <Minus className="w-3.5 h-3.5 text-amber-400" />,
};

export function ArbitrageWidget() {
  const { data: signals, isLoading } = trpc.intelligence.getTopArbitrageSignals.useQuery(
    { limit: 5 },
    { refetchInterval: 60000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-5 w-40" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const signalList = signals || [];

  if (signalList.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
            <ArrowLeftRight className="w-4 h-4 text-violet-400" />
          </div>
          <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Arbitrage Signals
          </h3>
        </div>
        <div className="section-card p-6 text-center">
          <Target className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground/50">No divergences detected</p>
          <p className="text-[10px] text-muted-foreground/30 mt-1">AI and prediction markets are aligned</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
            <ArrowLeftRight className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Arbitrage Signals
            </h3>
            <p className="text-[10px] text-muted-foreground">AI vs prediction market divergences</p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
          {signalList.length} active
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        {signalList.map((signal: any, idx: number) => {
          const strength = strengthConfig[signal.strength as keyof typeof strengthConfig] || strengthConfig.low;
          return (
            <motion.div
              key={signal.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className={`section-card p-3 hover:border-violet-500/30 transition-all ${strength.glow ? `shadow-lg ${strength.glow}` : ""}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Link href={`/predictions?ticker=${signal.ticker}`}>
                    <span className="text-sm font-bold text-foreground hover:text-violet-400 transition-colors cursor-pointer" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {signal.ticker}
                    </span>
                  </Link>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${strength.bg} ${strength.color}`}>
                    {strength.label}
                  </span>
                  {signal.strength === "extreme" && (
                    <Flame className="w-3 h-3 text-red-400 animate-pulse" />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {signal.divergence}% div
                </span>
              </div>

              {/* AI vs Market comparison */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="p-2 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-1 mb-1">
                    <Zap className="w-3 h-3 text-cyan-400" />
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">AI Says</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {directionIcon[signal.aiDirection as keyof typeof directionIcon]}
                    <span className={`text-xs font-bold ${signal.aiDirection === "bullish" ? "text-emerald-400" : signal.aiDirection === "bearish" ? "text-rose-400" : "text-amber-400"}`}>
                      {signal.aiDirection.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto font-mono">{signal.aiConfidence}%</span>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-1 mb-1">
                    <Target className="w-3 h-3 text-violet-400" />
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{signal.platform}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {directionIcon[signal.marketDirection as keyof typeof directionIcon]}
                    <span className={`text-xs font-bold ${signal.marketDirection === "bullish" ? "text-emerald-400" : signal.marketDirection === "bearish" ? "text-rose-400" : "text-amber-400"}`}>
                      {signal.marketDirection.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto font-mono">{signal.marketProbability}%</span>
                  </div>
                </div>
              </div>

              {/* Suggested action */}
              <div className="p-2 rounded-lg bg-violet-500/5 border border-violet-500/10">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-violet-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                    {signal.suggestedAction}
                  </p>
                </div>
              </div>

              {/* Market title */}
              <p className="text-[9px] text-muted-foreground/50 mt-1.5 truncate">
                {signal.marketTitle}
              </p>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
