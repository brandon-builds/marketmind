import { trpc } from "@/lib/trpc";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import {
  Brain,
  Eye,
  Calendar,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Briefcase,
  Shield,
  AlertTriangle,
  BarChart3,
} from "lucide-react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export default function SharedReport() {
  const [, params] = useRoute("/shared/:shareId");
  const shareId = params?.shareId || "";

  const { data: report, isLoading, error } = trpc.watchlist.shareGet.useQuery(
    { shareId },
    { enabled: !!shareId, retry: 1 }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">Loading shared report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-2xl bg-rose/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-rose" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Report Not Found</h1>
          <p className="text-muted-foreground text-sm">
            This shared report may have expired or been deleted. Reports expire after 30 days.
          </p>
          <Link href="/" className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline mt-4">
            <ArrowLeft className="w-4 h-4" />
            Go to MarketMind
          </Link>
        </div>
      </div>
    );
  }

  let parsedData: any = {};
  try {
    parsedData = JSON.parse(report.data);
  } catch {
    parsedData = {};
  }

  const isBacktest = report.reportType === "backtest";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/30 bg-surface/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm">MarketMind</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{report.views} views</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Shared {new Date(report.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Report Title */}
      <motion.div {...fadeInUp} className="max-w-[1400px] mx-auto px-4 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isBacktest ? "bg-chart-2/10" : "bg-primary/10"}`}>
            {isBacktest ? <BarChart3 className="w-5 h-5 text-chart-2" /> : <Briefcase className="w-5 h-5 text-primary" />}
          </div>
          <div>
            <h1 className="text-xl font-bold">{report.title}</h1>
            <p className="text-xs text-muted-foreground">
              {isBacktest ? "Backtesting Report" : "Portfolio Snapshot"} · Read-only view
            </p>
          </div>
        </div>
      </motion.div>

      {/* Report Content */}
      <main className="max-w-[1400px] mx-auto px-4 pb-12 space-y-6">
        {isBacktest ? (
          <BacktestView data={parsedData} />
        ) : (
          <PortfolioView data={parsedData} />
        )}
      </main>

      {/* Footer CTA */}
      <div className="border-t border-border/30 bg-surface/50 py-8">
        <div className="max-w-md mx-auto text-center space-y-3 px-4">
          <h3 className="text-sm font-semibold">Want to run your own analysis?</h3>
          <p className="text-xs text-muted-foreground">
            MarketMind combines AI predictions, narrative intelligence, and real-time market data.
          </p>
          <Link href="/" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Try MarketMind
          </Link>
        </div>
      </div>
    </div>
  );
}

function BacktestView({ data }: { data: any }) {
  const summary = data?.summary;
  const predictions = data?.predictions || [];
  const byTicker = data?.byTicker || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total P&L" value={`$${summary.totalPnl?.toLocaleString() || "0"}`} positive={summary.totalPnl > 0} />
          <StatCard label="Win Rate" value={`${((summary.winRate || 0) * 100).toFixed(1)}%`} positive={(summary.winRate || 0) > 0.5} />
          <StatCard label="Predictions" value={summary.totalPredictions?.toString() || "0"} />
          <StatCard label="Avg Return" value={`${((summary.avgReturn || 0) * 100).toFixed(2)}%`} positive={(summary.avgReturn || 0) > 0} />
        </div>
      )}

      {/* By Ticker */}
      {byTicker.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-surface/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Performance by Ticker
            </h3>
          </div>
          <div className="divide-y divide-border/10">
            {byTicker.map((t: any) => (
              <div key={t.ticker} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm">{t.ticker}</span>
                  <span className="text-xs text-muted-foreground">{t.predictions} predictions</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">Win: {((t.winRate || 0) * 100).toFixed(0)}%</span>
                  <span className={`text-sm font-semibold ${t.pnl >= 0 ? "text-emerald" : "text-rose"}`}>
                    {t.pnl >= 0 ? "+" : ""}${t.pnl?.toLocaleString() || "0"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Predictions */}
      {predictions.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-surface/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-chart-2" />
              Predictions ({predictions.length})
            </h3>
          </div>
          <div className="divide-y divide-border/10 max-h-96 overflow-y-auto">
            {predictions.slice(0, 20).map((p: any, i: number) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{p.ticker}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    p.direction === "Bullish" ? "bg-emerald/10 text-emerald" :
                    p.direction === "Bearish" ? "bg-rose/10 text-rose" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {p.direction}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{p.horizon}</span>
                  <span className={`font-semibold ${p.actualReturn >= 0 ? "text-emerald" : "text-rose"}`}>
                    {p.actualReturn >= 0 ? "+" : ""}{((p.actualReturn || 0) * 100).toFixed(2)}%
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${p.correct ? "bg-emerald/10 text-emerald" : "bg-rose/10 text-rose"}`}>
                    {p.correct ? "Win" : "Loss"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioView({ data }: { data: any }) {
  const holdings = data?.holdings || [];
  const predictionExposure = data?.predictionExposure;
  const narrativeSentiment = data?.narrativeSentiment;
  const riskFlags = data?.riskFlags || [];

  return (
    <div className="space-y-6">
      {/* Summary */}
      {data?.totalValue && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Value" value={`$${data.totalValue.toLocaleString()}`} />
          <StatCard label="Day Change" value={`${data.totalChangePercent >= 0 ? "+" : ""}${data.totalChangePercent?.toFixed(2) || "0"}%`} positive={data.totalChangePercent >= 0} />
          <StatCard label="Holdings" value={holdings.length.toString()} />
          <StatCard label="Risk Flags" value={riskFlags.length.toString()} positive={riskFlags.length === 0} />
        </div>
      )}

      {/* Holdings */}
      {holdings.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-surface/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              Holdings ({holdings.length})
            </h3>
          </div>
          <div className="divide-y divide-border/10">
            {holdings.map((h: any) => (
              <div key={h.ticker} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm">{h.ticker}</span>
                  <span className="text-xs text-muted-foreground">{h.shares} shares</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">${h.price?.toFixed(2)}</span>
                  <span className={`text-sm font-semibold ${(h.changePercent || 0) >= 0 ? "text-emerald" : "text-rose"}`}>
                    {(h.changePercent || 0) >= 0 ? "+" : ""}{(h.changePercent || 0).toFixed(2)}%
                  </span>
                  <span className="text-sm font-medium">${h.value?.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prediction Exposure */}
      {predictionExposure && (
        <div className="rounded-xl border border-border/30 bg-surface/30 p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald" />
            Prediction Exposure
          </h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald" />
              <span className="text-xs">Bullish: {predictionExposure.bullish}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose" />
              <span className="text-xs">Bearish: {predictionExposure.bearish}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted-foreground" />
              <span className="text-xs">Neutral: {predictionExposure.neutral}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Risk Flags */}
      {riskFlags.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-surface/30 p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-amber-500" />
            Risk Flags
          </h3>
          <div className="space-y-2">
            {riskFlags.map((flag: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                  flag.severity === "high" ? "text-rose" : flag.severity === "medium" ? "text-amber-500" : "text-muted-foreground"
                }`} />
                <div>
                  <span className="font-medium">{flag.title}</span>
                  <span className="text-muted-foreground ml-1">{flag.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-border/30 bg-surface/30 p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold ${positive === true ? "text-emerald" : positive === false ? "text-rose" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
