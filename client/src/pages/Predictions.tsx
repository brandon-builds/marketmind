import { usePageTracking } from "@/hooks/usePageTracking";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, ArrowUpDown, Filter, CheckCircle2,
  XCircle, Clock, Target, BarChart3, ChevronDown, ChevronUp,
  Zap, Activity, Shield, ShieldCheck, ShieldAlert, ShieldX,
  Twitter, Newspaper, LineChart, BarChart, Download, Calendar, AlertTriangle,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { SavedFilters } from "@/components/SavedFilters";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "sonner";
import SmartMoneyBadge from "@/components/SmartMoneyBadge";

type SortBy = "confidence" | "horizon" | "ticker" | "timestamp";
type SortDir = "asc" | "desc";
type HorizonFilter = "all" | "1D" | "7D" | "30D";
type StatusFilter = "all" | "active" | "resolved";

const horizonColors: Record<string, string> = {
  "1D": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "7D": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "30D": "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

const directionConfig = {
  up: { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Bullish" },
  down: { icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10", label: "Bearish" },
  neutral: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted/50", label: "Neutral" },
};

const confidenceLevelConfig: Record<string, { icon: any; color: string; bg: string; border: string; glow: string; label: string }> = {
  very_high: { icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", glow: "shadow-emerald-500/20", label: "Very High" },
  high: { icon: Shield, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", glow: "shadow-blue-500/20", label: "High" },
  moderate: { icon: ShieldAlert, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", glow: "shadow-amber-500/10", label: "Moderate" },
  low: { icon: ShieldX, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", glow: "", label: "Low" },
};

const sourceIcons: Record<string, any> = {
  twitter: Twitter,
  news: Newspaper,
  technical: LineChart,
  options: BarChart,
};

// Countdown helper — computes time remaining until prediction window closes
const HORIZON_MS: Record<string, number> = {
  "1D": 1 * 24 * 3600000,
  "7D": 7 * 24 * 3600000,
  "30D": 30 * 24 * 3600000,
  "60D": 60 * 24 * 3600000,
};

function getCountdown(timestamp: number, horizon: string): { label: string; urgent: boolean } {
  const windowMs = HORIZON_MS[horizon] || 7 * 24 * 3600000;
  const closesAt = timestamp + windowMs;
  const remaining = closesAt - Date.now();

  if (remaining <= 0) return { label: "Evaluating...", urgent: true };

  const hours = Math.floor(remaining / 3600000);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 1) return { label: `${days}d ${remainingHours}h left`, urgent: false };
  if (days === 1) return { label: `1d ${remainingHours}h left`, urgent: false };
  if (hours > 0) return { label: `${hours}h left`, urgent: hours < 6 };
  const mins = Math.max(1, Math.floor(remaining / 60000));
  return { label: `${mins}m left`, urgent: true };
}

// ============================================================================
// Signal Confidence Badge — the key visual distinction
// ============================================================================

function SignalConfidenceBadge({ confidence }: { confidence: any }) {
  if (!confidence) return null;
  const cfg = confidenceLevelConfig[confidence.confidenceLevel] || confidenceLevelConfig.moderate;
  const CfgIcon = cfg.icon;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.border}`}>
      <CfgIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
      <span className={`text-[10px] font-bold ${cfg.color}`}>{confidence.alignmentCount}/{confidence.totalSources}</span>
    </div>
  );
}

// ============================================================================
// Signal Sources Breakdown (expanded view)
// ============================================================================

function SignalSourcesBreakdown({ sources }: { sources: any }) {
  if (!sources) return null;

  const sourceEntries = [
    { key: "twitter", data: sources.twitter },
    { key: "news", data: sources.news },
    { key: "technical", data: sources.technical },
    { key: "options", data: sources.options },
  ];

  return (
    <div className="mt-3 pt-3 border-t border-border/10">
      <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Signal Sources Alignment</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {sourceEntries.map(({ key, data }) => {
          const SrcIcon = sourceIcons[key] || Activity;
          const dirColor = data.direction === "bullish" ? "text-emerald-400" : data.direction === "bearish" ? "text-red-400" : "text-zinc-400";
          const dirBg = data.direction === "bullish" ? "bg-emerald-500/10 border-emerald-500/20" : data.direction === "bearish" ? "bg-red-500/10 border-red-500/20" : "bg-zinc-500/10 border-zinc-500/20";

          return (
            <div key={key} className={`p-2.5 rounded-lg border ${dirBg}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <SrcIcon className={`w-3 h-3 ${dirColor}`} />
                <span className="text-[10px] font-medium text-foreground">{data.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold ${dirColor} capitalize`}>{data.direction}</span>
                <div className="flex-1 h-1 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${data.direction === "bullish" ? "bg-emerald-500" : data.direction === "bearish" ? "bg-red-500" : "bg-zinc-500"}`}
                    style={{ width: `${data.strength * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">{(data.strength * 100).toFixed(0)}%</span>
              </div>
              {key === "twitter" && data.volume > 0 && (
                <span className="text-[9px] text-muted-foreground/60 mt-0.5 block">{data.volume} tweets</span>
              )}
              {key === "news" && data.sources > 0 && (
                <span className="text-[9px] text-muted-foreground/60 mt-0.5 block">{data.sources} sources</span>
              )}
              {key === "technical" && data.pattern && (
                <span className="text-[9px] text-muted-foreground/60 mt-0.5 block">{data.pattern}</span>
              )}
              {key === "options" && (
                <span className="text-[9px] text-muted-foreground/60 mt-0.5 block">
                  C/P: {data.callPutRatio}{data.unusualActivity ? " · Unusual" : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function Predictions() {
  usePageTracking("predictions");
  
  // Deep linking: read ?ticker= from URL for VIP tweet filter
  const urlParams = new URLSearchParams(window.location.search);
  const tickerFilter = urlParams.get("ticker") || "";
  
  const [sortBy, setSortBy] = useState<SortBy>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [horizon, setHorizon] = useState<HorizonFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTicker, setSearchTicker] = useState(tickerFilter);

  // Fetch alpha scores for all tickers
  const { data: alphaScores } = trpc.intelligence.getAlphaScores.useQuery(
    undefined,
    { refetchInterval: 120000 }
  );

  // Build alpha score map
  const alphaMap = useMemo(() => {
    const map = new Map<string, any>();
    if (alphaScores) {
      for (const a of alphaScores) {
        map.set(a.ticker, a);
      }
    }
    return map;
  }, [alphaScores]);

  const { data, isLoading } = trpc.market.predictionsAll.useQuery(
    { sortBy, direction: sortDir, horizon, status },
    { refetchInterval: 120000 }
  );

  // Fetch signal confidence for all visible tickers
  const { data: confidenceData } = trpc.market.signalConfidence.useQuery(
    { ticker: undefined },
    { refetchInterval: 60000 }
  );

  // Build a map of ticker -> confidence data
  const confidenceMap = useMemo(() => {
    const map = new Map<string, any>();
    if (confidenceData) {
      for (const c of confidenceData) {
        map.set(c.ticker, c);
      }
    }
    return map;
  }, [confidenceData]);

  // Fetch Smart Money Flow data
  const { data: smartMoneyData } = trpc.intelligence.getSmartMoneyFlows.useQuery(
    undefined,
    { refetchInterval: 120000 }
  );

  const smartMoneyMap = useMemo(() => {
    const map = new Map<string, any>();
    if (smartMoneyData) {
      for (const s of smartMoneyData) {
        map.set(s.ticker, s);
      }
    }
    return map;
  }, [smartMoneyData]);

  // Fetch earnings badges for risk flagging
  const { data: earningsBadges } = trpc.intelligence.getEarningsBadges.useQuery(
    undefined,
    { refetchInterval: 300000 }
  );

  const earningsBadgeMap = useMemo(() => {
    const map = new Map<string, any>();
    if (earningsBadges) {
      for (const b of earningsBadges) {
        map.set(b.ticker, b);
      }
    }
    return map;
  }, [earningsBadges]);

  const toggleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Predictions" subtitle="AI-Generated Market Forecasts" showBack />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Ticker Filter Banner */}
        {searchTicker && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
            <Target className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-foreground">Filtering by ticker: <strong className="text-violet-400 font-mono">${searchTicker.toUpperCase()}</strong></span>
            <button
              onClick={() => {
                setSearchTicker("");
                window.history.replaceState({}, "", window.location.pathname);
              }}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* Stats Row */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : data?.stats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-5 gap-3"
          >
            <StatCard label="Active Predictions" value={data.stats.totalActive} icon={<Zap className="w-4 h-4 text-blue-400" />} />
            <StatCard label="Resolved" value={data.stats.totalResolved} icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} />
            <StatCard label="Hit Rate" value={`${(data.stats.hitRate * 100).toFixed(1)}%`} icon={<Target className="w-4 h-4 text-amber-400" />} />
            <StatCard label="Avg Confidence" value={`${(data.stats.avgConfidence * 100).toFixed(0)}%`} icon={<Activity className="w-4 h-4 text-purple-400" />} />
            <StatCard label="Total Predictions" value={data.stats.totalActive + data.stats.totalResolved} icon={<BarChart3 className="w-4 h-4 text-cyan-400" />} />
          </motion.div>
        )}

        {/* Signal Confidence Overview */}
        {confidenceData && confidenceData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="section-card overflow-hidden"
          >
            <div className="h-[2px] bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 opacity-50" />
            <div className="px-4 py-3 border-b border-border/15">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <h2 className="font-display text-[13px] font-semibold">Multi-Source Signal Confidence</h2>
                <span className="text-[10px] text-muted-foreground/50 ml-1">Twitter + News + Technical + Options alignment</span>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {confidenceData.map((c) => {
                  const cfg = confidenceLevelConfig[c.confidenceLevel] || confidenceLevelConfig.moderate;
                  const CfgIcon = cfg.icon;
                  const dirColor = c.consensusDirection === "bullish" ? "text-emerald-400" : c.consensusDirection === "bearish" ? "text-red-400" : "text-zinc-400";

                  return (
                    <Link key={c.ticker} href={`/ticker/${c.ticker}`}>
                      <div className={`p-2.5 rounded-lg border transition-all hover:scale-[1.02] cursor-pointer ${cfg.border} ${
                        c.confidenceLevel === "very_high" ? "bg-emerald-500/5 shadow-md shadow-emerald-500/10" :
                        c.confidenceLevel === "high" ? "bg-blue-500/5" :
                        "bg-card/30"
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold font-mono text-foreground">{c.ticker}</span>
                          <CfgIcon className={`w-3 h-3 ${cfg.color}`} />
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          <span className={`text-[10px] font-bold ${dirColor} capitalize`}>{c.consensusDirection}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[0, 1, 2, 3].map(i => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full ${
                                i < c.alignmentCount
                                  ? c.consensusDirection === "bullish" ? "bg-emerald-500" : c.consensusDirection === "bearish" ? "bg-red-500" : "bg-zinc-500"
                                  : "bg-muted/50"
                              }`}
                            />
                          ))}
                        </div>
                        <span className={`text-[9px] mt-1 block ${cfg.color}`}>{cfg.label} ({c.alignmentCount}/4)</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Hit Rate by Horizon */}
        {data?.stats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {(["1D", "7D", "30D"] as const).map(h => {
              const hData = data.stats.byHorizon[h];
              const rate = hData.total > 0 ? (hData.hits / hData.total * 100) : 0;
              return (
                <div key={h} className="section-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${horizonColors[h]}`}>{h}</span>
                    <span className="text-xs text-muted-foreground">{hData.total} predictions</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-foreground mb-2">{rate.toFixed(1)}%</div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${rate}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                      className={`h-full rounded-full ${h === "1D" ? "bg-blue-500" : h === "7D" ? "bg-amber-500" : "bg-purple-500"}`}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-emerald-400">{hData.hits} hits</span>
                    <span className="text-xs text-red-400">{hData.total - hData.hits} misses</span>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Filters & Sort Controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="section-card p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Filters</span>
            </div>

            <div className="h-5 w-px bg-border" />

            {/* Status filter */}
            <div className="flex items-center gap-1">
              {(["all", "active", "resolved"] as StatusFilter[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    status === s
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {s === "all" ? "All" : s === "active" ? "Active" : "Resolved"}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-border" />

            {/* Horizon filter */}
            <div className="flex items-center gap-1">
              {(["all", "1D", "7D", "30D"] as HorizonFilter[]).map(h => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-all ${
                    horizon === h
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {h === "all" ? "All" : h}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Sort controls */}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowUpDown className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Sort</span>
            </div>
            <div className="flex items-center gap-1">
              {([
                { key: "timestamp", label: "Date" },
                { key: "confidence", label: "Confidence" },
                { key: "ticker", label: "Ticker" },
                { key: "horizon", label: "Horizon" },
              ] as { key: SortBy; label: string }[]).map(s => (
                <button
                  key={s.key}
                  onClick={() => toggleSort(s.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                    sortBy === s.key
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {s.label}
                  {sortBy === s.key && (
                    sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Export + Saved Filters */}
          <div className="mt-3 pt-3 border-t border-border/10 flex items-center justify-between flex-wrap gap-2">
            <SavedFilters
              page="predictions"
              currentFilters={{ horizon, status, sortBy, sortDir }}
              onApply={(f) => {
                if (f.horizon) setHorizon(f.horizon as HorizonFilter);
                if (f.status) setStatus(f.status as StatusFilter);
                if (f.sortBy) setSortBy(f.sortBy as SortBy);
                if (f.sortDir) setSortDir(f.sortDir as SortDir);
              }}
            />
            {data?.predictions && data.predictions.length > 0 && (
              <button
                onClick={() => {
                  exportToCsv("marketmind_predictions", [
                    { header: "Ticker", accessor: (r: any) => r.ticker },
                    { header: "Direction", accessor: (r: any) => r.direction },
                    { header: "Confidence", accessor: (r: any) => `${(r.confidence * 100).toFixed(1)}%` },
                    { header: "Horizon", accessor: (r: any) => r.horizon },
                    { header: "Price Target", accessor: (r: any) => r.priceTarget ? `$${r.priceTarget.toFixed(2)}` : "" },
                    { header: "Status", accessor: (r: any) => r.resolved ? (r.hit ? "HIT" : "MISS") : "Active" },
                    { header: "Reasoning", accessor: (r: any) => r.reasoning || "" },
                  ], data.predictions);
                  toast.success("Predictions exported to CSV");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground/60 hover:text-foreground hover:bg-muted/10 transition-colors border border-transparent hover:border-border/15"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            )}
          </div>
        </motion.div>

        {/* Predictions List */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))
          ) : (
            <AnimatePresence mode="popLayout">
              {data?.predictions.filter((pred: any) => {
                if (!searchTicker) return true;
                return pred.ticker?.toLowerCase().includes(searchTicker.toLowerCase());
              }).map((pred: any, i: number) => {
                const dirConf = directionConfig[pred.direction as keyof typeof directionConfig] || directionConfig.neutral;
                const DirIcon = dirConf.icon;
                const isExpanded = expandedId === pred.id;
                const isResolved = pred.resolved;
                const confidence = confidenceMap.get(pred.ticker);
                const confLevel = confidence?.confidenceLevel || "moderate";
                const confCfg = confidenceLevelConfig[confLevel];

                return (
                  <motion.div
                    key={pred.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className={`section-card overflow-hidden cursor-pointer transition-all duration-200 hover:border-primary/20 hover:shadow-md hover:shadow-primary/[0.03] ${
                      isResolved ? "opacity-85" : ""
                    } ${
                      confLevel === "very_high" && !isResolved ? `border-emerald-500/20 shadow-sm ${confCfg.glow}` :
                      confLevel === "high" && !isResolved ? "border-blue-500/15" : ""
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : pred.id)}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Direction icon */}
                        <div className={`w-10 h-10 rounded-lg ${dirConf.bg} flex items-center justify-center flex-shrink-0`}>
                          <DirIcon className={`w-5 h-5 ${dirConf.color}`} />
                        </div>

                        {/* Ticker & Direction */}
                        <div className="min-w-[80px]">
                          <Link
                            href={`/ticker/${pred.ticker}`}
                            className="text-sm font-bold font-mono text-foreground hover:text-blue-400 transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            {pred.ticker}
                          </Link>
                          <div className={`text-xs ${dirConf.color} font-medium`}>{dirConf.label}</div>
                        </div>

                        {/* Horizon badge */}
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${horizonColors[pred.horizon]}`}>
                          {pred.horizon}
                        </span>

                        {/* Signal Confidence Badge */}
                        {confidence && <SignalConfidenceBadge confidence={confidence} />}

                        {/* Smart Money Flow */}
                        {smartMoneyMap.get(pred.ticker) && (
                          <SmartMoneyBadge
                            signal={smartMoneyMap.get(pred.ticker)?.signal || "neutral"}
                            score={smartMoneyMap.get(pred.ticker)?.compositeScore}
                            showScore
                          />
                        )}

                        {/* Alpha Score */}
                        {alphaMap.get(pred.ticker) && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/20">
                            <Zap className="w-3 h-3 text-violet-400" />
                            <span className="text-[10px] font-bold font-mono" style={{
                              color: (alphaMap.get(pred.ticker)?.score ?? 0) >= 70 ? '#34d399' :
                                     (alphaMap.get(pred.ticker)?.score ?? 0) >= 40 ? '#60a5fa' : '#a1a1aa'
                            }}>
                              α{alphaMap.get(pred.ticker)?.score}
                            </span>
                          </div>
                        )}

                        {/* Earnings Risk Flag */}
                        {earningsBadgeMap.get(pred.ticker) && (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${
                            earningsBadgeMap.get(pred.ticker)!.riskLevel === 'extreme'
                              ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                              : earningsBadgeMap.get(pred.ticker)!.riskLevel === 'high'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                              : 'bg-yellow-500/5 border-yellow-500/20 text-yellow-400'
                          }`}>
                            <Calendar className="w-3 h-3" />
                            <span className="text-[10px] font-bold">
                              {earningsBadgeMap.get(pred.ticker)!.label}
                            </span>
                          </div>
                        )}

                        {/* Confidence bar */}
                        <div className="flex-1 max-w-[200px] hidden sm:block">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Confidence</span>
                            <span className="text-xs font-mono font-bold text-foreground">{(pred.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pred.confidence > 0.75 ? "bg-emerald-500" :
                                pred.confidence > 0.55 ? "bg-amber-500" : "bg-red-500"
                              }`}
                              style={{ width: `${pred.confidence * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Price target */}
                        {pred.priceTarget && (
                          <div className="text-right hidden md:block">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Target</div>
                            <div className="text-sm font-mono font-bold text-foreground">${pred.priceTarget.toFixed(2)}</div>
                          </div>
                        )}

                        {/* Status / Outcome with Countdown */}
                        <div className="flex items-center gap-2 ml-auto">
                          {isResolved ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                pred.outcome === "hit"
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                  : "bg-red-500/15 text-red-400 border border-red-500/20"
                              }`}>
                                {pred.outcome === "hit" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                {pred.outcome === "hit" ? "HIT" : "MISS"}
                              </span>
                              {pred.resolvedAt && (
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(pred.resolvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                          ) : (() => {
                            const countdown = getCountdown(pred.timestamp, pred.horizon);
                            return (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                                  <Clock className="w-3.5 h-3.5" />
                                  ACTIVE
                                </span>
                                <span className={`text-[10px] font-mono font-medium ${
                                  countdown.urgent ? "text-amber-400 animate-pulse" : "text-muted-foreground"
                                }`}>
                                  {countdown.label}
                                </span>
                              </div>
                            );
                          })()}
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-2 border-t border-border">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Reasoning */}
                              <div>
                                <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Reasoning</h4>
                                <p className="text-sm text-foreground/80 leading-relaxed">{pred.reasoning}</p>
                                <div className="mt-3 flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Category:</span>
                                  <span className="text-xs text-foreground/80 bg-muted px-2 py-0.5 rounded">{pred.category}</span>
                                </div>
                              </div>

                              {/* Details */}
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-muted/50 rounded-lg p-3">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Current Price</div>
                                    <div className="text-lg font-mono font-bold text-foreground">
                                      ${pred.currentPrice?.toFixed(2) || "—"}
                                    </div>
                                  </div>
                                  <div className="bg-muted/50 rounded-lg p-3">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Price Target</div>
                                    <div className={`text-lg font-mono font-bold ${
                                      pred.direction === "up" ? "text-emerald-400" : pred.direction === "down" ? "text-red-400" : "text-foreground/80"
                                    }`}>
                                      ${pred.priceTarget?.toFixed(2) || "—"}
                                    </div>
                                  </div>
                                </div>

                                {isResolved && pred.actualMove !== null && (
                                  <div className="bg-muted/50 rounded-lg p-3">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Actual Move</div>
                                    <div className={`text-lg font-mono font-bold ${
                                      (pred.actualMove ?? 0) > 0 ? "text-emerald-400" : "text-red-400"
                                    }`}>
                                      {(pred.actualMove ?? 0) > 0 ? "+" : ""}{pred.actualMove?.toFixed(2)}%
                                    </div>
                                  </div>
                                )}

                                <div className="text-xs text-muted-foreground">
                                  Created: {new Date(pred.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  {isResolved && pred.resolvedAt && (
                                    <> · Resolved: {new Date(pred.resolvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Signal Sources Breakdown */}
                            {confidence && <SignalSourcesBreakdown sources={confidence.sources} />}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {data?.predictions.length === 0 && (
            <div className="section-card p-12 text-center">
              <Target className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No predictions match the current filters.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="section-card p-4 group/stat hover:shadow-lg hover:shadow-primary/[0.03] transition-all duration-300 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover/stat:opacity-100 transition-opacity duration-300" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-md bg-muted/50 group-hover/stat:bg-muted transition-colors">{icon}</div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
        </div>
        <div className="text-2xl font-bold font-mono text-foreground">{value}</div>
      </div>
    </div>
  );
}
