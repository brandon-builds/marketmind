import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

const SIGNAL_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  "strong_buy": { label: "STRONG BUY", color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/15", icon: TrendingUp },
  "buy": { label: "BUY", color: "text-emerald-300 border-emerald-300/30 bg-emerald-300/10", icon: ArrowUpRight },
  "neutral": { label: "NEUTRAL", color: "text-muted-foreground border-border bg-muted/30", icon: Minus },
  "sell": { label: "SELL", color: "text-red-300 border-red-300/30 bg-red-300/10", icon: ArrowDownRight },
  "strong_sell": { label: "STRONG SELL", color: "text-red-400 border-red-400/40 bg-red-400/15", icon: TrendingDown },
};

interface SmartMoneyBadgeProps {
  signal: string;
  score?: number;
  showScore?: boolean;
  size?: "sm" | "md";
}

export default function SmartMoneyBadge({ signal, score, showScore = false, size = "sm" }: SmartMoneyBadgeProps) {
  const config = SIGNAL_CONFIG[signal] || SIGNAL_CONFIG.neutral;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.color} ${size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"} gap-1`}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {config.label}
      {showScore && score !== undefined && (
        <span className="ml-0.5 opacity-70">({score})</span>
      )}
    </Badge>
  );
}

/** Detailed Smart Money Flow breakdown */
export function SmartMoneyDetail({ data }: { data: any }) {
  if (!data) return null;

  const components = [
    { label: "VIP Sentiment", value: data.components?.vipSentiment ?? 0, color: "bg-amber-500" },
    { label: "Market Position", value: data.components?.marketPosition ?? 0, color: "bg-purple-500" },
    { label: "Options Flow", value: data.components?.optionsFlow ?? 0, color: "bg-blue-500" },
    { label: "Institutional", value: data.components?.institutional ?? 0, color: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <SmartMoneyBadge signal={data.signal} score={data.compositeScore} showScore size="md" />
        <span className="text-xs text-muted-foreground">
          Confidence: {data.confidence || "medium"}
        </span>
      </div>
      <div className="space-y-1">
        {components.map((c) => (
          <div key={c.label} className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-24 truncate">{c.label}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${c.color}`}
                style={{ width: `${Math.min(100, Math.abs(c.value))}%` }}
              />
            </div>
            <span className={`w-8 text-right ${c.value > 0 ? "text-emerald-400" : c.value < 0 ? "text-red-400" : "text-muted-foreground"}`}>
              {c.value > 0 ? "+" : ""}{c.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
