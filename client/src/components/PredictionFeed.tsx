import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, Minus, Clock, Target,
  ChevronDown, BarChart3, CheckCircle2, XCircle, Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine,
} from "recharts";

interface Prediction {
  id: string;
  ticker: string;
  direction: "up" | "down" | "neutral";
  horizon: "1D" | "7D" | "30D";
  confidence: number;
  reasoning: string;
  priceTarget?: number;
  currentPrice?: number;
  category: string;
  timestamp: number;
}

const horizonColors: Record<string, string> = {
  "1D": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "7D": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "30D": "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const directionConfig = {
  up: { icon: TrendingUp, color: "text-emerald", bg: "bg-emerald/10", gradientId: "greenGrad", stroke: "#10b981", fill: "url(#greenGrad)" },
  down: { icon: TrendingDown, color: "text-rose", bg: "bg-rose/10", gradientId: "redGrad", stroke: "#f43f5e", fill: "url(#redGrad)" },
  neutral: { icon: Minus, color: "text-amber", bg: "bg-amber/10", gradientId: "amberGrad", stroke: "#f59e0b", fill: "url(#amberGrad)" },
};

const categoryLabels: Record<string, string> = {
  market_direction: "Direction",
  sector_rotation: "Sector",
  volatility: "Volatility",
  event_impact: "Event",
  earnings: "Earnings",
  tariff_impact: "Tariff",
};

export function PredictionFeed({ predictions, isLoading }: { predictions?: Prediction[]; isLoading: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg bg-surface/30 space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!predictions || predictions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Target className="w-8 h-8 mb-3 opacity-40" />
        <p className="text-sm font-medium">Generating predictions...</p>
        <p className="text-xs mt-1 opacity-70">AI models are analyzing market data</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[420px] pr-1">
      <div className="space-y-2.5">
        {predictions.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
          >
            <PredictionCard
              prediction={p}
              isExpanded={expandedId === p.id}
              onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
            />
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  );
}

function PredictionCard({
  prediction,
  isExpanded,
  onToggle,
}: {
  prediction: Prediction;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = directionConfig[prediction.direction];
  const DirIcon = config.icon;
  const confidencePct = Math.round(prediction.confidence * 100);
  const timeAgo = getTimeAgo(prediction.timestamp);

  const getConfidenceColor = (pct: number) => {
    if (pct >= 80) return "bg-emerald";
    if (pct >= 65) return "bg-blue-400";
    if (pct >= 50) return "bg-amber";
    return "bg-rose/70";
  };

  return (
    <div
      className={`rounded-lg bg-surface/40 border transition-all duration-300 group cursor-pointer ${
        isExpanded ? "border-primary/30 shadow-lg shadow-primary/5" : "border-border/20 hover:border-border/40"
      }`}
      onClick={onToggle}
    >
      <div className="p-3.5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1 rounded ${config.bg}`}>
            <DirIcon className={`w-3.5 h-3.5 ${config.color}`} />
          </div>
          <span className="font-mono text-sm font-bold text-foreground">
            {prediction.ticker.replace("^", "")}
          </span>
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-5 border ${horizonColors[prediction.horizon] || ""}`}>
            {prediction.horizon}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {categoryLabels[prediction.category] || prediction.category}
          </span>
          {confidencePct >= 75 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Shield className="w-2.5 h-2.5" />
              VIP Signal
            </span>
          )}
          <div className="ml-auto">
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
          </div>
        </div>

        {/* Reasoning */}
        <p className={`text-xs text-muted-foreground leading-relaxed mb-3 pl-8 ${isExpanded ? "" : "line-clamp-2"}`}>
          {prediction.reasoning}
        </p>

        {/* Price info + Confidence */}
        <div className="flex items-center justify-between pl-8">
          <div className="flex items-center gap-3 text-[11px]">
            {prediction.currentPrice != null && (
              <span className="text-muted-foreground">
                Now: <span className="font-mono text-foreground/70">${prediction.currentPrice.toFixed(2)}</span>
              </span>
            )}
            {prediction.priceTarget != null && (
              <span className="text-muted-foreground">
                Target: <span className={`font-mono font-medium ${config.color}`}>${prediction.priceTarget.toFixed(2)}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${getConfidenceColor(confidencePct)}`}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground w-7 text-right">{confidencePct}%</span>
            </div>
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Detail View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <PredictionDetail prediction={prediction} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PredictionDetail({ prediction }: { prediction: Prediction }) {
  const config = directionConfig[prediction.direction];

  const chartQuery = trpc.market.tickerChart.useQuery(
    { symbol: prediction.ticker },
    { staleTime: 600000 }
  );

  const accuracyQuery = trpc.market.tickerAccuracy.useQuery(
    { symbol: prediction.ticker },
    { staleTime: 600000 }
  );

  const chartData = useMemo(() => {
    if (!chartQuery.data) return [];
    return chartQuery.data.map((p) => ({
      date: p.date.slice(5),
      price: p.price,
    }));
  }, [chartQuery.data]);

  const priceRange = useMemo(() => {
    if (!chartData.length) return { min: 0, max: 100 };
    const prices = chartData.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.15;
    return { min: +(min - padding).toFixed(2), max: +(max + padding).toFixed(2) };
  }, [chartData]);

  return (
    <div className="border-t border-border/20 px-4 pb-4 pt-3 space-y-4">
      {/* Mini Price Chart */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary/60" />
          <span className="text-[11px] font-medium text-foreground/80">30-Day Price History</span>
        </div>
        {chartQuery.isLoading ? (
          <Skeleton className="h-[120px] w-full rounded-lg" />
        ) : (
          <div className="h-[120px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 8, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 8, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                  domain={[priceRange.min, priceRange.max]}
                  tickFormatter={(v: number) => `$${v}`}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                    fontSize: "10px",
                    color: "#e4e4e7",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
                />
                {prediction.priceTarget && (
                  <ReferenceLine
                    y={prediction.priceTarget}
                    stroke={config.stroke}
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                  />
                )}
                {prediction.currentPrice && (
                  <ReferenceLine
                    y={prediction.currentPrice}
                    stroke="#6b7280"
                    strokeDasharray="2 2"
                    strokeOpacity={0.4}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={config.stroke}
                  strokeWidth={1.5}
                  fill={config.fill}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Ticker Accuracy + Recent Results */}
      <div className="grid grid-cols-2 gap-3">
        {/* Historical Accuracy */}
        <div>
          <span className="text-[11px] font-medium text-foreground/80 mb-2 block">
            Historical Accuracy — {prediction.ticker.replace("^", "")}
          </span>
          {accuracyQuery.isLoading ? (
            <Skeleton className="h-20 w-full rounded-lg" />
          ) : accuracyQuery.data ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Overall</span>
                <span className="font-mono font-bold text-foreground">
                  {(accuracyQuery.data.accuracy * 100).toFixed(1)}%
                </span>
              </div>
              {(["1D", "7D", "30D"] as const).map((h) => {
                const hData = accuracyQuery.data!.byHorizon[h];
                return (
                  <div key={h} className="flex items-center gap-2 text-[10px]">
                    <span className="text-muted-foreground w-6">{h}</span>
                    <div className="flex-1 h-1 rounded-full bg-muted/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${hData.accuracy * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-muted-foreground w-10 text-right">
                      {(hData.accuracy * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
              <div className="text-[9px] text-muted-foreground/60 mt-1">
                Based on {accuracyQuery.data.totalPredictions} predictions
              </div>
            </div>
          ) : null}
        </div>

        {/* Recent Results */}
        <div>
          <span className="text-[11px] font-medium text-foreground/80 mb-2 block">Recent Results</span>
          {accuracyQuery.isLoading ? (
            <Skeleton className="h-20 w-full rounded-lg" />
          ) : accuracyQuery.data ? (
            <div className="space-y-1">
              {accuracyQuery.data.recentResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  {r.correct ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald shrink-0" />
                  ) : (
                    <XCircle className="w-3 h-3 text-rose shrink-0" />
                  )}
                  <span className="font-mono text-muted-foreground">{r.date.slice(5)}</span>
                  <span className={r.direction === "up" ? "text-emerald" : "text-rose"}>
                    {r.direction === "up" ? "↑" : "↓"}
                  </span>
                  <span className="font-mono text-muted-foreground/60">{(r.confidence * 100).toFixed(0)}%</span>
                  <span className={`ml-auto font-mono text-[9px] ${r.correct ? "text-emerald/70" : "text-rose/70"}`}>
                    {r.correct ? "HIT" : "MISS"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
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
