import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Clock, Sparkles, Shield } from "lucide-react";
import { motion } from "framer-motion";

interface Narrative {
  id: string;
  title: string;
  summary: string;
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  sources: string[];
  relatedTickers: string[];
  timestamp: number;
  category: string;
}

const sentimentConfig = {
  bullish: { icon: TrendingUp, color: "text-emerald", bg: "bg-emerald/10 text-emerald border-emerald/20", label: "Bullish" },
  bearish: { icon: TrendingDown, color: "text-rose", bg: "bg-rose/10 text-rose border-rose/20", label: "Bearish" },
  neutral: { icon: Minus, color: "text-amber", bg: "bg-amber/10 text-amber border-amber/20", label: "Neutral" },
};

const categoryLabels: Record<string, string> = {
  macro: "Macro",
  sector_rotation: "Sector Rotation",
  earnings: "Earnings",
  geopolitical: "Geopolitical",
  fed_policy: "Fed Policy",
  tech_disruption: "Tech/AI",
  commodities: "Commodities",
  tariff_impact: "Tariffs",
  credit_risk: "Credit Risk",
};

export function NarrativeFeed({ narratives, isLoading }: { narratives?: Narrative[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3.5 rounded-lg bg-surface/30 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-2 mt-1">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-14" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!narratives || narratives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Sparkles className="w-8 h-8 mb-3 opacity-40" />
        <p className="text-sm font-medium">Generating narratives...</p>
        <p className="text-xs mt-1 opacity-70">AI is analyzing market signals</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[420px] pr-1">
      <div className="space-y-2.5">
        {narratives.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
          >
            <NarrativeCard narrative={n} />
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  );
}

function NarrativeCard({ narrative }: { narrative: Narrative }) {
  const config = sentimentConfig[narrative.sentiment];
  const Icon = config.icon;
  const timeAgo = getTimeAgo(narrative.timestamp);
  const confidencePct = Math.round(narrative.confidence * 100);

  return (
    <div className="p-3.5 rounded-lg bg-surface/40 border border-border/20 hover:border-border/40 transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className={`mt-0.5 p-1 rounded ${narrative.sentiment === "bullish" ? "bg-emerald/10" : narrative.sentiment === "bearish" ? "bg-rose/10" : "bg-amber/10"}`}>
          <Icon className={`w-3.5 h-3.5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold text-foreground leading-snug">
            {narrative.title}
          </h3>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[9px] px-1.5 py-0 h-5 border ${config.bg}`}>
          {config.label}
        </Badge>
      </div>

      {/* Summary */}
      <p className="text-xs text-muted-foreground leading-relaxed mb-3 pl-8">
        {narrative.summary}
      </p>

      {/* Tickers + Category */}
      <div className="flex items-center gap-1.5 mb-2.5 pl-8 flex-wrap">
        {narrative.relatedTickers.slice(0, 5).map((t) => (
          <span
            key={t}
            className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary/80 border border-primary/15"
          >
            {t}
          </span>
        ))}
        {narrative.category && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border/20">
            {categoryLabels[narrative.category] || narrative.category}
          </span>
        )}
        {confidencePct >= 75 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Shield className="w-2.5 h-2.5" />
            VIP Signal
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pl-8">
        <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          {narrative.sources.slice(0, 3).map((s, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-0.5 opacity-40">·</span>}
              {s}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  confidencePct >= 75 ? "bg-emerald" : confidencePct >= 50 ? "bg-amber" : "bg-rose/70"
                }`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">{confidencePct}%</span>
          </div>
          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {timeAgo}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
