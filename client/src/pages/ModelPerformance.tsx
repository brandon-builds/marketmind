import { usePageTracking } from "@/hooks/usePageTracking";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  Brain, FlaskConical, TrendingUp, GitCommit, GitBranch, RotateCcw, Play,
  CheckCircle2, XCircle, Clock, Zap, Activity, ArrowUpRight, ArrowDownRight,
  Cpu, BarChart3, RefreshCw, Loader2,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, Cell,
} from "recharts";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

// ============================================================================
// Training Status Indicator
// ============================================================================

function TrainingStatusBanner({ metrics }: { metrics: any }) {
  if (!metrics) return null;

  const progress = (metrics.currentEpoch / metrics.totalEpochs) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="section-card border-2 border-amber-500/20 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-orange-500/5 animate-pulse pointer-events-none" />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                <Cpu className="w-5 h-5 text-amber-400" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse border-2 border-background" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Model Training Active
                </h2>
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10 animate-pulse">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  TRAINING
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Self-improving loop is adjusting signal weights based on prediction outcomes</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Epoch</p>
            <p className="text-lg font-bold text-amber-400 font-mono">{metrics.currentEpoch}/{metrics.totalEpochs}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden mb-3">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
          />
        </div>

        {/* Training metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          <div className="p-2 rounded-lg bg-muted/30 text-center">
            <p className="text-[10px] text-muted-foreground">Loss</p>
            <p className="text-sm font-bold text-foreground font-mono">{metrics.loss.toFixed(4)}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 text-center">
            <p className="text-[10px] text-muted-foreground">Learning Rate</p>
            <p className="text-sm font-bold text-foreground font-mono">{metrics.learningRate}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 text-center">
            <p className="text-[10px] text-muted-foreground">Batch Size</p>
            <p className="text-sm font-bold text-foreground font-mono">{metrics.batchSize}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 text-center">
            <p className="text-[10px] text-muted-foreground">Training Data</p>
            <p className="text-sm font-bold text-foreground font-mono">{metrics.trainingDataSize.toLocaleString()}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 text-center">
            <p className="text-[10px] text-muted-foreground">Val. Accuracy</p>
            <p className="text-sm font-bold text-emerald-400 font-mono">{(metrics.validationAccuracy * 100).toFixed(1)}%</p>
          </div>
        </div>

        {/* Weight Changes */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Signal Weight Adjustments</p>
          <div className="space-y-1.5">
            {metrics.weightChanges.map((wc: any) => (
              <div key={wc.signal} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                <span className="text-xs text-foreground w-36 shrink-0">{wc.signal}</span>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">{(wc.oldWeight * 100).toFixed(0)}%</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${wc.change > 0 ? "bg-emerald-500" : wc.change < 0 ? "bg-red-500" : "bg-zinc-500"}`}
                      style={{ width: `${wc.newWeight * 100 * 4}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-foreground">{(wc.newWeight * 100).toFixed(0)}%</span>
                  <span className={`text-[10px] font-mono font-bold ${wc.change > 0 ? "text-emerald-400" : wc.change < 0 ? "text-red-400" : "text-zinc-400"}`}>
                    {wc.change > 0 ? "+" : ""}{(wc.change * 100).toFixed(0)}%
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground/60 w-48 shrink-0 text-right hidden lg:block">{wc.reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Version History with Changelogs
// ============================================================================

function VersionHistory({ versions }: { versions: any[] }) {
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  return (
    <motion.div variants={fadeInUp} className="section-card">
      <div className="h-[2px] bg-gradient-to-r from-blue-500 to-cyan-400 opacity-40" />
      <div className="px-4 py-3 border-b border-border/15">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-blue-400" />
          <h2 className="font-display text-[13px] font-semibold">Model Version History</h2>
          <span className="text-[10px] text-muted-foreground/50 ml-1">Self-improving accuracy over time</span>
        </div>
      </div>
      <ScrollArea className="h-[500px]">
        <div className="p-4 space-y-2">
          {[...versions].reverse().map((v, i) => (
            <div
              key={v.version}
              className={`rounded-lg border transition-all cursor-pointer ${
                v.status === "training"
                  ? "bg-amber-500/5 border-amber-500/20"
                  : v.status === "active"
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-card/30 border-border/10 hover:border-border/30"
              }`}
              onClick={() => setExpandedVersion(expandedVersion === v.version ? null : v.version)}
            >
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">{v.version}</span>
                    {v.status === "active" && (
                      <Badge variant="outline" className="text-[9px] border-emerald-500/20 text-emerald-400 bg-emerald-500/10">
                        ACTIVE
                      </Badge>
                    )}
                    {v.status === "training" && (
                      <Badge variant="outline" className="text-[9px] border-amber-500/20 text-amber-400 bg-amber-500/10 animate-pulse">
                        <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" />
                        TRAINING
                      </Badge>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground/40">
                    {new Date(v.releasedAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Accuracy + improvement */}
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-lg font-bold font-mono text-foreground">{(v.accuracy * 100).toFixed(1)}%</span>
                  {i < versions.length - 1 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 font-mono">
                      <ArrowUpRight className="w-3 h-3" />
                      +{((v.accuracy - versions[versions.length - 1 - i - 1]?.accuracy || 0) * 100).toFixed(1)}%
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{v.totalPredictions} predictions</span>
                  <span className="text-[10px] text-muted-foreground/50">· {v.trainingDuration}</span>
                </div>

                {/* Improvements tags */}
                <div className="flex flex-wrap gap-1 mb-1">
                  {v.improvements.map((imp: string, j: number) => (
                    <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">
                      {imp}
                    </span>
                  ))}
                </div>
              </div>

              {/* Expanded changelog */}
              {expandedVersion === v.version && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="px-3 pb-3 border-t border-border/10"
                >
                  <p className="text-xs text-muted-foreground/70 mt-2 leading-relaxed">{v.changelog}</p>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </motion.div>
  );
}

// ============================================================================
// Prediction Outcome Tracking Chart
// ============================================================================

function OutcomeTrackingChart({ data }: { data: any[] }) {
  return (
    <motion.div variants={fadeInUp} className="section-card">
      <div className="h-[2px] bg-gradient-to-r from-emerald-500 to-cyan-400 opacity-40" />
      <div className="px-4 py-3 border-b border-border/15">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <h2 className="font-display text-[13px] font-semibold">Prediction Outcome Tracking</h2>
          <span className="text-[10px] text-muted-foreground/50 ml-1">30-day rolling accuracy with self-improvement trend</span>
        </div>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="outcomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickFormatter={(v: string) => v.slice(5)}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              tickLine={false}
            />
            <YAxis
              domain={[0.3, 1.0]}
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,15,20,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "11px",
                fontFamily: "JetBrains Mono",
              }}
              formatter={(value: number, name: string) => {
                if (name === "accuracy") return [`${(value * 100).toFixed(1)}%`, "Accuracy"];
                return [value, name];
              }}
              labelFormatter={(label: string) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="accuracy"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#outcomeGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#10b981", stroke: "#0f0f14", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Summary stats below chart */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="p-2 rounded-lg bg-muted/30 text-center">
            <p className="text-[10px] text-muted-foreground">Total Tracked</p>
            <p className="text-sm font-bold text-foreground font-mono">
              {data.reduce((s, d) => s + d.predictions, 0)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 text-center">
            <p className="text-[10px] text-muted-foreground">Total Hits</p>
            <p className="text-sm font-bold text-emerald-400 font-mono">
              {data.reduce((s, d) => s + d.hits, 0)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 text-center">
            <p className="text-[10px] text-muted-foreground">Avg Accuracy</p>
            <p className="text-sm font-bold text-blue-400 font-mono">
              {(data.reduce((s, d) => s + d.accuracy, 0) / data.length * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function ModelPerformance() {
  usePageTracking("model-performance");
  const { data: legacyData, isLoading: legacyLoading } = trpc.market.modelPerformance.useQuery(undefined, {
    refetchInterval: 600000,
  });
  const { data: trainingData, isLoading: trainingLoading } = trpc.market.modelTraining.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const isLoading = legacyLoading || trainingLoading;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader title="Model Performance" subtitle="Self-Improving Intelligence Engine" showBack />

      <motion.main
        className="max-w-[1920px] mx-auto px-4 lg:px-6 py-6 space-y-5"
        initial="initial"
        animate="animate"
        variants={stagger}
      >
        {/* Summary Stats */}
        <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))
          ) : (
            <>
              <StatCard label="Model Version" value={trainingData?.currentVersion || "v3.1.0"} icon={<GitBranch className="w-3.5 h-3.5" />} color="blue" />
              <StatCard label="Current Accuracy" value={`${((trainingData?.versions.find(v => v.status === "active")?.accuracy || 0.724) * 100).toFixed(1)}%`} icon={<TrendingUp className="w-3.5 h-3.5" />} color="emerald" />
              <StatCard label="Predictions Tracked" value={trainingData?.totalPredictionsTracked || 0} icon={<Activity className="w-3.5 h-3.5" />} color="purple" />
              <StatCard label="Versions Trained" value={trainingData?.versions.length || 0} icon={<GitCommit className="w-3.5 h-3.5" />} color="cyan" />
              <StatCard
                label="Improvement"
                value={trainingData?.versions ? `+${(((trainingData.versions.find(v => v.status === "active")?.accuracy || 0.724) - (trainingData.versions[0]?.accuracy || 0.523)) * 100).toFixed(1)}%` : "+20.1%"}
                icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                color="emerald"
              />
              <StatCard label="Experiments" value={legacyData?.summary.totalExperiments || 0} icon={<FlaskConical className="w-3.5 h-3.5" />} color="amber" />
              <StatCard label="Committed" value={legacyData?.summary.committed || 0} icon={<CheckCircle2 className="w-3.5 h-3.5" />} color="emerald" />
              <StatCard label="Training" value={trainingData?.trainingMetrics.isTraining ? "Active" : "Idle"} icon={<Cpu className="w-3.5 h-3.5" />} color={trainingData?.trainingMetrics.isTraining ? "amber" : "blue"} />
            </>
          )}
        </motion.div>

        {/* Training Status Banner */}
        {trainingData?.trainingMetrics.isTraining && (
          <TrainingStatusBanner metrics={trainingData.trainingMetrics} />
        )}

        {/* Accuracy Trend + Version History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Accuracy Improvement Over Versions */}
          <motion.div variants={fadeInUp} className="section-card">
            <div className="h-[2px] bg-gradient-to-r from-emerald-500 to-cyan-400 opacity-40" />
            <div className="px-4 py-3 border-b border-border/15">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <h2 className="font-display text-[13px] font-semibold">Accuracy Improvement Across Versions</h2>
              </div>
            </div>
            <div className="p-4">
              {isLoading ? (
                <Skeleton className="h-[280px] rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trainingData?.overallAccuracyTrend}>
                    <defs>
                      <linearGradient id="versionAccGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="version"
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "JetBrains Mono" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0.45, 0.80]}
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                      tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                      axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,15,20,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontFamily: "JetBrains Mono",
                      }}
                      formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Accuracy"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="accuracy"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#versionAccGrad)"
                      dot={{ r: 4, fill: "#10b981", stroke: "#0f0f14", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "#10b981", stroke: "#0f0f14", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          {/* Version History with Changelogs */}
          {trainingData && <VersionHistory versions={trainingData.versions} />}
        </div>

        {/* Prediction Outcome Tracking */}
        {trainingData && <OutcomeTrackingChart data={trainingData.outcomeTracking} />}

        {/* Legacy: Experiment Timeline + Accuracy by Horizon */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Experiment Timeline */}
          <motion.div variants={fadeInUp} className="section-card">
            <div className="h-[2px] bg-gradient-to-r from-cyan-500 to-cyan-400 opacity-40" />
            <div className="px-4 py-3 border-b border-border/15">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
                <h2 className="font-display text-[13px] font-semibold">Experiment Timeline</h2>
              </div>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="p-4">
                {legacyLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 mb-3 rounded-lg" />)
                ) : (
                  <div className="relative">
                    <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border/15" />
                    <div className="space-y-4">
                      {legacyData?.experiments.map((exp) => {
                        const statusConfig: Record<string, any> = {
                          completed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/20", label: "Committed" },
                          reverted: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-rose-400", bg: "bg-rose-500/15 border-rose-500/20", label: "Reverted" },
                          running: { icon: <Play className="w-3.5 h-3.5" />, color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/20", label: "Running" },
                          pending: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-muted-foreground", bg: "bg-muted/15 border-border/20", label: "Pending" },
                        };
                        const cfg = statusConfig[exp.status] || statusConfig.pending;

                        return (
                          <div key={exp.id} className="relative pl-10">
                            <div className={`absolute left-[9px] top-2 w-3 h-3 rounded-full border-2 ${
                              exp.status === "completed" ? "bg-emerald-500 border-emerald-400" :
                              exp.status === "reverted" ? "bg-rose-500 border-rose-400" :
                              exp.status === "running" ? "bg-amber-500 border-amber-400 animate-pulse" :
                              "bg-muted border-border"
                            }`} />
                            <div className={`p-3 rounded-lg border ${cfg.bg}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-foreground">{exp.name}</span>
                                <span className={`flex items-center gap-1 text-[10px] ${cfg.color}`}>
                                  {cfg.icon}
                                  {cfg.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground/50 mb-2 italic">"{exp.hypothesis}"</p>
                              <p className="text-[11px] text-muted-foreground/60 mb-2">{exp.description}</p>
                              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/40">
                                <span className="font-mono">{new Date(exp.startedAt).toLocaleDateString()}</span>
                                {exp.completedAt && <span>{Math.round((exp.completedAt - exp.startedAt) / 3600000)}h</span>}
                                {exp.commitHash && <span className="font-mono text-primary/40">{exp.commitHash}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>

          {/* Accuracy by Horizon */}
          <motion.div variants={fadeInUp} className="section-card">
            <div className="h-[2px] bg-gradient-to-r from-purple-500 to-violet-400 opacity-40" />
            <div className="px-4 py-3 border-b border-border/15">
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <h2 className="font-display text-[13px] font-semibold">Accuracy by Horizon — Last 30 Days</h2>
              </div>
            </div>
            <div className="p-4">
              {legacyLoading ? (
                <Skeleton className="h-[350px] rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={legacyData?.accuracyHistory?.slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                      tickFormatter={(v: string) => v.slice(5)}
                      axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0.4, 0.85]}
                      tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                      tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                      axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,15,20,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontFamily: "JetBrains Mono",
                      }}
                      formatter={(value: number, name: string) => [`${(value * 100).toFixed(1)}%`, name]}
                    />
                    <Bar dataKey="horizon1D" name="1-Day" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="horizon7D" name="7-Day" fill="#a855f7" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="horizon30D" name="30-Day" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>
        </div>
      </motion.main>
    </div>
  );
}

// ============================================================================
// Stat Card
// ============================================================================

const colorMap: Record<string, string> = {
  blue: "text-blue-400 bg-blue-500/10 border-blue-500/15",
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/15",
  rose: "text-rose-400 bg-rose-500/10 border-rose-500/15",
  amber: "text-amber-400 bg-amber-500/10 border-amber-500/15",
  cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/15",
  purple: "text-purple-400 bg-purple-500/10 border-purple-500/15",
};

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className={`p-3 rounded-lg border ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[9px] uppercase tracking-wider opacity-60">{label}</span>
      </div>
      <span className="font-mono text-lg font-bold text-foreground">{value}</span>
    </div>
  );
}
