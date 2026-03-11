import { usePageTracking } from "@/hooks/usePageTracking";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { History, TrendingUp, TrendingDown, Target, Calendar, BarChart3, ArrowUpRight, ArrowDownRight, Minus, Filter, Download } from "lucide-react";
import { exportReport, buildBacktestReport } from "@/lib/exportReport";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ShareButton } from "@/components/ShareButton";
import { FirstVisitTooltip } from "@/components/FirstVisitTooltip";
import { useState, useMemo } from "react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

function MiniChart({ data, positive }: { data: { date: string; pnl: number }[]; positive: boolean }) {
  if (!data.length) return null;
  const min = Math.min(...data.map(d => d.pnl));
  const max = Math.max(...data.map(d => d.pnl));
  const range = max - min || 1;
  const w = 100;
  const h = 40;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.pnl - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id={positive ? "pnlGradPos" : "pnlGradNeg"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? "#10b981" : "#ef4444"} stopOpacity="0.3" />
          <stop offset="100%" stopColor={positive ? "#10b981" : "#ef4444"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#${positive ? "pnlGradPos" : "pnlGradNeg"})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Backtest() {
  usePageTracking("backtest");
  const [horizon, setHorizon] = useState<"all" | "1D" | "7D" | "30D">("all");
  const [, navigate] = useLocation();

  const [dateRange] = useState(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 90 * 86400000);
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  });

  const { data, isLoading } = trpc.market.backtest.useQuery(
    { ...dateRange, horizon },
    { refetchInterval: 600000, retry: 2 }
  );

  const pnlChartData = useMemo(() => {
    if (!data) return [];
    return data.cumulativePnL;
  }, [data]);

  const isPositive = data ? data.summary.totalPnl >= 0 : true;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader title="Backtesting" subtitle="Historical Performance" showBack />

      <main className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        <FirstVisitTooltip
          storageKey="backtest"
          title="Backtesting Engine"
          description="See how MarketMind's predictions would have performed historically. This page shows cumulative P&L, win rates by horizon, and per-ticker breakdowns with full transparency."
          tips={[
            "Use the horizon filter (1D, 7D, 30D) to see accuracy at different timeframes",
            "Check the per-ticker breakdown to see which symbols the model predicts best",
            "Export results as CSV or PDF for your own analysis",
          ]}
          accentColor="cyan"
          icon={<History className="w-4.5 h-4.5 text-cyan-400" />}
        />

        {/* Horizon Filter */}
        <motion.div {...fadeInUp} className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Horizon</span>
          <div className="flex gap-1">
            {(["all", "1D", "7D", "30D"] as const).map(h => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  horizon === h
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border border-transparent"
                }`}
              >
                {h === "all" ? "All" : h}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>{data?.summary.startDate || "..."} — {data?.summary.endDate || "..."}</span>
            {data && (
              <>
                <button
                  onClick={() => exportReport(buildBacktestReport(data))}
                  className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all text-xs font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export PDF
                </button>
                <button
                  onClick={() => {
                    exportToCsv("marketmind_backtest", [
                      { header: "Date", accessor: (r: any) => r.date },
                      { header: "Ticker", accessor: (r: any) => r.ticker },
                      { header: "Direction", accessor: (r: any) => r.direction === "up" ? "Long" : "Short" },
                      { header: "Horizon", accessor: (r: any) => r.horizon },
                      { header: "Confidence", accessor: (r: any) => `${(r.confidence * 100).toFixed(0)}%` },
                      { header: "Entry Price", accessor: (r: any) => `$${r.priceAtPrediction.toFixed(2)}` },
                      { header: "Exit Price", accessor: (r: any) => `$${r.priceAtResolution.toFixed(2)}` },
                      { header: "Result", accessor: (r: any) => r.outcome.toUpperCase() },
                      { header: "P&L %", accessor: (r: any) => `${r.pnlPercent >= 0 ? "+" : ""}${r.pnlPercent.toFixed(2)}%` },
                    ], data.predictions);
                    toast.success("Backtest data exported to CSV");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/10 border border-transparent hover:border-border/15 transition-all text-xs font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
                <div className="ml-2">
                  <ShareButton
                    reportType="backtest"
                    title={`Backtest Report — ${dateRange.startDate} to ${dateRange.endDate}`}
                    getData={() => JSON.stringify(data)}
                  />
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Summary Cards */}
        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total P&L", value: data ? `${data.summary.totalPnl >= 0 ? "+" : ""}${data.summary.totalPnl.toFixed(1)}%` : "...", color: data && data.summary.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400" },
            { label: "Win Rate", value: data ? `${data.summary.winRate}%` : "...", color: data && data.summary.winRate > 55 ? "text-emerald-400" : "text-amber-400" },
            { label: "Total Trades", value: data ? `${data.summary.totalPredictions}` : "...", color: "text-foreground" },
            { label: "Hits", value: data ? `${data.summary.hits}` : "...", color: "text-emerald-400" },
            { label: "Misses", value: data ? `${data.summary.misses}` : "...", color: "text-rose-400" },
            { label: "Avg P&L/Trade", value: data ? `${data.summary.avgPnlPerTrade >= 0 ? "+" : ""}${data.summary.avgPnlPerTrade.toFixed(2)}%` : "...", color: data && data.summary.avgPnlPerTrade >= 0 ? "text-emerald-400" : "text-rose-400" },
          ].map((card, i) => (
            <motion.div key={i} variants={fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{card.label}</p>
              <p className={`text-xl font-mono font-bold ${card.color}`}>
                {isLoading ? <span className="inline-block w-16 h-6 bg-muted/20 rounded animate-pulse" /> : card.value}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Win Rate by Horizon */}
        <motion.div {...fadeInUp} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data && (["1D", "7D", "30D"] as const).map(h => {
            const rate = data.winRateByHorizon[h];
            return (
              <div key={h} className="rounded-xl border border-border/40 bg-card/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">{h}</span>
                  <span className={`text-lg font-mono font-bold ${rate > 55 ? "text-emerald-400" : rate > 50 ? "text-amber-400" : "text-rose-400"}`}>{rate}%</span>
                </div>
                <div className="w-full bg-muted/20 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${rate > 55 ? "bg-emerald-500" : rate > 50 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${Math.min(rate, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Win rate for {h} horizon predictions</p>
              </div>
            );
          })}
        </motion.div>

        {/* Cumulative P&L Chart */}
        <motion.div {...fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-sm">Cumulative P&L</h2>
            </div>
            {data && (
              <span className={`text-sm font-mono font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {isPositive ? "+" : ""}{data.summary.totalPnl.toFixed(1)}%
              </span>
            )}
          </div>
          {isLoading ? (
            <div className="h-48 bg-muted/10 rounded animate-pulse" />
          ) : pnlChartData.length > 0 ? (
            <div className="relative">
              <div className="h-48">
                <PnLChart data={pnlChartData} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                <span>{pnlChartData[0]?.date}</span>
                <span>{pnlChartData[Math.floor(pnlChartData.length / 2)]?.date}</span>
                <span>{pnlChartData[pnlChartData.length - 1]?.date}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">No data available</p>
          )}
        </motion.div>

        {/* Best & Worst Predictions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Best Predictions */}
          <motion.div {...fadeInUp} className="rounded-xl border border-emerald-500/20 bg-card/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="font-display font-semibold text-sm">Best Predictions</h2>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted/10 rounded animate-pulse" />)}
              </div>
            ) : data?.bestPredictions.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                  <button onClick={() => navigate(`/ticker/${p.ticker}`)} className="font-mono text-xs font-bold text-foreground hover:text-primary transition-colors">{p.ticker}</button>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.direction === "up" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {p.direction === "up" ? "↑ Long" : "↓ Short"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{p.horizon}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{p.date}</span>
                  <span className="font-mono text-xs font-bold text-emerald-400">+{p.pnlPercent.toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Worst Predictions */}
          <motion.div {...fadeInUp} className="rounded-xl border border-rose-500/20 bg-card/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-rose-400" />
              <h2 className="font-display font-semibold text-sm">Worst Predictions</h2>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted/10 rounded animate-pulse" />)}
              </div>
            ) : data?.worstPredictions.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                  <button onClick={() => navigate(`/ticker/${p.ticker}`)} className="font-mono text-xs font-bold text-foreground hover:text-primary transition-colors">{p.ticker}</button>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.direction === "up" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {p.direction === "up" ? "↑ Long" : "↓ Short"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{p.horizon}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{p.date}</span>
                  <span className="font-mono text-xs font-bold text-rose-400">{p.pnlPercent.toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Performance by Ticker */}
        <motion.div {...fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-sm">Performance by Ticker</h2>
          </div>
          {isLoading ? (
            <div className="h-32 bg-muted/10 rounded animate-pulse" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {data?.byTicker.map(t => (
                <button
                  key={t.ticker}
                  onClick={() => navigate(`/ticker/${t.ticker}`)}
                  className="rounded-lg border border-border/30 bg-background/50 p-3 hover:border-primary/30 transition-all text-left"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold">{t.ticker}</span>
                    <span className={`font-mono text-xs font-bold ${t.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {t.totalPnl >= 0 ? "+" : ""}{t.totalPnl.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{t.totalPredictions} trades</span>
                    <span className={`text-[10px] ${t.winRate > 55 ? "text-emerald-400" : t.winRate > 50 ? "text-amber-400" : "text-rose-400"}`}>
                      {t.winRate}% win
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Predictions Table */}
        <motion.div {...fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-sm">Recent Predictions</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">Last 50</span>
          </div>
          {isLoading ? (
            <div className="h-48 bg-muted/10 rounded animate-pulse" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Date</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Ticker</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Direction</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Horizon</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Confidence</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Entry</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Exit</th>
                    <th className="text-center py-2 px-2 text-muted-foreground font-medium">Result</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.predictions.slice().reverse().map(p => (
                    <tr key={p.id} className="border-b border-border/10 hover:bg-muted/5 transition-colors">
                      <td className="py-2 px-2 text-muted-foreground">{p.date}</td>
                      <td className="py-2 px-2">
                        <button onClick={() => navigate(`/ticker/${p.ticker}`)} className="font-mono font-bold hover:text-primary transition-colors">{p.ticker}</button>
                      </td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex items-center gap-1 ${p.direction === "up" ? "text-emerald-400" : "text-rose-400"}`}>
                          {p.direction === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {p.direction === "up" ? "Long" : "Short"}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono">{p.horizon}</td>
                      <td className="py-2 px-2 text-right font-mono">{(p.confidence * 100).toFixed(0)}%</td>
                      <td className="py-2 px-2 text-right font-mono">${p.priceAtPrediction.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-mono">${p.priceAtResolution.toFixed(2)}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.outcome === "hit" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                        }`}>
                          {p.outcome.toUpperCase()}
                        </span>
                      </td>
                      <td className={`py-2 px-2 text-right font-mono font-bold ${p.pnlPercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function PnLChart({ data }: { data: { date: string; pnl: number }[] }) {
  if (!data.length) return null;
  const min = Math.min(...data.map(d => d.pnl), 0);
  const max = Math.max(...data.map(d => d.pnl), 0);
  const range = max - min || 1;
  const w = 800;
  const h = 180;
  const zeroY = h - ((0 - min) / range) * h;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.pnl - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  const lastPnl = data[data.length - 1]?.pnl || 0;
  const isPositive = lastPnl >= 0;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.2" />
          <stop offset="100%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Zero line */}
      <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4,4" />
      {/* Fill area */}
      <polygon
        points={`0,${zeroY} ${points} ${w},${zeroY}`}
        fill="url(#pnlFill)"
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={isPositive ? "#10b981" : "#ef4444"}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Y-axis labels */}
      <text x="4" y="12" fill="currentColor" fillOpacity="0.4" fontSize="10" fontFamily="monospace">{max.toFixed(1)}%</text>
      <text x="4" y={zeroY - 4} fill="currentColor" fillOpacity="0.4" fontSize="10" fontFamily="monospace">0%</text>
      <text x="4" y={h - 4} fill="currentColor" fillOpacity="0.4" fontSize="10" fontFamily="monospace">{min.toFixed(1)}%</text>
    </svg>
  );
}
