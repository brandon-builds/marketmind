import { trpc } from "@/lib/trpc";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, BarChart3, Target, Zap, Activity,
  ArrowUpRight, ArrowDownRight, Trophy, AlertTriangle, CheckCircle,
  XCircle, Percent, DollarSign, LineChart, PieChart, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AlphaBacktest() {
  const { data: backtest, isLoading } = trpc.intelligence.getBacktestResults.useQuery(undefined, {
    refetchInterval: 30 * 60 * 1000, // Refresh every 30 min
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <div className="container max-w-7xl py-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-purple-400" />
              Alpha Score Backtesting
            </h1>
            <p className="text-muted-foreground mt-1">
              Historical validation of Alpha Score predictions against actual market returns
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              // Export backtest summary as CSV
              if (!backtest) { toast.error("No data to export"); return; }
              const rows = [
                ["Metric", "Value"],
                ["Total Predictions", backtest.summary.totalPredictions],
                ["Win Rate", `${backtest.summary.overallWinRate}%`],
                ["Avg Return", `${backtest.summary.avgReturn}%`],
                ["Sharpe Ratio", backtest.summary.sharpeRatio],
                ["Max Drawdown", `${backtest.summary.maxDrawdown}%`],
                ["Profit Factor", backtest.summary.profitFactor],
                ["Correlation", backtest.correlation],
                ["", ""],
                ["Score Tier", "Win Rate", "Avg Return", "Total Trades", "Best Return", "Worst Return"],
                ...backtest.tierAnalysis.map((t: any) => [t.tier, `${t.winRate}%`, `${t.avgReturn}%`, t.totalTrades, `${t.bestReturn}%`, `${t.worstReturn}%`]),
              ];
              const csv = rows.map(r => r.join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `alpha-backtest-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Backtest results exported to CSV");
            } catch { toast.error("Export failed"); }
          }} className="gap-1">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="h-24 bg-muted/30 animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : backtest ? (
          <>
            {/* Summary Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <StatCard
                label="Total Predictions"
                value={backtest.summary.totalPredictions.toString()}
                icon={<Target className="h-4 w-4 text-blue-400" />}
              />
              <StatCard
                label="Win Rate"
                value={`${backtest.summary.overallWinRate}%`}
                icon={<CheckCircle className="h-4 w-4 text-emerald-400" />}
                good={backtest.summary.overallWinRate > 50}
              />
              <StatCard
                label="Avg Return"
                value={`${backtest.summary.avgReturn >= 0 ? "+" : ""}${backtest.summary.avgReturn}%`}
                icon={<DollarSign className="h-4 w-4 text-amber-400" />}
                good={backtest.summary.avgReturn > 0}
              />
              <StatCard
                label="Correlation"
                value={backtest.correlation.toFixed(3)}
                icon={<Activity className="h-4 w-4 text-purple-400" />}
                good={backtest.correlation > 0.3}
              />
              <StatCard
                label="Sharpe Ratio"
                value={backtest.summary.sharpeRatio.toFixed(2)}
                icon={<Zap className="h-4 w-4 text-yellow-400" />}
                good={backtest.summary.sharpeRatio > 1}
              />
              <StatCard
                label="Max Drawdown"
                value={`-${backtest.summary.maxDrawdown.toFixed(1)}%`}
                icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
                good={backtest.summary.maxDrawdown < 15}
              />
              <StatCard
                label="Profit Factor"
                value={backtest.summary.profitFactor.toFixed(2)}
                icon={<Trophy className="h-4 w-4 text-amber-400" />}
                good={backtest.summary.profitFactor > 1.5}
              />
            </div>

            {/* Cumulative Returns Chart */}
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-purple-400" />
                  Cumulative Returns: Alpha Strategy vs S&P 500 (90 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CumulativeReturnsChart data={backtest.cumulativeReturns} />
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-purple-400 rounded" />
                    <span className="text-sm text-muted-foreground">
                      Alpha Strategy:{" "}
                      <span className={backtest.cumulativeReturns.alphaStrategyReturn >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {backtest.cumulativeReturns.alphaStrategyReturn >= 0 ? "+" : ""}
                        {backtest.cumulativeReturns.alphaStrategyReturn.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-blue-400 rounded" />
                    <span className="text-sm text-muted-foreground">
                      S&P 500:{" "}
                      <span className={backtest.cumulativeReturns.sp500Return >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {backtest.cumulativeReturns.sp500Return >= 0 ? "+" : ""}
                        {backtest.cumulativeReturns.sp500Return.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`${
                      backtest.cumulativeReturns.outperformance >= 0
                        ? "border-emerald-500/50 text-emerald-400"
                        : "border-red-500/50 text-red-400"
                    }`}
                  >
                    {backtest.cumulativeReturns.outperformance >= 0 ? "+" : ""}
                    {backtest.cumulativeReturns.outperformance.toFixed(1)}% outperformance
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Win Rate by Score Tier */}
              <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-400" />
                    Win Rate by Alpha Score Tier
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {backtest.tierAnalysis.map((tier) => (
                    <TierRow key={tier.tier} tier={tier} />
                  ))}
                </CardContent>
              </Card>

              {/* Signal Component Performance */}
              <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-blue-400" />
                    Signal Component Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {backtest.componentAnalysis.map((comp) => (
                    <ComponentRow key={comp.component} comp={comp} />
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Key Insight */}
            <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Key Insight</h3>
                    <p className="text-sm text-muted-foreground">
                      Tickers with Alpha Scores above 80 show a{" "}
                      <span className="text-emerald-400 font-medium">
                        {backtest.tierAnalysis.find(t => t.tier.includes("80+"))?.winRate ?? 0}% win rate
                      </span>{" "}
                      with an average return of{" "}
                      <span className="text-emerald-400 font-medium">
                        +{backtest.tierAnalysis.find(t => t.tier.includes("80+"))?.avgReturn ?? 0}%
                      </span>
                      , compared to only{" "}
                      <span className="text-red-400 font-medium">
                        {backtest.tierAnalysis.find(t => t.tier.includes("30-50"))?.winRate ?? 0}% win rate
                      </span>{" "}
                      for low-scoring tickers. The strongest predictive signal component is{" "}
                      <span className="text-purple-400 font-medium">
                        {backtest.componentAnalysis.find(c => c.bestPerforming)?.label ?? "AI Confidence"}
                      </span>{" "}
                      with a correlation of{" "}
                      <span className="text-purple-400 font-medium">
                        {backtest.componentAnalysis.find(c => c.bestPerforming)?.correlation.toFixed(3) ?? "0.000"}
                      </span>.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              Backtest generated at{" "}
              {new Date(backtest.generatedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ET
              {" "}— Refreshes every 30 minutes. Past performance does not guarantee future results.
            </p>
          </>
        ) : (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No backtest data available yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function StatCard({ label, value, icon, good }: {
  label: string; value: string; icon: React.ReactNode; good?: boolean;
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          {icon}
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <div className={`text-lg font-bold ${good === true ? "text-emerald-400" : good === false ? "text-red-400" : "text-foreground"}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function TierRow({ tier }: { tier: any }) {
  const winRateColor = tier.winRate >= 60 ? "text-emerald-400" : tier.winRate >= 50 ? "text-blue-400" : tier.winRate >= 40 ? "text-amber-400" : "text-red-400";
  const barWidth = Math.max(5, tier.winRate);
  const barColor = tier.winRate >= 60 ? "bg-emerald-500/60" : tier.winRate >= 50 ? "bg-blue-500/60" : tier.winRate >= 40 ? "bg-amber-500/60" : "bg-red-500/60";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{tier.tier}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{tier.totalTrades} trades</span>
          <span className={`font-bold ${winRateColor}`}>{tier.winRate}%</span>
        </div>
      </div>
      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${barWidth}%` }} />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Avg: {tier.avgReturn >= 0 ? "+" : ""}{tier.avgReturn}%</span>
        <span className="text-emerald-400/70">Best: +{tier.bestReturn}%</span>
        <span className="text-red-400/70">Worst: {tier.worstReturn}%</span>
      </div>
    </div>
  );
}

function ComponentRow({ comp }: { comp: any }) {
  const barWidth = Math.max(5, comp.avgContribution * 3);

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{comp.label}</span>
          {comp.bestPerforming && (
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-purple-500/50 text-purple-400">
              BEST
            </Badge>
          )}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-4 bg-muted/30 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${comp.bestPerforming ? "bg-purple-500/60" : "bg-blue-500/40"}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
      <div className="w-16 text-right">
        <span className="text-sm font-mono">{comp.correlation.toFixed(3)}</span>
      </div>
      <div className="w-12 text-right">
        <span className="text-xs text-muted-foreground">{comp.avgContribution}%</span>
      </div>
    </div>
  );
}

function CumulativeReturnsChart({ data }: { data: any }) {
  const alphaData = data.alphaStrategy || [];
  const sp500Data = data.sp500 || [];
  
  if (alphaData.length === 0) return <p className="text-muted-foreground text-sm">No data</p>;

  // SVG chart dimensions
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min/max values
  const allValues = [...alphaData.map((d: any) => d.value), ...sp500Data.map((d: any) => d.value)];
  const minVal = Math.min(...allValues) * 0.995;
  const maxVal = Math.max(...allValues) * 1.005;

  // Scale functions
  const xScale = (i: number, total: number) => padding.left + (i / (total - 1)) * chartWidth;
  const yScale = (val: number) => padding.top + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;

  // Build path strings
  const alphaPath = alphaData.map((d: any, i: number) =>
    `${i === 0 ? "M" : "L"} ${xScale(i, alphaData.length).toFixed(1)} ${yScale(d.value).toFixed(1)}`
  ).join(" ");

  const sp500Path = sp500Data.map((d: any, i: number) =>
    `${i === 0 ? "M" : "L"} ${xScale(i, sp500Data.length).toFixed(1)} ${yScale(d.value).toFixed(1)}`
  ).join(" ");

  // Baseline at $10,000
  const baselineY = yScale(10000);

  // Y-axis labels
  const yLabels = [];
  const step = (maxVal - minVal) / 4;
  for (let i = 0; i <= 4; i++) {
    const val = minVal + step * i;
    yLabels.push({ value: val, y: yScale(val) });
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yLabels.map((l, i) => (
        <g key={i}>
          <line x1={padding.left} y1={l.y} x2={width - padding.right} y2={l.y} stroke="currentColor" strokeOpacity={0.08} />
          <text x={padding.left - 8} y={l.y + 4} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontSize={10}>
            ${(l.value / 1000).toFixed(1)}k
          </text>
        </g>
      ))}

      {/* Baseline */}
      <line x1={padding.left} y1={baselineY} x2={width - padding.right} y2={baselineY} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="4 4" />

      {/* S&P 500 line */}
      <path d={sp500Path} fill="none" stroke="#60a5fa" strokeWidth={2} strokeOpacity={0.6} />

      {/* Alpha strategy line */}
      <path d={alphaPath} fill="none" stroke="#a855f7" strokeWidth={2.5} strokeOpacity={0.9} />

      {/* End dots */}
      {alphaData.length > 0 && (
        <circle
          cx={xScale(alphaData.length - 1, alphaData.length)}
          cy={yScale(alphaData[alphaData.length - 1].value)}
          r={4}
          fill="#a855f7"
        />
      )}
      {sp500Data.length > 0 && (
        <circle
          cx={xScale(sp500Data.length - 1, sp500Data.length)}
          cy={yScale(sp500Data[sp500Data.length - 1].value)}
          r={3.5}
          fill="#60a5fa"
        />
      )}

      {/* X-axis labels */}
      <text x={padding.left} y={height - 5} fill="currentColor" fillOpacity={0.4} fontSize={10}>90d ago</text>
      <text x={width - padding.right} y={height - 5} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontSize={10}>Today</text>
    </svg>
  );
}
