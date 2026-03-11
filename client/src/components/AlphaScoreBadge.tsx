/**
 * AlphaScoreBadge — Displays the composite Alpha Score (0-100)
 * with a visual gauge, color coding, and component breakdown tooltip
 */

import { useState } from "react";
import { Zap, TrendingUp, Target, Users, Activity, AlertTriangle } from "lucide-react";

interface AlphaScoreProps {
  score: number;
  components?: {
    aiConfidence: number;
    marketDivergence: number;
    vipSentiment: number;
    narrativeVelocity: number;
    anomalyFlags: number;
  };
  direction?: "bullish" | "bearish" | "neutral";
  size?: "sm" | "md" | "lg";
  showBreakdown?: boolean;
}

function getScoreColor(score: number) {
  if (score >= 80) return { text: "text-emerald-400", bg: "bg-emerald-500", ring: "ring-emerald-500/30", gradient: "from-emerald-500 to-cyan-500" };
  if (score >= 60) return { text: "text-blue-400", bg: "bg-blue-500", ring: "ring-blue-500/30", gradient: "from-blue-500 to-violet-500" };
  if (score >= 40) return { text: "text-amber-400", bg: "bg-amber-500", ring: "ring-amber-500/30", gradient: "from-amber-500 to-orange-500" };
  if (score >= 20) return { text: "text-orange-400", bg: "bg-orange-500", ring: "ring-orange-500/30", gradient: "from-orange-500 to-red-500" };
  return { text: "text-zinc-400", bg: "bg-zinc-500", ring: "ring-zinc-500/30", gradient: "from-zinc-500 to-zinc-600" };
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Very High Alpha";
  if (score >= 60) return "High Alpha";
  if (score >= 40) return "Moderate Alpha";
  if (score >= 20) return "Low Alpha";
  return "Minimal Alpha";
}

const componentIcons = {
  aiConfidence: { icon: Zap, label: "AI Confidence", color: "text-cyan-400" },
  marketDivergence: { icon: Target, label: "Market Divergence", color: "text-violet-400" },
  vipSentiment: { icon: Users, label: "VIP Sentiment", color: "text-amber-400" },
  narrativeVelocity: { icon: Activity, label: "Narrative Velocity", color: "text-blue-400" },
  anomalyFlags: { icon: AlertTriangle, label: "Anomaly Flags", color: "text-rose-400" },
};

export function AlphaScoreBadge({ score, components, direction, size = "md", showBreakdown = false }: AlphaScoreProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = getScoreColor(score);
  const label = getScoreLabel(score);

  if (size === "sm") {
    return (
      <div className="flex items-center gap-1.5">
        <div className={`relative w-6 h-6 rounded-full flex items-center justify-center ring-2 ${colors.ring}`}>
          <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${colors.gradient} opacity-20`} />
          <span className={`text-[9px] font-bold ${colors.text} relative z-10`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {score}
          </span>
        </div>
      </div>
    );
  }

  if (size === "lg") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          {/* Score circle */}
          <div className={`relative w-14 h-14 rounded-full flex items-center justify-center ring-2 ${colors.ring}`}>
            <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${colors.gradient} opacity-15`} />
            <div className="text-center relative z-10">
              <span className={`text-lg font-black ${colors.text}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {score}
              </span>
            </div>
          </div>
          <div>
            <p className={`text-sm font-bold ${colors.text}`}>{label}</p>
            <p className="text-[10px] text-muted-foreground">
              Alpha Score
              {direction && (
                <span className={`ml-1 ${direction === "bullish" ? "text-emerald-400" : direction === "bearish" ? "text-rose-400" : "text-amber-400"}`}>
                  ({direction})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${colors.gradient} transition-all duration-700`}
            style={{ width: `${score}%` }}
          />
        </div>

        {/* Component breakdown */}
        {(showBreakdown || expanded) && components && (
          <div className="grid grid-cols-5 gap-1 mt-2">
            {(Object.entries(components) as [keyof typeof componentIcons, number][]).map(([key, value]) => {
              const config = componentIcons[key];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <div key={key} className="text-center p-1.5 rounded-lg bg-background/50 border border-border/20">
                  <Icon className={`w-3 h-3 mx-auto mb-0.5 ${config.color}`} />
                  <p className="text-[9px] font-bold text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {value}
                  </p>
                  <p className="text-[7px] text-muted-foreground leading-tight">{config.label.split(" ")[0]}</p>
                </div>
              );
            })}
          </div>
        )}

        {components && !showBreakdown && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? "Hide breakdown" : "Show breakdown"}
          </button>
        )}
      </div>
    );
  }

  // Default medium size
  return (
    <div
      className="flex items-center gap-2 cursor-pointer group"
      onClick={() => setExpanded(!expanded)}
    >
      <div className={`relative w-8 h-8 rounded-full flex items-center justify-center ring-2 ${colors.ring} group-hover:ring-offset-1 transition-all`}>
        <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${colors.gradient} opacity-15`} />
        <span className={`text-[10px] font-black ${colors.text} relative z-10`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {score}
        </span>
      </div>
      <div>
        <p className={`text-[10px] font-bold ${colors.text}`}>{label}</p>
        <p className="text-[8px] text-muted-foreground">Alpha Score</p>
      </div>
    </div>
  );
}

/**
 * AlphaScoreBar — Horizontal bar showing alpha score inline
 */
export function AlphaScoreBar({ score, width = 60 }: { score: number; width?: number }) {
  const colors = getScoreColor(score);
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[10px] font-bold ${colors.text}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {score}
      </span>
      <div className="h-1 rounded-full bg-muted/30 overflow-hidden" style={{ width }}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colors.gradient} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
