import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";

interface SignalSource {
  id: string;
  name: string;
  type: string;
  accuracy: number;
  totalSignals: number;
  correctSignals: number;
  avgConfidence: number;
  trend: "improving" | "declining" | "stable";
  lastSignal: number;
}

const typeColors: Record<string, string> = {
  News: "bg-blue-500/10 text-blue-400 border-blue-500/15",
  Social: "bg-amber-500/10 text-amber-400 border-amber-500/15",
  "Prediction Market": "bg-emerald-500/10 text-emerald-400 border-emerald-500/15",
  Podcast: "bg-purple-500/10 text-purple-400 border-purple-500/15",
  Newsletter: "bg-cyan-500/10 text-cyan-400 border-cyan-500/15",
  Forum: "bg-orange-500/10 text-orange-400 border-orange-500/15",
};

export function SignalLeaderboard({ sources, isLoading }: { sources?: SignalSource[]; isLoading: boolean }) {
  if (isLoading || !sources) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const sorted = [...sources].sort((a, b) => b.accuracy - a.accuracy);

  return (
    <ScrollArea className="h-[360px] pr-1">
      <div className="space-y-1">
        {sorted.map((source, idx) => (
          <motion.div
            key={source.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.3 }}
          >
            <SourceRow source={source} rank={idx + 1} />
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  );
}

function SourceRow({ source, rank }: { source: SignalSource; rank: number }) {
  const trendConfig = {
    improving: { icon: TrendingUp, color: "text-emerald" },
    declining: { icon: TrendingDown, color: "text-rose" },
    stable: { icon: Minus, color: "text-muted-foreground/50" },
  };

  const trend = trendConfig[source.trend];
  const TrendIcon = trend.icon;
  const accuracyPct = source.accuracy * 100;

  const getScoreColor = (pct: number) => {
    if (pct >= 73) return "text-emerald";
    if (pct >= 68) return "text-amber";
    return "text-rose/80";
  };

  const getRankStyle = (r: number) => {
    if (r === 1) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    if (r === 2) return "bg-gray-400/10 text-gray-300 border-gray-400/20";
    if (r === 3) return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    return "bg-muted/20 text-muted-foreground border-border/10";
  };

  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface/60 transition-all duration-200 group">
      {/* Rank badge */}
      <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold border shrink-0 ${getRankStyle(rank)}`}>
        {rank}
      </div>

      {/* Source info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold truncate text-foreground/90">{source.name}</span>
          <span className={`text-[8px] px-1 py-0 rounded border ${typeColors[source.type] || "bg-muted text-muted-foreground"}`}>
            {source.type}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="font-mono text-[9px] text-muted-foreground/60">
            {source.totalSignals.toLocaleString()} signals
          </span>
          <TrendIcon className={`w-2.5 h-2.5 ${trend.color}`} />
        </div>
      </div>

      {/* Score */}
      <div className={`font-mono text-lg font-bold tabular-nums shrink-0 ${getScoreColor(accuracyPct)}`}>
        {Math.round(accuracyPct)}
      </div>
    </div>
  );
}
