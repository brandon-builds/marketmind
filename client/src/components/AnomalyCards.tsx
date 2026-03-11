import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  TrendingUp,
  Activity,
  BarChart3,
  Zap,
  ChevronDown,
  ChevronUp,
  Clock,
  Shield,
  ArrowUpRight,
  Radio,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnomalyMetric {
  label: string;
  previous: number;
  current: number;
  unit: string;
  changePercent: number;
}

interface Anomaly {
  id: string;
  type: "volume_spike" | "sentiment_reversal" | "unusual_options" | "narrative_acceleration";
  severity: "critical" | "high" | "medium";
  ticker: string;
  title: string;
  description: string;
  metric: AnomalyMetric;
  relatedSignals: string[];
  detectedAt: number;
  durationMs: number;
  status: "active" | "resolving" | "resolved";
  confidence: number;
  suggestedAction: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  volume_spike: {
    icon: BarChart3,
    label: "Volume Spike",
    color: "rose",
    bgClass: "bg-rose-500/10",
    borderClass: "border-rose-500/30",
    textClass: "text-rose-400",
    glowClass: "shadow-rose-500/10",
  },
  sentiment_reversal: {
    icon: Activity,
    label: "Sentiment Reversal",
    color: "amber",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/30",
    textClass: "text-amber-400",
    glowClass: "shadow-amber-500/10",
  },
  unusual_options: {
    icon: TrendingUp,
    label: "Unusual Options",
    color: "purple",
    bgClass: "bg-purple-500/10",
    borderClass: "border-purple-500/30",
    textClass: "text-purple-400",
    glowClass: "shadow-purple-500/10",
  },
  narrative_acceleration: {
    icon: Zap,
    label: "Narrative Acceleration",
    color: "cyan",
    bgClass: "bg-cyan-500/10",
    borderClass: "border-cyan-500/30",
    textClass: "text-cyan-400",
    glowClass: "shadow-cyan-500/10",
  },
};

const SEVERITY_CONFIG = {
  critical: {
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    pulse: true,
    label: "CRITICAL",
  },
  high: {
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    pulse: false,
    label: "HIGH",
  },
  medium: {
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    pulse: false,
    label: "MEDIUM",
  },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function formatMetric(value: number, unit: string): string {
  if (unit === "shares") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return String(value);
  }
  if (unit === "score") return value.toFixed(2);
  if (unit === "ratio") return value.toFixed(2);
  if (unit === "mentions") return value.toLocaleString();
  return String(value);
}

// ─── Single Anomaly Card ─────────────────────────────────────────────────────

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[anomaly.type];
  const severity = SEVERITY_CONFIG[anomaly.severity];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative rounded-xl border ${config.borderClass} ${config.bgClass} overflow-hidden shadow-lg ${config.glowClass} cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Critical pulse border */}
      {anomaly.severity === "critical" && anomaly.status === "active" && (
        <div className="absolute inset-0 rounded-xl border-2 border-rose-500/50 animate-pulse pointer-events-none" />
      )}

      {/* Top accent line */}
      <div className={`h-[2px] ${
        anomaly.severity === "critical" ? "bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500" :
        anomaly.severity === "high" ? "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" :
        "bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500"
      }`} />

      <div className="p-3 sm:p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${config.bgClass} flex items-center justify-center`}>
            <Icon className={`w-4.5 h-4.5 ${config.textClass}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {/* ANOMALY DETECTED badge */}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <AlertTriangle className="w-2.5 h-2.5" />
                Anomaly
              </span>
              {/* Severity badge */}
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${severity.badge}`}>
                {severity.pulse && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse mr-1" />}
                {severity.label}
              </span>
              {/* Ticker */}
              <span className="font-mono text-xs font-bold text-foreground">{anomaly.ticker}</span>
              {/* Status */}
              {anomaly.status === "resolving" && (
                <span className="text-[9px] text-emerald-400/70 font-mono">RESOLVING</span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold text-foreground leading-tight mb-1 truncate">
              {anomaly.title}
            </h3>

            {/* Metric change */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground/60">{anomaly.metric.label}:</span>
              <span className="text-muted-foreground/40 font-mono">
                {formatMetric(anomaly.metric.previous, anomaly.metric.unit)}
              </span>
              <ArrowUpRight className={`w-3 h-3 ${anomaly.metric.changePercent > 0 ? "text-emerald-400" : "text-rose-400"}`} />
              <span className={`font-mono font-bold ${anomaly.metric.changePercent > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatMetric(anomaly.metric.current, anomaly.metric.unit)}
              </span>
              <span className={`font-mono text-[10px] ${anomaly.metric.changePercent > 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
                ({anomaly.metric.changePercent > 0 ? "+" : ""}{anomaly.metric.changePercent}%)
              </span>
            </div>
          </div>

          {/* Right side — time and expand */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
              <Clock className="w-3 h-3" />
              {timeAgo(anomaly.detectedAt)}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/30">
              <Shield className="w-3 h-3" />
              {(anomaly.confidence * 100).toFixed(0)}%
            </div>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/30" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/30" />
            )}
          </div>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border/10 space-y-3">
                {/* Description */}
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  {anomaly.description}
                </p>

                {/* Related signals */}
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider mb-1.5">
                    Related Signals
                  </div>
                  <div className="space-y-1">
                    {anomaly.relatedSignals.map((signal, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground/60">
                        <Radio className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{signal}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggested action */}
                <div className="p-2.5 rounded-lg bg-accent/30 border border-border/10">
                  <div className="text-[10px] font-mono text-primary/60 uppercase tracking-wider mb-1">
                    Suggested Action
                  </div>
                  <p className="text-xs text-foreground/80">{anomaly.suggestedAction}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Anomaly Dashboard Section ───────────────────────────────────────────────

export function AnomalyDashboard() {
  const { data, isLoading } = trpc.market.anomalies.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const anomalies = data?.anomalies || [];
  const stats = data?.stats;
  const criticalAnomalies = anomalies.filter(a => a.severity === "critical" && a.status === "active");
  const otherAnomalies = anomalies.filter(a => !(a.severity === "critical" && a.status === "active"));
  const [showAll, setShowAll] = useState(false);

  // Blink effect for critical anomalies
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (criticalAnomalies.length === 0) return;
    const interval = setInterval(() => setBlink(b => !b), 1500);
    return () => clearInterval(interval);
  }, [criticalAnomalies.length]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-24 rounded-xl bg-accent/20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="text-center py-6">
        <Shield className="w-8 h-8 text-emerald-400/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground/50">No anomalies detected</p>
        <p className="text-[10px] text-muted-foreground/30 mt-1">
          Monitoring {stats?.detectionCycles || 0} cycles completed
        </p>
      </div>
    );
  }

  const displayAnomalies = showAll ? otherAnomalies : otherAnomalies.slice(0, 3);

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      {stats && (
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/40 px-1">
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${stats.criticalCount > 0 ? "bg-rose-400 animate-pulse" : "bg-emerald-400"}`} />
            {stats.totalActive} active
          </span>
          <span className="text-border/30">·</span>
          <span>{stats.totalResolving} resolving</span>
          <span className="text-border/30">·</span>
          <span>{stats.detectionCycles} cycles</span>
        </div>
      )}

      {/* Critical anomalies first — with prominent styling */}
      <AnimatePresence mode="popLayout">
        {criticalAnomalies.map(anomaly => (
          <AnomalyCard key={anomaly.id} anomaly={anomaly} />
        ))}
      </AnimatePresence>

      {/* Other anomalies */}
      <AnimatePresence mode="popLayout">
        {displayAnomalies.map(anomaly => (
          <AnomalyCard key={anomaly.id} anomaly={anomaly} />
        ))}
      </AnimatePresence>

      {/* Show more/less */}
      {otherAnomalies.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          {showAll ? `Show less` : `Show ${otherAnomalies.length - 3} more anomalies`}
        </button>
      )}
    </div>
  );
}

// ─── Compact Anomaly Banner (for top of dashboard) ──────────────────────────

export function AnomalyBanner() {
  const { data } = trpc.market.anomalies.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const critical = (data?.anomalies || []).filter(
    a => a.severity === "critical" && a.status === "active"
  );

  if (critical.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-6 pt-2"
    >
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 flex items-center gap-3 overflow-x-auto">
        <div className="flex items-center gap-2 flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
          <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
            {critical.length} Critical Anomal{critical.length === 1 ? "y" : "ies"}
          </span>
        </div>
        <div className="h-4 w-px bg-rose-500/20 flex-shrink-0" />
        <div className="flex items-center gap-4 overflow-x-auto">
          {critical.slice(0, 3).map(a => (
            <div key={a.id} className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono text-xs font-bold text-foreground">{a.ticker}</span>
              <span className="text-[10px] text-rose-300/70 truncate max-w-[200px]">{a.title}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
