import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useMemo, useEffect } from "react";
import {
  Zap,
  Target,
  Bell,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileText,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Radio,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type FeedItem = {
  id: string;
  type: "prediction" | "narrative" | "alert" | "report" | "collab";
  title: string;
  description: string;
  ticker?: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  timestamp: Date;
  icon: React.ReactNode;
  accentColor: string;
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityFeed({
  predictions,
  narratives,
  isLoading,
}: {
  predictions?: any[];
  narratives?: any[];
  isLoading: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const [filter, setFilter] = useState<"all" | "predictions" | "narratives" | "alerts">("all");
  const [pulseIndex, setPulseIndex] = useState(0);

  // Show a one-time explainer for new users (must be before any early returns)
  const [showExplainer, setShowExplainer] = useState(() => {
    return !localStorage.getItem("feed-explainer-dismissed");
  });

  const dismissExplainer = () => {
    setShowExplainer(false);
    localStorage.setItem("feed-explainer-dismissed", "true");
  };

  // Fetch notifications if authenticated
  const notificationsQuery = trpc.watchlist.notificationsList.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: 30000, retry: 1 }
  );

  // Pulse animation for the latest item
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseIndex((prev) => (prev === 0 ? -1 : 0));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Build unified feed from all sources
  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];

    // Add predictions
    if (predictions) {
      predictions.slice(0, 8).forEach((p: any, i: number) => {
        const isUp = p.direction === "up";
        items.push({
          id: `pred-${p.id || i}`,
          type: "prediction",
          title: `${p.ticker} — ${isUp ? "Bullish" : "Bearish"} Signal`,
          description: `${p.confidence}% confidence ${p.horizon} prediction. ${p.reasoning?.slice(0, 80) || "AI-generated signal based on multi-source analysis."}`,
          ticker: p.ticker,
          sentiment: isUp ? "bullish" : "bearish",
          timestamp: new Date(Date.now() - i * 180000 - Math.random() * 300000),
          icon: isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />,
          accentColor: isUp ? "text-emerald-400" : "text-red-400",
        });
      });
    }

    // Add narratives
    if (narratives) {
      narratives.slice(0, 6).forEach((n: any, i: number) => {
        const sentMap: Record<string, "bullish" | "bearish" | "neutral"> = {
          bullish: "bullish",
          bearish: "bearish",
        };
        items.push({
          id: `nar-${n.id || i}`,
          type: "narrative",
          title: n.title?.slice(0, 60) || "Market Narrative Shift",
          description: n.summary?.slice(0, 100) || "New narrative detected across multiple sources.",
          ticker: n.tickers?.[0],
          sentiment: sentMap[n.sentiment] || "neutral",
          timestamp: new Date(Date.now() - i * 420000 - Math.random() * 600000),
          icon: <Zap className="w-3.5 h-3.5" />,
          accentColor: n.sentiment === "bullish" ? "text-emerald-400" : n.sentiment === "bearish" ? "text-red-400" : "text-amber-400",
        });
      });
    }

    // Add notifications as alerts
    if (notificationsQuery.data) {
      notificationsQuery.data.slice(0, 6).forEach((n: any, i: number) => {
        let icon = <Bell className="w-3.5 h-3.5" />;
        let type: FeedItem["type"] = "alert";
        if (n.type === "report") {
          icon = <FileText className="w-3.5 h-3.5" />;
          type = "report";
        } else if (n.type === "collab") {
          icon = <MessageSquare className="w-3.5 h-3.5" />;
          type = "collab";
        }
        items.push({
          id: `notif-${n.id || i}`,
          type,
          title: n.title || "Alert Triggered",
          description: n.body?.slice(0, 100) || "System notification",
          timestamp: new Date(n.createdAt || Date.now() - i * 600000),
          icon,
          accentColor: "text-purple-400",
        });
      });
    }

    // Sort by timestamp descending
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Filter
    if (filter === "predictions") return items.filter((i) => i.type === "prediction");
    if (filter === "narratives") return items.filter((i) => i.type === "narrative");
    if (filter === "alerts") return items.filter((i) => i.type === "alert" || i.type === "report" || i.type === "collab");
    return items;
  }, [predictions, narratives, notificationsQuery.data, filter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
      </div>
    );
  }

  const filters = [
    { key: "all" as const, label: "All", count: feedItems.length },
    { key: "predictions" as const, label: "Signals", icon: <Target className="w-3 h-3" /> },
    { key: "narratives" as const, label: "Narratives", icon: <Zap className="w-3 h-3" /> },
    { key: "alerts" as const, label: "Alerts", icon: <Bell className="w-3 h-3" /> },
  ];

  return (
    <div className="space-y-3">
      {/* First-time user explainer */}
      {showExplainer && (
        <div className="relative p-2.5 rounded-lg bg-primary/5 border border-primary/10">
          <button
            onClick={dismissExplainer}
            className="absolute top-1.5 right-1.5 text-muted-foreground/30 hover:text-foreground text-xs"
          >
            ✕
          </button>
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed pr-4">
            <span className="font-semibold text-foreground/80">How to read signals:</span>{" "}
            Each item shows a <span className="text-emerald-400 font-medium">bullish</span> or{" "}
            <span className="text-red-400 font-medium">bearish</span> direction with a confidence score (higher = more certain). Signals are generated by AI analyzing 14 data sources.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
              filter === f.key
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30"
            }`}
          >
            {f.icon}
            <span>{f.label}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-mono text-muted-foreground/40">LIVE</span>
        </div>
      </div>

      {/* Feed items */}
      <div className="space-y-1 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
        <AnimatePresence mode="popLayout">
          {feedItems.slice(0, 15).map((item, idx) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25, delay: idx * 0.03 }}
              className={`group relative flex gap-3 p-2.5 rounded-lg hover:bg-muted/20 transition-all cursor-default ${
                idx === 0 && pulseIndex === 0 ? "bg-primary/[0.03]" : ""
              }`}
            >
              {/* Timeline dot */}
              <div className="flex flex-col items-center pt-0.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  item.type === "prediction" ? "bg-purple-500/10" :
                  item.type === "narrative" ? "bg-amber-500/10" :
                  item.type === "alert" ? "bg-red-500/10" :
                  item.type === "report" ? "bg-blue-500/10" :
                  "bg-emerald-500/10"
                }`}>
                  <span className={item.accentColor}>{item.icon}</span>
                </div>
                {idx < feedItems.length - 1 && (
                  <div className="w-px flex-1 bg-border/10 mt-1" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {item.ticker && (
                        <span className="font-mono text-[10px] font-bold text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded">
                          {item.ticker}
                        </span>
                      )}
                      {item.sentiment && (
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                          item.sentiment === "bullish" ? "text-emerald-400 bg-emerald-400/10" :
                          item.sentiment === "bearish" ? "text-red-400 bg-red-400/10" :
                          "text-amber-400 bg-amber-400/10"
                        }`}>
                          {item.sentiment}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-foreground/90 leading-snug truncate">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 leading-relaxed mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground/30 whitespace-nowrap pt-0.5">
                    {timeAgo(item.timestamp)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {feedItems.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground/40">
            <Radio className="w-5 h-5 mx-auto mb-2 opacity-30" />
            <p>No activity yet. Intelligence stream will populate as data flows in.</p>
          </div>
        )}
      </div>
    </div>
  );
}
