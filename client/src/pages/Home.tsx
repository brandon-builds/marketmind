import { usePageTracking } from "@/hooks/usePageTracking";
import { trpc } from "@/lib/trpc";
import { TickerBar } from "@/components/TickerBar";
import { AppHeader } from "@/components/AppHeader";
import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  Target, TrendingUp, TrendingDown, Minus, Activity,
  BarChart3, ArrowRight, CheckCircle2, XCircle, Clock,
  Zap, Brain, ChevronRight, Flame, Shield,
} from "lucide-react";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

// Countdown helper — time remaining until prediction window closes
const HORIZON_MS: Record<string, number> = {
  "1D": 1 * 24 * 3600000,
  "7D": 7 * 24 * 3600000,
  "30D": 30 * 24 * 3600000,
  "60D": 60 * 24 * 3600000,
};
function getCountdown(timestamp: number, horizon: string): { label: string; urgent: boolean } {
  const windowMs = HORIZON_MS[horizon] || 7 * 24 * 3600000;
  const remaining = timestamp + windowMs - Date.now();
  if (remaining <= 0) return { label: "Evaluating...", urgent: true };
  const hours = Math.floor(remaining / 3600000);
  const days = Math.floor(hours / 24);
  const rh = hours % 24;
  if (days > 1) return { label: `${days}d ${rh}h left`, urgent: false };
  if (days === 1) return { label: `1d ${rh}h left`, urgent: false };
  if (hours > 0) return { label: `${hours}h left`, urgent: hours < 6 };
  return { label: `${Math.max(1, Math.floor(remaining / 60000))}m left`, urgent: true };
}

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

export default function Home() {
  usePageTracking("home");
  const now = useCurrentTime();
  const { livePrices, connected } = useWebSocket();
  const { user } = useAuth();

  const quotesQuery = trpc.market.quotes.useQuery(undefined, {
    refetchInterval: 60000,
    retry: 2,
  });
  const predictionsQuery = trpc.market.predictionsAll.useQuery(
    { sortBy: "confidence", direction: "desc", horizon: "all", status: "all" },
    { refetchInterval: 120000, retry: 2 }
  );
  const alphaQuery = trpc.intelligence.getAlphaScores.useQuery(undefined, {
    refetchInterval: 300000,
  });

  const isMarketOpen = useMemo(() => {
    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = et.getDay();
    const hour = et.getHours();
    const min = et.getMinutes();
    const timeNum = hour * 60 + min;
    return day >= 1 && day <= 5 && timeNum >= 570 && timeNum <= 960;
  }, [now]);

  const stats = predictionsQuery.data?.stats;
  const predictions = predictionsQuery.data?.predictions || [];
  const activePredictions = predictions.filter((p: any) => !p.resolved);
  const topPredictions = activePredictions.slice(0, 6);
  const recentResolved = predictions
    .filter((p: any) => p.resolved)
    .sort((a: any, b: any) => (b.resolvedAt || 0) - (a.resolvedAt || 0))
    .slice(0, 5);
  const alphaScores = alphaQuery.data || [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TickerBar quotes={quotesQuery.data} isLoading={quotesQuery.isLoading} livePrices={livePrices} />
      <AppHeader showMarketStatus showTime now={now} isMarketOpen={isMarketOpen} />

      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-6">

        {/* ── Hero Stats Bar ── */}
        <motion.div {...fadeIn} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Active Predictions"
            value={stats?.totalActive ?? "—"}
            icon={<Zap className="w-4 h-4 text-blue-400" />}
            accent="blue"
          />
          <StatCard
            label="Win Rate"
            value={stats ? `${(stats.hitRate * 100).toFixed(1)}%` : "—"}
            icon={<Target className="w-4 h-4 text-emerald-400" />}
            accent="emerald"
          />
          <StatCard
            label="Resolved"
            value={stats?.totalResolved ?? "—"}
            icon={<CheckCircle2 className="w-4 h-4 text-violet-400" />}
            accent="violet"
          />
          <StatCard
            label="Avg Confidence"
            value={stats ? `${(stats.avgConfidence * 100).toFixed(0)}%` : "—"}
            icon={<Activity className="w-4 h-4 text-amber-400" />}
            accent="amber"
          />
        </motion.div>

        {/* ── Main Content: Top Predictions + Sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Top Predictions (2/3 width) */}
          <motion.div {...fadeIn} transition={{ ...fadeIn.transition, delay: 0.1 }} className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <h2 className="font-display text-lg font-bold tracking-tight">Top Predictions</h2>
                <span className="text-xs text-muted-foreground/60">Highest confidence, most recent</span>
              </div>
              <Link href="/predictions" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {predictionsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-24 rounded-xl bg-muted/20 animate-pulse" />
                ))}
              </div>
            ) : topPredictions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground/50">
                <Target className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No active predictions yet. The Research Agent generates new predictions every 30 minutes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topPredictions.map((pred: any, idx: number) => (
                  <PredictionCard key={pred.id} prediction={pred} rank={idx + 1} />
                ))}
              </div>
            )}

            {/* Recent Outcomes */}
            {recentResolved.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-display text-sm font-semibold tracking-tight">Recent Outcomes</h3>
                </div>
                <div className="space-y-2">
                  {recentResolved.map((pred: any) => (
                    <ResolvedCard key={pred.id} prediction={pred} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Right Sidebar: Alpha Scores + Quick Links (1/3 width) */}
          <motion.div {...fadeIn} transition={{ ...fadeIn.transition, delay: 0.2 }} className="space-y-4">

            {/* Alpha Score Rankings — Compact */}
            <div className="rounded-xl border border-border/20 bg-card/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/15 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-primary/70" />
                  <h3 className="font-display text-[13px] font-semibold">Alpha Rankings</h3>
                </div>
                <Link href="/alpha-leaderboard" className="text-[10px] text-primary hover:text-primary/80 transition-colors">
                  Full board <ChevronRight className="w-3 h-3 inline" />
                </Link>
              </div>
              <div className="divide-y divide-border/10">
                {alphaQuery.isLoading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-8 rounded bg-muted/20 animate-pulse" />
                    ))}
                  </div>
                ) : alphaScores.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground/50">No alpha scores yet</div>
                ) : (
                  alphaScores.slice(0, 8).map((score: any, idx: number) => (
                    <Link key={score.ticker} href={`/ticker/${score.ticker}`}>
                      <div className="px-4 py-2.5 flex items-center justify-between hover:bg-muted/10 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-muted-foreground/40 w-4">{idx + 1}</span>
                          <span className="font-mono text-sm font-semibold">{score.ticker}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`text-xs font-bold ${
                            score.alphaScore >= 70 ? "text-emerald-400" :
                            score.alphaScore >= 40 ? "text-amber-400" : "text-rose-400"
                          }`}>
                            {score.alphaScore}
                          </div>
                          <div className="w-16 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                score.alphaScore >= 70 ? "bg-emerald-400" :
                                score.alphaScore >= 40 ? "bg-amber-400" : "bg-rose-400"
                              }`}
                              style={{ width: `${score.alphaScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Win Rate by Horizon */}
            {stats && (
              <div className="rounded-xl border border-border/20 bg-card/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/15">
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-emerald-400/70" />
                    <h3 className="font-display text-[13px] font-semibold">Win Rate by Horizon</h3>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {(["1D", "7D", "30D"] as const).map(h => {
                    const hData = stats.byHorizon[h];
                    const rate = hData.total > 0 ? (hData.hits / hData.total) * 100 : 0;
                    return (
                      <div key={h} className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">{h}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${rate >= 60 ? "bg-emerald-400" : rate >= 45 ? "bg-amber-400" : "bg-rose-400"}`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold w-12 text-right">
                            {hData.total > 0 ? `${rate.toFixed(0)}%` : "—"}
                          </span>
                          <span className="text-[10px] text-muted-foreground/40">
                            ({hData.hits}/{hData.total})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Navigation */}
            <div className="rounded-xl border border-border/20 bg-card/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/15">
                <h3 className="font-display text-[13px] font-semibold">Quick Access</h3>
              </div>
              <div className="p-2 grid grid-cols-2 gap-1.5">
                {[
                  { href: "/trade-journal", label: "Trade Journal", icon: "📓" },
                  { href: "/strategy-marketplace", label: "Strategies", icon: "🏪" },
                  { href: "/data-sources", label: "Data Sources", icon: "📡" },
                  { href: "/alpha-backtest", label: "Backtest", icon: "🧪" },
                  { href: "/watchlist", label: "Watchlist", icon: "⭐" },
                  { href: "/portfolio", label: "Portfolio", icon: "💼" },
                ].map(item => (
                  <Link key={item.href} href={item.href}>
                    <div className="px-3 py-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors cursor-pointer flex items-center gap-2">
                      <span>{item.icon}</span>
                      {item.label}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/15 mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 flex items-center justify-between text-xs text-muted-foreground/40">
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5" />
            <span>MarketMind — Autonomous Market Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
            <span className="font-mono text-[10px]">{connected ? "Live" : "Connecting"}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Stat Card ──
function StatCard({
  label, value, icon, accent = "blue",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border/20 bg-card/50 px-4 py-3.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium">{label}</span>
        {icon}
      </div>
      <div className="font-display text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

// ── Prediction Card ──
function PredictionCard({ prediction: pred, rank }: { prediction: any; rank: number }) {
  const dirIcon = pred.direction === "up" ? <TrendingUp className="w-4 h-4" /> :
    pred.direction === "down" ? <TrendingDown className="w-4 h-4" /> :
    <Minus className="w-4 h-4" />;
  const dirColor = pred.direction === "up" ? "text-emerald-400" :
    pred.direction === "down" ? "text-rose-400" : "text-amber-400";
  const dirBg = pred.direction === "up" ? "bg-emerald-400/10 border-emerald-400/20" :
    pred.direction === "down" ? "bg-rose-400/10 border-rose-400/20" : "bg-amber-400/10 border-amber-400/20";
  const confPct = (pred.confidence * 100).toFixed(0);
  const timeAgo = getTimeAgo(pred.timestamp);

  return (
    <Link href={`/predictions?ticker=${pred.ticker}`}>
      <div className={`rounded-xl border border-border/20 bg-card/50 hover:bg-card/80 transition-all cursor-pointer p-4`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${dirBg} ${dirColor} shrink-0`}>
              {dirIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm font-bold">{pred.ticker}</span>
                <span className={`text-[10px] font-semibold uppercase ${dirColor}`}>
                  {pred.direction === "up" ? "Bullish" : pred.direction === "down" ? "Bearish" : "Neutral"}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/40 px-1.5 py-0.5 rounded bg-muted/20">{pred.horizon}</span>
              </div>
              <p className="text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed">{pred.reasoning}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold font-mono">{confPct}%</div>
            {(() => {
              const cd = getCountdown(pred.timestamp, pred.horizon);
              return (
                <div className={`text-[10px] font-mono font-medium ${
                  cd.urgent ? "text-amber-400" : "text-blue-400/70"
                }`}>
                  {cd.label}
                </div>
              );
            })()}
            {pred.priceTarget && (
              <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                Target: ${pred.priceTarget.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Resolved Card ──
function ResolvedCard({ prediction: pred }: { prediction: any }) {
  const isHit = pred.outcome === "hit";
  return (
    <div className={`rounded-lg border px-3 py-2.5 flex items-center justify-between ${
      isHit ? "border-emerald-400/15 bg-emerald-400/5" : "border-rose-400/15 bg-rose-400/5"
    }`}>
      <div className="flex items-center gap-2.5">
        {isHit ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-rose-400" />
        )}
        <span className="font-mono text-xs font-semibold">{pred.ticker}</span>
        <span className={`text-[10px] ${pred.direction === "up" ? "text-emerald-400" : pred.direction === "down" ? "text-rose-400" : "text-amber-400"}`}>
          {pred.direction === "up" ? "▲" : pred.direction === "down" ? "▼" : "—"}
        </span>
        <span className="text-[10px] text-muted-foreground/40">{pred.horizon}</span>
      </div>
      <div className="flex items-center gap-3">
        {pred.actualMove != null && (
          <span className={`text-xs font-mono font-semibold ${pred.actualMove >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {pred.actualMove >= 0 ? "+" : ""}{pred.actualMove.toFixed(2)}%
          </span>
        )}
        <span className={`text-[10px] font-bold uppercase ${isHit ? "text-emerald-400" : "text-rose-400"}`}>
          {isHit ? "HIT" : "MISS"}
        </span>
        {pred.resolvedAt && (
          <span className="text-[10px] text-muted-foreground/40">
            {new Date(pred.resolvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Time Ago Helper ──
function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
