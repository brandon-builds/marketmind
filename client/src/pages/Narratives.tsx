import { usePageTracking } from "@/hooks/usePageTracking";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, TrendingUp, TrendingDown, Minus, Filter, Clock, Tag,
  Flame, Rocket, ArrowDown, Activity, BarChart3, Radio, Hash,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { SavedFilters } from "@/components/SavedFilters";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const SECTORS = ["all", "Technology", "Energy", "Financials", "Healthcare", "Consumer", "Industrials", "Materials", "Macro"];
const SENTIMENTS = ["all", "bullish", "bearish", "neutral"] as const;

const sentimentConfig = {
  bullish: { icon: <TrendingUp className="w-3.5 h-3.5" />, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Bullish" },
  bearish: { icon: <TrendingDown className="w-3.5 h-3.5" />, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", label: "Bearish" },
  neutral: { icon: <Minus className="w-3.5 h-3.5" />, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Neutral" },
};

const spreadPatternConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  viral: { icon: Rocket, color: "text-red-400", bg: "bg-red-500/10 border-red-500/25", label: "Viral" },
  building: { icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/25", label: "Building" },
  steady: { icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/25", label: "Steady" },
  fading: { icon: ArrowDown, color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/25", label: "Fading" },
};

// Mini sparkline SVG for velocity over time
function VelocitySparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  const fillPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg width={w} height={h} className="shrink-0">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color === "emerald" ? "#10b981" : color === "rose" ? "#f43f5e" : "#f59e0b"} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color === "emerald" ? "#10b981" : color === "rose" ? "#f43f5e" : "#f59e0b"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#spark-${color})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color === "emerald" ? "#10b981" : color === "rose" ? "#f43f5e" : "#f59e0b"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Narratives() {
  usePageTracking("narratives");
  
  // Deep linking: read ?topic= from URL for trending topic filter
  const urlParams = new URLSearchParams(window.location.search);
  const topicFilter = urlParams.get("topic") || "";
  
  const [sentiment, setSentiment] = useState<"all" | "bullish" | "bearish" | "neutral">("all");
  const [sector, setSector] = useState("all");
  const [searchTerm, setSearchTerm] = useState(topicFilter);
  const [viewMode, setViewMode] = useState<"narratives" | "velocity">(topicFilter ? "narratives" : "velocity");
  const [, navigate] = useLocation();

  const { data, isLoading } = trpc.market.narrativesFiltered.useQuery(
    { sentiment, sector, limit: 20 },
    { refetchInterval: 300000, retry: 2 }
  );

  const { data: velocityData } = trpc.market.narrativeVelocity.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const stats = useMemo(() => {
    if (!data) return { total: 0, bullish: 0, bearish: 0, neutral: 0 };
    return {
      total: data.length,
      bullish: data.filter(n => n.sentiment === "bullish").length,
      bearish: data.filter(n => n.sentiment === "bearish").length,
      neutral: data.filter(n => n.sentiment === "neutral").length,
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader title="Narrative Intelligence" subtitle="AI-Extracted Market Signals & Velocity Tracking" showBack />

      <motion.main
        className="max-w-[1920px] mx-auto px-4 lg:px-6 py-6 space-y-5"
        initial="initial"
        animate="animate"
        variants={stagger}
      >
        {/* View Mode Toggle + Velocity Stats */}
        <motion.div variants={fadeInUp} className="section-card overflow-hidden">
          <div className="h-[2px] bg-gradient-to-r from-amber-500 via-red-500 to-purple-500 opacity-50" />
          <div className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-400 animate-pulse" />
                <h2 className="font-display text-sm font-semibold">Narrative Velocity Tracker</h2>
                <span className="text-[10px] text-muted-foreground/50">Real-time spread monitoring</span>
              </div>
              <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("velocity")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                    viewMode === "velocity" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Flame className="w-3 h-3 inline mr-1" />
                  Velocity
                </button>
                <button
                  onClick={() => setViewMode("narratives")}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                    viewMode === "narratives" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Zap className="w-3 h-3 inline mr-1" />
                  Narratives
                </button>
              </div>
            </div>

            {/* Velocity Stats Row */}
            {velocityData?.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                <div className="p-2.5 rounded-lg bg-card/30 border border-border/10">
                  <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider block mb-0.5">Tracked</span>
                  <span className="font-mono text-lg font-bold text-foreground">{velocityData.stats.totalTracked}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
                  <span className="text-[9px] text-red-400/60 uppercase tracking-wider block mb-0.5">Viral</span>
                  <span className="font-mono text-lg font-bold text-red-400">{velocityData.stats.viral}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                  <span className="text-[9px] text-amber-400/60 uppercase tracking-wider block mb-0.5">Building</span>
                  <span className="font-mono text-lg font-bold text-amber-400">{velocityData.stats.building}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-500/5 border border-zinc-500/15">
                  <span className="text-[9px] text-zinc-400/60 uppercase tracking-wider block mb-0.5">Fading</span>
                  <span className="font-mono text-lg font-bold text-zinc-400">{velocityData.stats.fading}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15">
                  <span className="text-[9px] text-blue-400/60 uppercase tracking-wider block mb-0.5">Avg Velocity</span>
                  <span className="font-mono text-lg font-bold text-blue-400">{velocityData.stats.avgVelocity}</span>
                  <span className="text-[9px] text-muted-foreground/30 ml-0.5">m/h</span>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/15">
                  <span className="text-[9px] text-purple-400/60 uppercase tracking-wider block mb-0.5">Fastest</span>
                  <span className="font-mono text-[11px] font-bold text-purple-400 truncate block">{velocityData.stats.fastestNarrative}</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Velocity View */}
        {viewMode === "velocity" && velocityData && (
          <motion.div variants={fadeInUp} className="space-y-3">
            {velocityData.narratives.map((nv, i) => {
              const sentCfg = sentimentConfig[nv.sentiment] || sentimentConfig.neutral;
              const spreadCfg = spreadPatternConfig[nv.spreadPattern] || spreadPatternConfig.steady;
              const SpreadIcon = spreadCfg.icon;
              const sparkColor = nv.sentiment === "bullish" ? "emerald" : nv.sentiment === "bearish" ? "rose" : "amber";
              const hoursActive = Math.round((Date.now() - nv.firstSeen) / 3600000);
              const velocityTrendIcon = nv.velocityTrend === "accelerating" ? "↑" : nv.velocityTrend === "decelerating" ? "↓" : "→";
              const velocityTrendColor = nv.velocityTrend === "accelerating" ? "text-emerald-400" : nv.velocityTrend === "decelerating" ? "text-red-400" : "text-blue-400";

              return (
                <motion.div
                  key={nv.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`section-card overflow-hidden group ${
                    nv.spreadPattern === "viral" ? "border-red-500/20 shadow-sm shadow-red-500/10" : ""
                  }`}
                >
                  {/* Top accent bar */}
                  <div className={`h-[2px] bg-gradient-to-r ${
                    nv.spreadPattern === "viral" ? "from-red-500 to-orange-500" :
                    nv.spreadPattern === "building" ? "from-amber-500 to-yellow-500" :
                    nv.spreadPattern === "fading" ? "from-zinc-500 to-zinc-600" :
                    "from-blue-500 to-cyan-500"
                  } opacity-40 group-hover:opacity-70 transition-opacity`} />

                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Velocity Score */}
                      <div className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ${
                        nv.spreadPattern === "viral" ? "bg-red-500/10 border border-red-500/25" :
                        "bg-muted/30 border border-border/15"
                      }`}>
                        <span className={`font-mono text-lg font-black ${
                          nv.velocity > 100 ? "text-red-400" : nv.velocity > 50 ? "text-amber-400" : "text-foreground"
                        }`}>
                          {nv.velocity.toFixed(0)}
                        </span>
                        <span className="text-[8px] text-muted-foreground/40 uppercase">m/h</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Title + Badges */}
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground leading-tight">{nv.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${sentCfg.bg} ${sentCfg.color}`}>
                                {sentCfg.label}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${spreadCfg.bg} ${spreadCfg.color}`}>
                                <SpreadIcon className="w-2.5 h-2.5" />
                                {spreadCfg.label}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-muted/15 border border-border/10 text-muted-foreground/40">
                                {nv.category}
                              </span>
                            </div>
                          </div>

                          {/* Sparkline */}
                          <div className="shrink-0 hidden sm:block">
                            <VelocitySparkline data={nv.mentionsHoursAgo} color={sparkColor} />
                            <span className="text-[8px] text-muted-foreground/30 block text-right">12h spread</span>
                          </div>
                        </div>

                        {/* Metrics Row */}
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <div className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3 text-muted-foreground/40" />
                            <span className="text-[11px] font-mono text-foreground">{nv.currentMentions.toLocaleString()}</span>
                            <span className="text-[9px] text-muted-foreground/30">mentions</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className={`text-[11px] font-mono font-bold ${velocityTrendColor}`}>
                              {velocityTrendIcon} {nv.velocityTrend}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Flame className="w-3 h-3 text-muted-foreground/40" />
                            <span className="text-[11px] font-mono text-muted-foreground/60">
                              peak {nv.peakVelocity.toFixed(0)} m/h
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/30">
                            <Clock className="w-3 h-3" />
                            {hoursActive < 24 ? `${hoursActive}h` : `${Math.round(hoursActive / 24)}d`} active
                          </div>

                          <div className="flex items-center gap-1 ml-auto">
                            {nv.relatedTickers.map(t => (
                              <button
                                key={t}
                                onClick={() => navigate(`/ticker/${t}`)}
                                className="px-1.5 py-0.5 rounded bg-primary/8 border border-primary/15 text-[10px] font-mono text-primary/70 hover:text-primary hover:border-primary/30 transition-colors"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Velocity Progress Bar */}
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[9px] text-muted-foreground/30 uppercase tracking-wider">Spread velocity</span>
                            <span className="text-[9px] font-mono text-muted-foreground/40">
                              {nv.mentionsHoursAgo[0]} → {nv.currentMentions} mentions in 12h
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/15 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min((nv.velocity / 200) * 100, 100)}%` }}
                              transition={{ duration: 1, delay: i * 0.1 }}
                              className={`h-full rounded-full ${
                                nv.spreadPattern === "viral" ? "bg-gradient-to-r from-red-500 to-orange-500" :
                                nv.spreadPattern === "building" ? "bg-gradient-to-r from-amber-500 to-yellow-500" :
                                nv.spreadPattern === "fading" ? "bg-zinc-500/50" :
                                "bg-blue-500/60"
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Narratives View */}
        {viewMode === "narratives" && (
          <>
            {/* Filter Bar */}
            <motion.div variants={fadeInUp} className="section-card">
              <div className="h-[2px] bg-gradient-to-r from-amber-500 to-amber-400 opacity-40" />
              <div className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Sentiment Filter */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Filter className="w-3 h-3 text-muted-foreground/50" />
                      <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">Sentiment</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {SENTIMENTS.map(s => (
                        <button
                          key={s}
                          onClick={() => setSentiment(s)}
                          className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                            sentiment === s
                              ? s === "all" ? "bg-primary/15 text-primary border border-primary/25" :
                                s === "bullish" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" :
                                s === "bearish" ? "bg-rose-500/15 text-rose-400 border border-rose-500/25" :
                                "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                              : "bg-muted/10 text-muted-foreground/50 border border-border/15 hover:border-border/30 hover:text-foreground/70"
                          }`}
                        >
                          {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                          {s !== "all" && data && (
                            <span className="ml-1.5 opacity-60">
                              ({s === "bullish" ? stats.bullish : s === "bearish" ? stats.bearish : stats.neutral})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sector Filter */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-3 h-3 text-muted-foreground/50" />
                      <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">Sector</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {SECTORS.map(s => (
                        <button
                          key={s}
                          onClick={() => setSector(s)}
                          className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                            sector === s
                              ? "bg-primary/15 text-primary border border-primary/25"
                              : "bg-muted/10 text-muted-foreground/50 border border-border/15 hover:border-border/30 hover:text-foreground/70"
                          }`}
                        >
                          {s === "all" ? "All Sectors" : s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Saved Filters */}
                <div className="mt-3 pt-3 border-t border-border/10">
                  <SavedFilters
                    page="narratives"
                    currentFilters={{ sentiment, sector }}
                    onApply={(f) => {
                      if (f.sentiment) setSentiment(f.sentiment as typeof sentiment);
                      if (f.sector) setSector(f.sector);
                    }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Search / Topic Filter */}
            {searchTerm && (
              <motion.div variants={fadeInUp} className="flex items-center gap-2 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                <Hash className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-foreground">Filtering by topic: <strong className="text-cyan-400">{searchTerm}</strong></span>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    window.history.replaceState({}, "", window.location.pathname);
                  }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  Clear filter
                </button>
              </motion.div>
            )}

            {/* Stats Row */}
            <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-card/30 border border-border/10">
                <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider block mb-1">Total Narratives</span>
                <span className="font-mono text-xl font-bold text-foreground">{stats.total}</span>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                <span className="text-[9px] text-emerald-400/60 uppercase tracking-wider block mb-1">Bullish</span>
                <span className="font-mono text-xl font-bold text-emerald-400">{stats.bullish}</span>
              </div>
              <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/15">
                <span className="text-[9px] text-rose-400/60 uppercase tracking-wider block mb-1">Bearish</span>
                <span className="font-mono text-xl font-bold text-rose-400">{stats.bearish}</span>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <span className="text-[9px] text-amber-400/60 uppercase tracking-wider block mb-1">Neutral</span>
                <span className="font-mono text-xl font-bold text-amber-400">{stats.neutral}</span>
              </div>
            </motion.div>

            {/* Narrative Cards */}
            <motion.div variants={fadeInUp}>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-lg" />
                  ))}
                </div>
              ) : data && data.length > 0 ? (
                <AnimatePresence mode="popLayout">
                  <div className="space-y-3">
                    {data.filter((narrative: any) => {
                      if (!searchTerm) return true;
                      const term = searchTerm.toLowerCase();
                      return (
                        narrative.title?.toLowerCase().includes(term) ||
                        narrative.summary?.toLowerCase().includes(term) ||
                        narrative.relatedTickers?.some((t: string) => t.toLowerCase().includes(term)) ||
                        narrative.category?.toLowerCase().includes(term)
                      );
                    }).map((narrative: any, i: number) => {
                      const cfg = sentimentConfig[narrative.sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;
                      const timeAgo = getTimeAgo(narrative.timestamp);

                      return (
                        <motion.div
                          key={narrative.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, delay: i * 0.03 }}
                          className="section-card group"
                        >
                          <div className={`h-[2px] bg-gradient-to-r ${
                            narrative.sentiment === "bullish" ? "from-emerald-500 to-emerald-400" :
                            narrative.sentiment === "bearish" ? "from-rose-500 to-rose-400" :
                            "from-amber-500 to-amber-400"
                          } opacity-30 group-hover:opacity-60 transition-opacity`} />
                          <div className="p-4">
                            <div className="flex items-start gap-4">
                              {/* Sentiment Badge */}
                              <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${cfg.bg} border`}>
                                {cfg.icon}
                              </div>

                              <div className="flex-1 min-w-0">
                                {/* Header */}
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <h3 className="text-sm font-semibold text-foreground leading-tight">{narrative.title}</h3>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.bg} ${cfg.color}`}>
                                      {cfg.label}
                                    </span>
                                    <span className="font-mono text-[10px] text-primary/50">
                                      {(narrative.confidence * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>

                                {/* Summary */}
                                <p className="text-[12px] text-muted-foreground/70 leading-relaxed mb-3">{narrative.summary}</p>

                                {/* Meta */}
                                <div className="flex flex-wrap items-center gap-3">
                                  {/* Related Tickers */}
                                  <div className="flex items-center gap-1">
                                    {narrative.relatedTickers?.slice(0, 5).map((ticker: string) => (
                                      <button
                                        key={ticker}
                                        onClick={() => navigate(`/ticker/${ticker}`)}
                                        className="px-1.5 py-0.5 rounded bg-primary/8 border border-primary/15 text-[10px] font-mono text-primary/70 hover:text-primary hover:border-primary/30 transition-colors"
                                      >
                                        {ticker}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Category */}
                                  {narrative.category && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-muted/15 border border-border/10 text-muted-foreground/40">
                                      {narrative.category}
                                    </span>
                                  )}

                                  {/* Sources */}
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/30">
                                    {narrative.sources?.slice(0, 3).map((src: string, j: number) => (
                                      <span key={j}>
                                        {j > 0 && <span className="mx-1">·</span>}
                                        {src}
                                      </span>
                                    ))}
                                  </div>

                                  {/* Time */}
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/30 ml-auto">
                                    <Clock className="w-3 h-3" />
                                    <span>{timeAgo}</span>
                                  </div>
                                </div>

                                {/* Confidence Bar */}
                                <div className="mt-3">
                                  <div className="h-1 rounded-full bg-muted/10 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-700 ${
                                        narrative.sentiment === "bullish" ? "bg-emerald-500/60" :
                                        narrative.sentiment === "bearish" ? "bg-rose-500/60" :
                                        "bg-amber-500/60"
                                      }`}
                                      style={{ width: `${narrative.confidence * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </AnimatePresence>
              ) : (
                <div className="section-card p-12 text-center">
                  <Zap className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground/40">No narratives match your filters</p>
                  <p className="text-xs text-muted-foreground/25 mt-1">Try adjusting the sentiment or sector filters</p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </motion.main>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
