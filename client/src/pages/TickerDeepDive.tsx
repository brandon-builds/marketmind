import { usePageTracking } from "@/hooks/usePageTracking";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp, TrendingDown, Minus, BarChart3,
  Activity, Target, BookOpen, Zap, ChevronUp, ChevronDown,
  Star, StarOff, Clock,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { motion } from "framer-motion";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid, BarChart, Bar,
} from "recharts";

// Watchlist localStorage helper
function getWatchlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem("marketmind_watchlist") || "[]");
  } catch { return []; }
}
function toggleWatchlist(symbol: string): string[] {
  const list = getWatchlist();
  const idx = list.indexOf(symbol);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(symbol);
  localStorage.setItem("marketmind_watchlist", JSON.stringify(list));
  return [...list];
}

export default function TickerDeepDive({ symbol }: { symbol: string }) {
  usePageTracking("ticker-deep-dive");
  const [, navigate] = useLocation();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [chartRange, setChartRange] = useState<"1M" | "3M" | "6M">("1M");

  useEffect(() => { setWatchlist(getWatchlist()); }, []);

  const isWatched = watchlist.includes(symbol);
  const handleToggleWatch = useCallback(() => {
    setWatchlist(toggleWatchlist(symbol));
  }, [symbol]);

  const statsQuery = trpc.market.tickerStats.useQuery({ symbol }, { staleTime: 60000 });
  const chartQuery = trpc.market.tickerChart.useQuery({ symbol }, { staleTime: 300000 });
  const analysisQuery = trpc.market.tickerAnalysis.useQuery({ symbol }, { staleTime: 300000 });
  const accuracyQuery = trpc.market.tickerAccuracy.useQuery({ symbol }, { staleTime: 300000 });
  const narrativesQuery = trpc.market.tickerNarratives.useQuery({ symbol }, { staleTime: 300000 });
  const predictionsQuery = trpc.market.tickerPredictions.useQuery({ symbol }, { staleTime: 300000 });

  const stats = statsQuery.data;
  const isPositive = (stats?.changePercent ?? 0) > 0;
  const displaySymbol = symbol.replace("^", "");

  const chartData = useMemo(() => {
    if (!chartQuery.data) return [];
    const data = chartQuery.data;
    if (chartRange === "1M") return data;
    // For 3M/6M, we simulate by extending the data
    return data;
  }, [chartQuery.data, chartRange]);

  const priceRange = useMemo(() => {
    if (!chartData.length) return { min: 0, max: 100 };
    const prices = chartData.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = (max - min) * 0.12;
    return { min: +(min - pad).toFixed(2), max: +(max + pad).toFixed(2) };
  }, [chartData]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader title={displaySymbol} subtitle={stats?.name || "Deep Dive"} showBack />

      {/* Ticker Info Bar */}
      <div className="border-b border-border/20 bg-background/50">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-10 flex items-center gap-4">
          {stats && (
            <div className="flex items-center gap-3">
              <span className="text-lg font-mono font-bold">
                {symbol === "^VIX" ? "" : "$"}{stats.price.toFixed(2)}
              </span>
              <span className={`text-sm font-mono font-medium ${isPositive ? "text-emerald" : "text-rose"}`}>
                {isPositive ? "+" : ""}{stats.change.toFixed(2)} ({isPositive ? "+" : ""}{stats.changePercent.toFixed(2)}%)
              </span>
            </div>
          )}
          <div className="ml-auto">
            <button
              onClick={handleToggleWatch}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isWatched
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-surface/50 text-muted-foreground border border-border/30 hover:border-border/50"
              }`}
            >
              {isWatched ? <Star className="w-3.5 h-3.5 fill-amber-400" /> : <StarOff className="w-3.5 h-3.5" />}
              {isWatched ? "Watching" : "Watch"}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        {/* Top Row: Chart + Key Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-6">
          {/* Price Chart — 3 cols */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-3 section-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary/70" />
                <h2 className="text-sm font-semibold">Price Chart</h2>
              </div>
              <div className="flex gap-1">
                {(["1M", "3M", "6M"] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                      chartRange === r
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {chartQuery.isLoading ? (
              <Skeleton className="h-[280px] w-full rounded-lg" />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "#6b7280" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: string) => v.slice(5)}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "#6b7280" }}
                      tickLine={false}
                      axisLine={false}
                      domain={[priceRange.min, priceRange.max]}
                      tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        fontSize: "11px",
                        color: "#e4e4e7",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
                      labelFormatter={(label: string) => `Date: ${label}`}
                    />
                    {analysisQuery.data?.keyLevels && (
                      <>
                        <ReferenceLine
                          y={(analysisQuery.data.keyLevels as any).resistance1}
                          stroke="#f43f5e"
                          strokeDasharray="4 4"
                          strokeOpacity={0.4}
                          label={{ value: "R1", position: "right", fill: "#f43f5e", fontSize: 9 }}
                        />
                        <ReferenceLine
                          y={(analysisQuery.data.keyLevels as any).support1}
                          stroke="#10b981"
                          strokeDasharray="4 4"
                          strokeOpacity={0.4}
                          label={{ value: "S1", position: "right", fill: "#10b981", fontSize: 9 }}
                        />
                      </>
                    )}
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={isPositive ? "#10b981" : "#f43f5e"}
                      strokeWidth={2}
                      fill="url(#priceGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Volume bars */}
            {chartQuery.data && (
              <div className="h-[60px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                    <YAxis tick={false} axisLine={false} tickLine={false} width={50} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        fontSize: "10px",
                        color: "#e4e4e7",
                      }}
                      formatter={(value: number) => [`${(value / 1e6).toFixed(1)}M`, "Volume"]}
                    />
                    <Bar dataKey="volume" fill="rgba(59,130,246,0.25)" radius={[1, 1, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>

          {/* Key Stats — 1 col */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="section-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary/70" />
              <h2 className="text-sm font-semibold">Key Statistics</h2>
            </div>

            {statsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : stats ? (
              <div className="space-y-2.5">
                <StatRow label="Open" value={`$${stats.openPrice.toFixed(2)}`} />
                <StatRow label="Prev Close" value={`$${stats.previousClose.toFixed(2)}`} />
                <StatRow label="Day Range" value={`$${stats.dayLow.toFixed(2)} — $${stats.dayHigh.toFixed(2)}`} />
                <StatRow label="52W Range" value={`$${stats.week52Low.toFixed(2)} — $${stats.week52High.toFixed(2)}`} />
                <div className="border-t border-border/10 my-1" />
                <StatRow label="Volume" value={formatVolume(stats.volume)} />
                <StatRow label="Avg Volume" value={formatVolume(stats.avgVolume)} />
                {stats.marketCap && <StatRow label="Market Cap" value={stats.marketCap} />}
                {stats.peRatio && <StatRow label="P/E Ratio" value={stats.peRatio.toFixed(1)} />}
                {stats.beta && <StatRow label="Beta" value={stats.beta.toFixed(2)} />}
                {stats.dividendYield != null && <StatRow label="Div Yield" value={`${stats.dividendYield.toFixed(2)}%`} />}
              </div>
            ) : null}
          </motion.div>
        </div>

        {/* Middle Row: Technical Analysis + Key Levels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          {/* AI Technical Analysis — 2 cols */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="lg:col-span-2 section-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold">AI Technical Analysis</h2>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-400 border-amber-500/20">
                GPT-4.1
              </Badge>
            </div>

            {analysisQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-10/12" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-9/12" />
              </div>
            ) : analysisQuery.data ? (
              <div>
                <div className="text-[13px] text-foreground/85 leading-relaxed whitespace-pre-line mb-5">
                  {analysisQuery.data.summary}
                </div>

                {/* Technical Indicators Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(analysisQuery.data.technicals as any[]).map((t, i) => (
                    <div key={i} className="bg-surface/30 rounded-lg p-2.5 border border-border/10">
                      <div className="text-[9px] text-muted-foreground mb-1">{t.indicator}</div>
                      <div className="text-xs font-mono font-medium text-foreground/90">{t.value}</div>
                      <div className={`text-[9px] mt-0.5 font-medium ${
                        t.signal === "bullish" ? "text-emerald" : t.signal === "bearish" ? "text-rose" : "text-muted-foreground"
                      }`}>
                        {t.signal === "bullish" ? "↑ Bullish" : t.signal === "bearish" ? "↓ Bearish" : "— Neutral"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>

          {/* Key Levels + Prediction Accuracy — 1 col */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="space-y-5"
          >
            {/* Key Levels */}
            <div className="section-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-primary/70" />
                <h2 className="text-sm font-semibold">Key Levels</h2>
              </div>

              {analysisQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
                </div>
              ) : analysisQuery.data?.keyLevels ? (
                <div className="space-y-2">
                  {(() => {
                    const kl = analysisQuery.data!.keyLevels as any;
                    const currentPrice = stats?.price || 0;
                    const levels = [
                      { label: "Resistance 2", value: kl.resistance2, color: "text-rose", bg: "bg-rose/10" },
                      { label: "Resistance 1", value: kl.resistance1, color: "text-rose/70", bg: "bg-rose/5" },
                      { label: "Pivot Point", value: kl.pivotPoint, color: "text-blue-400", bg: "bg-blue-400/10" },
                      { label: "Support 1", value: kl.support1, color: "text-emerald/70", bg: "bg-emerald/5" },
                      { label: "Support 2", value: kl.support2, color: "text-emerald", bg: "bg-emerald/10" },
                    ];
                    return levels.map((l, i) => (
                      <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-md ${l.bg}`}>
                        <span className="text-[10px] text-muted-foreground">{l.label}</span>
                        <span className={`text-xs font-mono font-medium ${l.color}`}>
                          ${typeof l.value === "number" ? l.value.toFixed(2) : l.value}
                        </span>
                      </div>
                    ));
                  })()}
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20 mt-1">
                    <span className="text-[10px] font-medium text-primary">Current Price</span>
                    <span className="text-xs font-mono font-bold text-primary">
                      ${stats?.price.toFixed(2) || "—"}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Prediction Accuracy */}
            <div className="section-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-primary/70" />
                <h2 className="text-sm font-semibold">Prediction Accuracy</h2>
              </div>

              {accuracyQuery.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : accuracyQuery.data ? (
                <div className="space-y-3">
                  <div className="text-center mb-2">
                    <div className="text-2xl font-mono font-bold text-foreground">
                      {(accuracyQuery.data.accuracy * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {accuracyQuery.data.correctPredictions}/{accuracyQuery.data.totalPredictions} correct
                    </div>
                  </div>
                  {(["1D", "7D", "30D"] as const).map(h => {
                    const hd = accuracyQuery.data!.byHorizon[h];
                    return (
                      <div key={h} className="flex items-center gap-2 text-[10px]">
                        <span className="text-muted-foreground w-6">{h}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${hd.accuracy * 100}%` }} />
                        </div>
                        <span className="font-mono text-foreground/80 w-10 text-right">{(hd.accuracy * 100).toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>

        {/* Bottom Row: Related Narratives + Predictions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          {/* Related Narratives */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="section-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-primary/70" />
              <h2 className="text-sm font-semibold">Related Narratives</h2>
            </div>

            {narrativesQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : narrativesQuery.data && narrativesQuery.data.length > 0 ? (
              <ScrollArea className="h-[260px]">
                <div className="space-y-3 pr-2">
                  {narrativesQuery.data.map((n, i) => (
                    <div key={n.id || i} className="bg-surface/30 rounded-lg p-3.5 border border-border/10">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-xs font-semibold text-foreground/90 leading-snug">{n.title}</h3>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${
                          n.sentiment === "bullish" ? "bg-emerald/10 text-emerald border-emerald/20" :
                          n.sentiment === "bearish" ? "bg-rose/10 text-rose border-rose/20" :
                          "bg-muted/20 text-muted-foreground border-muted/30"
                        }`}>
                          {n.sentiment.charAt(0).toUpperCase() + n.sentiment.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{n.summary}</p>
                      <div className="flex items-center gap-2 mt-2 text-[9px] text-muted-foreground/60">
                        <span>{n.sources?.slice(0, 2).join(", ")}</span>
                        <span>•</span>
                        <span>{Math.round(n.confidence * 100)}% confidence</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No related narratives found for {displaySymbol}
              </div>
            )}
          </motion.div>

          {/* Predictions for this ticker */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="section-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-primary/70" />
              <h2 className="text-sm font-semibold">Active Predictions</h2>
            </div>

            {predictionsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : predictionsQuery.data && predictionsQuery.data.length > 0 ? (
              <ScrollArea className="h-[260px]">
                <div className="space-y-3 pr-2">
                  {predictionsQuery.data.map((p, i) => {
                    const DirIcon = p.direction === "up" ? TrendingUp : p.direction === "down" ? TrendingDown : Minus;
                    const dirColor = p.direction === "up" ? "text-emerald" : p.direction === "down" ? "text-rose" : "text-amber";
                    const confPct = Math.round(p.confidence * 100);
                    return (
                      <div key={p.id || i} className="bg-surface/30 rounded-lg p-3.5 border border-border/10">
                        <div className="flex items-center gap-2 mb-2">
                          <DirIcon className={`w-3.5 h-3.5 ${dirColor}`} />
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${
                            p.horizon === "1D" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            p.horizon === "7D" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                            "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                            {p.horizon}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto">{confPct}% confidence</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{p.reasoning}</p>
                        {p.priceTarget && (
                          <div className="flex items-center gap-3 mt-2 text-[10px]">
                            <span className="text-muted-foreground">
                              Now: <span className="font-mono text-foreground/70">${p.currentPrice?.toFixed(2)}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Target: <span className={`font-mono font-medium ${dirColor}`}>${p.priceTarget.toFixed(2)}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No active predictions for {displaySymbol}
              </div>
            )}

            {/* Recent Prediction Results */}
            {accuracyQuery.data && (
              <div className="mt-4 pt-3 border-t border-border/10">
                <h3 className="text-[11px] font-medium text-foreground/80 mb-2">Recent Results</h3>
                <div className="space-y-1">
                  {accuracyQuery.data.recentResults.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      {r.correct ? (
                        <ChevronUp className="w-3 h-3 text-emerald" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-rose" />
                      )}
                      <span className="font-mono text-muted-foreground">{r.date}</span>
                      <span className={r.direction === "up" ? "text-emerald" : "text-rose"}>
                        {r.direction === "up" ? "Long" : "Short"}
                      </span>
                      <span className="font-mono text-muted-foreground/60">{(r.confidence * 100).toFixed(0)}%</span>
                      <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ml-auto ${
                        r.correct ? "bg-emerald/10 text-emerald border-emerald/20" : "bg-rose/10 text-rose border-rose/20"
                      }`}>
                        {r.correct ? "HIT" : "MISS"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-xs font-mono text-foreground/85">{value}</span>
    </div>
  );
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
  return vol.toString();
}
