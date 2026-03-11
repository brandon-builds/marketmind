/**
 * MobileDashboard — Bloomberg terminal in your pocket
 * 
 * Condensed mobile view showing:
 * - Top 5 Alpha Score opportunities
 * - Active arbitrage signals
 * - Critical rebalancing alerts
 * - Smart Money flow summary
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Zap, TrendingUp, TrendingDown, AlertTriangle, Shield, ArrowRight,
  RefreshCw, ChevronRight, Activity, Target, BarChart3,
} from "lucide-react";

export function MobileDashboard() {
  const { data: alphaScores } = trpc.intelligence.getAlphaScores.useQuery(undefined, { refetchInterval: 60000 });
  const { data: arbitrage } = trpc.intelligence.getTopArbitrageSignals.useQuery(undefined, { refetchInterval: 60000 });
  const { data: rebalance } = trpc.intelligence.getRebalanceSuggestions.useQuery(undefined, { refetchInterval: 60000 });
  const { data: smartMoney } = trpc.intelligence.getSmartMoneyFlows.useQuery(undefined, { refetchInterval: 60000 });

  const topAlpha = alphaScores?.slice(0, 5) || [];
  const topArbitrage = arbitrage?.slice(0, 3) || [];
  const criticalRebalance = rebalance?.filter((s: any) => s.priority === "critical" || s.priority === "high").slice(0, 3) || [];
  const topSmartMoney = smartMoney?.slice(0, 5) || [];

  return (
    <div className="space-y-4 md:hidden">
      {/* Top Alpha Opportunities */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Top Alpha Opportunities
          </h2>
          <Link href="/alpha-leaderboard">
            <span className="text-xs text-cyan-400 flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
        <div className="divide-y divide-border">
          {topAlpha.length > 0 ? topAlpha.map((score: any, idx: number) => (
            <Link key={score.ticker} href={`/ticker/${score.ticker}`}>
              <div className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">#{idx + 1}</span>
                  <div>
                    <div className="font-semibold text-sm">{score.ticker}</div>
                    <div className="text-xs text-muted-foreground">{score.sector || "Tech"}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    score.score >= 75 ? "text-emerald-400" :
                    score.score >= 50 ? "text-cyan-400" :
                    score.score >= 25 ? "text-amber-400" :
                    "text-red-400"
                  }`}>
                    {score.score}
                  </div>
                  <div className="text-xs text-muted-foreground">Alpha</div>
                </div>
              </div>
            </Link>
          )) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Alpha engine initializing...
            </div>
          )}
        </div>
      </section>

      {/* Arbitrage Signals */}
      {topArbitrage.length > 0 && (
        <section className="bg-card border border-violet-500/30 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Target className="w-4 h-4 text-violet-400" />
              Arbitrage Signals
            </h2>
            <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full font-medium">
              {topArbitrage.length} active
            </span>
          </div>
          <div className="divide-y divide-border">
            {topArbitrage.map((signal: any) => (
              <Link key={signal.ticker} href={`/predictions?ticker=${signal.ticker}`}>
                <div className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{signal.ticker}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      signal.strength === "extreme" ? "bg-red-500/20 text-red-400" :
                      signal.strength === "high" ? "bg-amber-500/20 text-amber-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      {signal.strength}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Market: {signal.marketProbability}% vs AI: {signal.aiConfidence}%
                  </div>
                  <div className="text-xs text-violet-400 mt-1">{signal.suggestedAction}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Critical Rebalancing */}
      {criticalRebalance.length > 0 && (
        <section className="bg-card border border-amber-500/30 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Rebalancing Alerts
            </h2>
            <Link href="/portfolio">
              <span className="text-xs text-cyan-400 flex items-center gap-1">
                Portfolio <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {criticalRebalance.map((suggestion: any) => (
              <div key={suggestion.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{suggestion.ticker}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    suggestion.action === "reduce" ? "bg-red-500/20 text-red-400" :
                    suggestion.action === "increase" ? "bg-emerald-500/20 text-emerald-400" :
                    "bg-blue-500/20 text-blue-400"
                  }`}>
                    {suggestion.action}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Smart Money Flow */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Smart Money Flow
          </h2>
          <Link href="/predictions">
            <span className="text-xs text-cyan-400 flex items-center gap-1">
              Predictions <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
        <div className="divide-y divide-border">
          {topSmartMoney.length > 0 ? topSmartMoney.map((flow: any) => (
            <div key={flow.ticker} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  flow.signal === "strong_buy" || flow.signal === "buy" ? "bg-emerald-500/20" :
                  flow.signal === "strong_sell" || flow.signal === "sell" ? "bg-red-500/20" :
                  "bg-zinc-500/20"
                }`}>
                  {flow.signal === "strong_buy" || flow.signal === "buy" ? (
                    <TrendingUp className={`w-4 h-4 ${flow.signal === "strong_buy" ? "text-emerald-400" : "text-emerald-500/70"}`} />
                  ) : flow.signal === "strong_sell" || flow.signal === "sell" ? (
                    <TrendingDown className={`w-4 h-4 ${flow.signal === "strong_sell" ? "text-red-400" : "text-red-500/70"}`} />
                  ) : (
                    <BarChart3 className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
                <span className="font-semibold text-sm">{flow.ticker}</span>
              </div>
              <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                flow.signal === "strong_buy" ? "bg-emerald-500/20 text-emerald-400" :
                flow.signal === "buy" ? "bg-emerald-500/10 text-emerald-500" :
                flow.signal === "strong_sell" ? "bg-red-500/20 text-red-400" :
                flow.signal === "sell" ? "bg-red-500/10 text-red-500" :
                "bg-zinc-500/20 text-zinc-400"
              }`}>
                {flow.signal?.replace("_", " ") || "neutral"}
              </span>
            </div>
          )) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Smart money engine initializing...
            </div>
          )}
        </div>
      </section>

      {/* Quick Links */}
      <div className="grid grid-cols-3 gap-2">
        <Link href="/strategy-builder">
          <div className="bg-card border border-border rounded-xl p-3 text-center hover:bg-muted/30 transition-colors">
            <Shield className="w-5 h-5 mx-auto mb-1 text-violet-400" />
            <span className="text-xs font-medium">Strategies</span>
          </div>
        </Link>
        <Link href="/correlation">
          <div className="bg-card border border-border rounded-xl p-3 text-center hover:bg-muted/30 transition-colors">
            <BarChart3 className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
            <span className="text-xs font-medium">Correlation</span>
          </div>
        </Link>
        <Link href="/trade-journal">
          <div className="bg-card border border-border rounded-xl p-3 text-center hover:bg-muted/30 transition-colors">
            <Activity className="w-5 h-5 mx-auto mb-1 text-amber-400" />
            <span className="text-xs font-medium">Journal</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
