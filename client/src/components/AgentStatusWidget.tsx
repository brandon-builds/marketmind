import { trpc } from "@/lib/trpc";
import {
  Brain, Activity, RefreshCw, Zap, Database, Shield,
  Hash, TrendingUp, CheckCircle, AlertCircle, Clock,
  Cpu, BarChart3,
} from "lucide-react";

export function AgentStatusWidget() {
  const statusQuery = trpc.intelligence.getAgentStatus.useQuery(
    undefined,
    { refetchInterval: 15000 } // Refresh every 15s
  );

  const status = statusQuery.data;

  if (!status) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Agent Status</h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  const agents = [
    {
      ...status.researchAgent,
      icon: <Brain className="w-4 h-4" />,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/20",
      metrics: [
        { label: "Signals", value: status.researchAgent.signalsProcessed },
        { label: "Narratives", value: status.researchAgent.narrativesGenerated },
        { label: "Predictions", value: status.researchAgent.predictionsGenerated },
      ],
    },
    {
      ...status.improvementAgent,
      icon: <TrendingUp className="w-4 h-4" />,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10 border-emerald-500/20",
      metrics: [
        { label: "Version", value: status.improvementAgent.currentVersion },
        { label: "Accuracy", value: `${Math.round((status.improvementAgent.accuracy || 0) * 100)}%` },
        { label: "Evaluated", value: status.improvementAgent.predictionsEvaluated },
      ],
    },
    {
      ...status.ingestionAgent,
      icon: <Database className="w-4 h-4" />,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10 border-amber-500/20",
      metrics: [
        { label: "Sources", value: status.ingestionAgent.sourcesActive },
        { label: "Signals/hr", value: status.ingestionAgent.signalsPerHour },
        { label: "Today", value: status.ingestionAgent.totalSignalsToday },
      ],
    },
    {
      ...status.vipMonitor,
      icon: <Shield className="w-4 h-4" />,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10 border-purple-500/20",
      metrics: [
        { label: "Generated", value: status.vipMonitor.totalGenerated },
      ],
    },
    {
      ...status.trendingAgent,
      icon: <Hash className="w-4 h-4" />,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10 border-cyan-500/20",
      metrics: [
        { label: "Cycles", value: status.trendingAgent.cycleCount },
      ],
    },
    {
      ...status.predictionMarkets,
      icon: <Activity className="w-4 h-4" />,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10 border-pink-500/20",
      metrics: [
        { label: "Cycles", value: status.predictionMarkets.fetchCycleCount },
        { label: "Real Data", value: status.predictionMarkets.realDataAvailable ? "Yes" : "No" },
      ],
    },
  ];

  const runningCount = agents.filter(a => a.status === "running").length;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-gradient-to-r from-blue-500/5 to-purple-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Agent Status
            </h3>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
              runningCount >= 4
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : runningCount >= 2
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-red-500/20 text-red-400 border-red-500/30"
            }`}>
              {runningCount}/{agents.length} ACTIVE
            </span>
          </div>
          <button
            onClick={() => statusQuery.refetch()}
            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--color-text-tertiary)] ${statusQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="p-3 space-y-2">
        {agents.map((agent, i) => (
          <div
            key={i}
            className={`rounded-lg border p-2.5 ${agent.bgColor} transition-all`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className={agent.color}>{agent.icon}</span>
                <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {agent.name}
                </span>
              </div>
              <StatusIndicator status={agent.status} />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {agent.metrics.map((m, j) => (
                <div key={j} className="text-[10px]">
                  <span className="text-[var(--color-text-tertiary)]">{m.label}: </span>
                  <span className="font-mono font-bold text-[var(--color-text-primary)]">
                    {typeof m.value === "number" ? m.value.toLocaleString() : m.value}
                  </span>
                </div>
              ))}
              {('lastRun' in agent) && (agent as any).lastRun && (
                <div className="text-[10px]">
                  <span className="text-[var(--color-text-tertiary)]">Last: </span>
                  <span className="font-mono text-[var(--color-text-secondary)]">
                    {formatTimeAgo((agent as any).lastRun)}
                  </span>
                </div>
              )}
            </div>

            {('lastError' in agent) && (agent as any).lastError && (
              <div className="mt-1 text-[10px] text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {(agent as any).lastError.slice(0, 60)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const config = status === "running"
    ? { icon: <Zap className="w-2.5 h-2.5" />, label: "Running", color: "text-emerald-400 bg-emerald-500/20 border-emerald-500/30" }
    : status === "idle"
    ? { icon: <Clock className="w-2.5 h-2.5" />, label: "Idle", color: "text-amber-400 bg-amber-500/20 border-amber-500/30" }
    : status === "starting"
    ? { icon: <RefreshCw className="w-2.5 h-2.5 animate-spin" />, label: "Starting", color: "text-blue-400 bg-blue-500/20 border-blue-500/30" }
    : { icon: <AlertCircle className="w-2.5 h-2.5" />, label: status, color: "text-red-400 bg-red-500/20 border-red-500/30" };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
