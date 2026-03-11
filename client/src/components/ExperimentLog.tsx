import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, XCircle, Loader2, GitCommit, ArrowUp, ArrowDown,
  Cpu, Timer, Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface Experiment {
  id: string;
  name: string;
  hypothesis?: string;
  description: string;
  status: "running" | "completed" | "reverted";
  metric: string;
  baselineScore: number;
  experimentScore: number | null;
  improvement: number | null;
  startedAt: number;
  completedAt: number | null;
  commitHash: string | null;
}

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    color: "text-emerald",
    bg: "bg-emerald/10 text-emerald border-emerald/20",
    label: "Committed",
  },
  reverted: {
    icon: XCircle,
    color: "text-rose",
    bg: "bg-rose/10 text-rose border-rose/20",
    label: "Reverted",
  },
  running: {
    icon: Loader2,
    color: "text-blue-400",
    bg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    label: "Running",
  },
};

export function ExperimentLog({ experiments, isLoading }: { experiments?: Experiment[]; isLoading: boolean }) {
  if (isLoading || !experiments) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg bg-surface/30 space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  const runningCount = experiments.filter(e => e.status === "running").length;
  const completedCount = experiments.filter(e => e.status === "completed").length;
  const revertedCount = experiments.filter(e => e.status === "reverted").length;

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-3 px-1">
        <div className="flex items-center gap-1.5 text-[10px]">
          <Zap className="w-3 h-3 text-blue-400" />
          <span className="text-muted-foreground">
            <span className="font-mono font-bold text-blue-400">{runningCount}</span> running
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <CheckCircle2 className="w-3 h-3 text-emerald" />
          <span className="text-muted-foreground">
            <span className="font-mono font-bold text-emerald">{completedCount}</span> committed
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <XCircle className="w-3 h-3 text-rose/70" />
          <span className="text-muted-foreground">
            <span className="font-mono font-bold text-rose/70">{revertedCount}</span> reverted
          </span>
        </div>
      </div>

      <ScrollArea className="h-[330px] pr-1">
        <div className="space-y-2">
          {experiments.map((exp, i) => (
            <motion.div
              key={exp.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <ExperimentCard experiment={exp} />
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function LiveProgressBar() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("Training");

  useEffect(() => {
    const phases = [
      "Initializing",
      "Loading data",
      "Training",
      "Evaluating",
      "Cross-validating",
      "Computing metrics",
    ];
    let current = 0;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.random() * 3 + 0.5;
        if (next >= 100) {
          clearInterval(interval);
          return 100;
        }
        return next;
      });
      current = (current + 1) % phases.length;
      if (Math.random() > 0.7) {
        setPhase(phases[current]);
      }
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-2 pl-6 space-y-1.5">
      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full bg-muted/20 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
          initial={{ width: "0%" }}
          animate={{ width: `${Math.min(progress, 95)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        {/* Shimmer effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-blue-400 animate-pulse" />
          <span className="text-[10px] text-blue-400/80 font-mono">{phase}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Timer className="w-3 h-3 text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Live log lines */}
      <LiveLogLines />
    </div>
  );
}

function LiveLogLines() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const logMessages = [
      "Loading training set: 14,832 samples",
      "Feature extraction: sentiment_score, volume_delta, momentum_14d",
      "Epoch 1/50: loss=0.4231, val_acc=0.612",
      "Epoch 12/50: loss=0.3187, val_acc=0.658",
      "Epoch 25/50: loss=0.2894, val_acc=0.671",
      "Epoch 38/50: loss=0.2651, val_acc=0.683",
      "Cross-validation fold 3/5: acc=0.679",
      "Computing Sharpe ratio on holdout set...",
      "Backtesting on 2024-01 to 2026-02 window",
      "Signal correlation matrix: max_corr=0.34",
      "Ensemble weight optimization: α=0.65, β=0.35",
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < logMessages.length) {
        setLines((prev) => [...prev.slice(-2), logMessages[idx]]);
        idx++;
      } else {
        idx = 0;
      }
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-black/30 rounded px-2 py-1.5 font-mono text-[9px] text-muted-foreground/50 space-y-0.5 min-h-[36px]">
      {lines.map((line, i) => (
        <motion.div
          key={`${line}-${i}`}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: i === lines.length - 1 ? 0.8 : 0.4, x: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-1"
        >
          <span className="text-blue-500/50">▸</span>
          <span>{line}</span>
        </motion.div>
      ))}
    </div>
  );
}

function ExperimentCard({ experiment }: { experiment: Experiment }) {
  const config = statusConfig[experiment.status];
  const StatusIcon = config.icon;
  const isPositive = experiment.improvement !== null && experiment.improvement > 0;
  const isRunning = experiment.status === "running";

  return (
    <div className={`p-3 rounded-lg border transition-all duration-200 group ${
      isRunning
        ? "bg-blue-500/5 border-blue-500/20 shadow-sm shadow-blue-500/5"
        : "bg-surface/40 border-border/20 hover:border-border/40"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon className={`w-4 h-4 shrink-0 ${config.color} ${isRunning ? "animate-spin" : ""}`} />
          <span className="text-[13px] font-semibold text-foreground truncate">{experiment.name}</span>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[9px] px-1.5 py-0 h-5 border ${config.bg}`}>
          {config.label}
        </Badge>
      </div>

      {/* Hypothesis */}
      {experiment.hypothesis && (
        <p className="text-[11px] text-muted-foreground/80 italic mb-1.5 pl-6 leading-relaxed line-clamp-2">
          &ldquo;{experiment.hypothesis}&rdquo;
        </p>
      )}

      {/* Description */}
      <p className="text-[11px] text-muted-foreground leading-relaxed mb-2.5 pl-6 line-clamp-2">
        {experiment.description}
      </p>

      {/* Metrics row */}
      <div className="flex items-center justify-between pl-6 flex-wrap gap-1">
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-muted-foreground">
            Metric: <span className="text-foreground/70 font-medium">{experiment.metric}</span>
          </span>
          <span className="text-muted-foreground">
            Base: <span className="font-mono text-foreground/60">{experiment.baselineScore.toFixed(3)}</span>
          </span>
          {experiment.experimentScore !== null && (
            <span className="text-muted-foreground">
              Exp: <span className="font-mono text-foreground/60">{experiment.experimentScore.toFixed(3)}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {experiment.improvement !== null && (
            <span className={`font-mono text-[11px] font-bold flex items-center gap-0.5 ${isPositive ? "text-emerald" : "text-rose"}`}>
              {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {isPositive ? "+" : ""}{experiment.improvement.toFixed(1)}%
            </span>
          )}
          {experiment.commitHash && (
            <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-0.5">
              <GitCommit className="w-3 h-3" />
              {experiment.commitHash}
            </span>
          )}
        </div>
      </div>

      {/* Live progress for running experiments */}
      {isRunning && <LiveProgressBar />}
    </div>
  );
}
