import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight,
  Zap, Filter, RefreshCw, Star, BarChart3, Target, Clock, Activity,
  Download, Calendar, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// Mini sparkline component
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 24;
  
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScoreGauge({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const color = score >= 75 ? "text-emerald-400" : score >= 50 ? "text-blue-400" : score >= 30 ? "text-amber-400" : "text-red-400";
  const bgColor = score >= 75 ? "bg-emerald-400/10" : score >= 50 ? "bg-blue-400/10" : score >= 30 ? "bg-amber-400/10" : "bg-red-400/10";
  const borderColor = score >= 75 ? "border-emerald-400/30" : score >= 50 ? "border-blue-400/30" : score >= 30 ? "border-amber-400/30" : "border-red-400/30";
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${bgColor} ${borderColor}`}>
      <span className={`${size === "sm" ? "text-xs" : "text-lg"} font-bold ${color}`}>{score}</span>
    </div>
  );
}

function ComponentBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-14 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );
}

/** Timeframe badge with score and direction */
function TimeframeBadge({ label, score, direction, change }: {
  label: string;
  score: number;
  direction: string;
  change: number;
}) {
  const color = score >= 70 ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/5"
    : score >= 45 ? "text-blue-400 border-blue-400/30 bg-blue-400/5"
    : "text-red-400 border-red-400/30 bg-red-400/5";
  
  return (
    <div className={`inline-flex flex-col items-center px-2 py-1 rounded border ${color} min-w-[52px]`}>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-xs font-bold">{score}</span>
      {change !== 0 && (
        <span className={`text-[9px] ${change > 0 ? "text-emerald-400" : "text-red-400"}`}>
          {change > 0 ? "+" : ""}{change}
        </span>
      )}
    </div>
  );
}

/** Trade type badge */
function TradeTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string }> = {
    conviction: { label: "HIGH CONVICTION", color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
    momentum: { label: "MOMENTUM", color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
    swing: { label: "SWING", color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
    mixed: { label: "MIXED", color: "text-muted-foreground border-border bg-muted/30" },
  };
  const c = config[type] || config.mixed;
  return (
    <Badge variant="outline" className={`text-[10px] ${c.color}`}>
      {c.label}
    </Badge>
  );
}

export default function AlphaLeaderboard() {
  const [, navigate] = useLocation();
  const [sectorFilter, setSectorFilter] = useState("all");
  const [scoreThreshold, setScoreThreshold] = useState("0");
  const [signalFilter, setSignalFilter] = useState("all");

  // Real-time alpha score updates via WebSocket
  const [liveScores, setLiveScores] = useState<Map<string, { score: number; change: number }>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "alpha_score_update" && msg.scores) {
          setLiveScores(prev => {
            const next = new Map(prev);
            for (const s of msg.scores) {
              next.set(s.ticker, { score: s.score, change: s.change });
            }
            return next;
          });
        }
      } catch { /* ignore */ }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const { data: leaderboard, isLoading, refetch } = trpc.intelligence.getLeaderboard.useQuery({
    sector: sectorFilter !== "all" ? sectorFilter : undefined,
    minScore: parseInt(scoreThreshold) || undefined,
    signalType: signalFilter !== "all" ? signalFilter : undefined,
    limit: 50,
  }, { refetchInterval: 5 * 60 * 1000 });

  const { data: topOpportunities } = trpc.intelligence.getTopOpportunities.useQuery(
    { limit: 5 },
    { refetchInterval: 5 * 60 * 1000 }
  );

  const { data: sectors } = trpc.intelligence.getAvailableSectors.useQuery();

  // Earnings badges
  const { data: earningsBadges } = trpc.intelligence.getEarningsBadges.useQuery(
    undefined,
    { refetchInterval: 5 * 60 * 1000 }
  );

  // Build earnings badge lookup
  const earningsBadgeMap = useMemo(() => {
    const map = new Map<string, any>();
    if (earningsBadges) {
      for (const b of earningsBadges) {
        map.set(b.ticker, b);
      }
    }
    return map;
  }, [earningsBadges]);

  // Export handlers
  const handleExportCsv = async () => {
    try {
      const result = await fetch("/api/trpc/intelligence.exportLeaderboardCsv").then(r => r.json());
      const csvData = result?.result?.data?.json?.data;
      if (!csvData) { toast.error("No data to export"); return; }
      const blob = new Blob([csvData], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.result.data.json.filename || "alpha-leaderboard.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch { toast.error("Export failed"); }
  };

  // Multi-timeframe data
  const { data: mtfScores } = trpc.intelligence.getMultiTimeframeScores.useQuery(
    undefined,
    { refetchInterval: 2 * 60 * 1000 }
  );

  // Build MTF lookup
  const mtfMap = useMemo(() => {
    const map = new Map<string, any>();
    if (mtfScores) {
      for (const s of mtfScores) {
        map.set(s.ticker, s);
      }
    }
    return map;
  }, [mtfScores]);

  const entries = leaderboard || [];
  const topOps = topOpportunities || [];

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-400" />
            Alpha Score Leaderboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
            Live multi-timeframe alpha rankings — real-time WebSocket updates
            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
              <Activity className="h-3 w-3 animate-pulse" />
              LIVE
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top Opportunities */}
      {topOps.length > 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-emerald-400" />
              Top Opportunities
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 text-xs">
                Score &gt; 75
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {topOps.map((entry: any) => {
                const mtf = mtfMap.get(entry.ticker);
                const live = liveScores.get(entry.ticker);
                const displayScore = live?.score ?? entry.score;
                return (
                  <div
                    key={entry.ticker}
                    className="p-3 rounded-lg bg-background/50 border border-emerald-500/20 cursor-pointer hover:border-emerald-400/40 transition-all"
                    onClick={() => navigate(`/predictions?ticker=${entry.ticker}`)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">{entry.ticker}</span>
                      <ScoreGauge score={displayScore} />
                    </div>
                    {mtf && (
                      <div className="flex items-center gap-1 mb-1">
                        <TradeTypeBadge type={mtf.tradeType} />
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs">
                      {entry.direction === "bullish" ? (
                        <TrendingUp className="h-3 w-3 text-emerald-400" />
                      ) : entry.direction === "bearish" ? (
                        <TrendingDown className="h-3 w-3 text-red-400" />
                      ) : (
                        <Minus className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className={
                        entry.direction === "bullish" ? "text-emerald-400" :
                        entry.direction === "bearish" ? "text-red-400" : "text-muted-foreground"
                      }>
                        {entry.direction}
                      </span>
                    </div>
                    {mtf && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <TimeframeBadge label="1H" score={mtf.timeframes["1h"].score} direction={mtf.timeframes["1h"].direction} change={mtf.timeframes["1h"].change} />
                        <TimeframeBadge label="4H" score={mtf.timeframes["4h"].score} direction={mtf.timeframes["4h"].direction} change={mtf.timeframes["4h"].change} />
                        <TimeframeBadge label="1W" score={mtf.timeframes["1w"].score} direction={mtf.timeframes["1w"].direction} change={mtf.timeframes["1w"].change} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filters:
        </div>
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Sector" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sectors</SelectItem>
            {(sectors || []).map((s: string) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={scoreThreshold} onValueChange={setScoreThreshold}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Min Score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any Score</SelectItem>
            <SelectItem value="25">Score &gt; 25</SelectItem>
            <SelectItem value="50">Score &gt; 50</SelectItem>
            <SelectItem value="75">Score &gt; 75</SelectItem>
          </SelectContent>
        </Select>

        <Select value={signalFilter} onValueChange={setSignalFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Signal Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Signals</SelectItem>
            <SelectItem value="ai_confidence">AI Confidence</SelectItem>
            <SelectItem value="market_divergence">Market Divergence</SelectItem>
            <SelectItem value="vip_sentiment">VIP Sentiment</SelectItem>
            <SelectItem value="narrative_velocity">Narrative Velocity</SelectItem>
            <SelectItem value="anomaly_flags">Anomaly Flags</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="text-xs">
          {entries.length} tickers
        </Badge>
      </div>

      {/* Leaderboard Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3 text-muted-foreground font-medium w-12">#</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Ticker</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Alpha Score</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      1H / 4H / 1W
                    </div>
                  </th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Trade Type</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">24h Change</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">7D Trend</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Signal Breakdown</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Sector</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td colSpan={9} className="p-3">
                        <div className="h-8 bg-muted/30 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      No tickers match the current filters
                    </td>
                  </tr>
                ) : (
                  entries.map((entry: any) => {
                    const mtf = mtfMap.get(entry.ticker);
                    const live = liveScores.get(entry.ticker);
                    const displayScore = live?.score ?? entry.score;
                    const isLiveUpdated = live !== undefined;

                    return (
                      <tr
                        key={entry.ticker}
                        className={`border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-all ${
                          isLiveUpdated ? "bg-emerald-500/5" : ""
                        }`}
                        onClick={() => navigate(`/predictions?ticker=${entry.ticker}`)}
                      >
                        <td className="p-3 text-muted-foreground font-mono text-xs">
                          {entry.rank <= 3 ? (
                            <span className={
                              entry.rank === 1 ? "text-amber-400 font-bold" :
                              entry.rank === 2 ? "text-gray-300 font-bold" :
                              "text-amber-600 font-bold"
                            }>
                              {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                            </span>
                          ) : entry.rank}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{entry.ticker}</span>
                            {entry.isTopOpportunity && (
                              <Zap className="h-3.5 w-3.5 text-emerald-400" />
                            )}
                            {isLiveUpdated && (
                              <Activity className="h-3 w-3 text-emerald-400 animate-pulse" />
                            )}
                            {earningsBadgeMap.get(entry.ticker) && (
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 ${
                                  earningsBadgeMap.get(entry.ticker)!.riskLevel === "extreme"
                                    ? "text-orange-400 border-orange-500/40 bg-orange-500/10"
                                    : earningsBadgeMap.get(entry.ticker)!.riskLevel === "high"
                                    ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
                                    : "text-yellow-400 border-yellow-500/30"
                                }`}
                              >
                                <Calendar className="h-2.5 w-2.5 mr-0.5" />
                                {earningsBadgeMap.get(entry.ticker)!.label}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <ScoreGauge score={displayScore} />
                        </td>
                        <td className="p-3">
                          {mtf ? (
                            <div className="flex items-center gap-1">
                              <TimeframeBadge label="1H" score={mtf.timeframes["1h"].score} direction={mtf.timeframes["1h"].direction} change={mtf.timeframes["1h"].change} />
                              <TimeframeBadge label="4H" score={mtf.timeframes["4h"].score} direction={mtf.timeframes["4h"].direction} change={mtf.timeframes["4h"].change} />
                              <TimeframeBadge label="1W" score={mtf.timeframes["1w"].score} direction={mtf.timeframes["1w"].direction} change={mtf.timeframes["1w"].change} />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Loading...</span>
                          )}
                        </td>
                        <td className="p-3">
                          {mtf ? (
                            <TradeTypeBadge type={mtf.tradeType} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {entry.change24h !== 0 ? (
                            <span className={`flex items-center gap-0.5 text-xs font-medium ${
                              entry.change24h > 0 ? "text-emerald-400" : "text-red-400"
                            }`}>
                              {entry.change24h > 0 ? (
                                <ArrowUpRight className="h-3 w-3" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3" />
                              )}
                              {entry.change24h > 0 ? "+" : ""}{entry.change24h}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Sparkline
                            data={entry.sparkline || []}
                            color={entry.direction === "bearish" ? "#f87171" : "#34d399"}
                          />
                        </td>
                        <td className="p-3">
                          <div className="w-40 space-y-0.5">
                            <ComponentBar label="AI" value={entry.components?.aiConfidence || 0} color="bg-blue-500" />
                            <ComponentBar label="Market" value={entry.components?.marketDivergence || 0} color="bg-purple-500" />
                            <ComponentBar label="VIP" value={entry.components?.vipSentiment || 0} color="bg-amber-500" />
                            <ComponentBar label="Narr." value={entry.components?.narrativeVelocity || 0} color="bg-emerald-500" />
                            <ComponentBar label="Anom." value={entry.components?.anomalyFlags || 0} color="bg-red-500" />
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className="text-xs">
                            {entry.sector}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
