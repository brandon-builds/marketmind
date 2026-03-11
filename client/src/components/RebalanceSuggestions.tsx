import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Scale, TrendingUp, TrendingDown, AlertTriangle, ArrowRight,
  X, Eye, BookOpen, Zap, ShieldAlert,
} from "lucide-react";
import { useLocation } from "wouter";

const PRIORITY_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  critical: { color: "text-red-400 border-red-400/30 bg-red-400/10", icon: ShieldAlert, label: "CRITICAL" },
  high: { color: "text-amber-400 border-amber-400/30 bg-amber-400/10", icon: AlertTriangle, label: "HIGH" },
  medium: { color: "text-blue-400 border-blue-400/30 bg-blue-400/10", icon: Zap, label: "MEDIUM" },
  low: { color: "text-muted-foreground border-border bg-muted/30", icon: Eye, label: "LOW" },
};

const ACTION_CONFIG: Record<string, { color: string; icon: any }> = {
  reduce: { color: "text-red-400", icon: TrendingDown },
  increase: { color: "text-emerald-400", icon: TrendingUp },
  buy: { color: "text-emerald-400", icon: TrendingUp },
  sell: { color: "text-red-400", icon: TrendingDown },
  watch: { color: "text-blue-400", icon: Eye },
  hedge: { color: "text-amber-400", icon: Scale },
};

export default function RebalanceSuggestions() {
  const [, navigate] = useLocation();
  const { data: suggestions, isLoading } = trpc.intelligence.getRebalanceSuggestions.useQuery(
    undefined,
    { refetchInterval: 60_000 }
  );
  const dismissMutation = trpc.intelligence.dismissSuggestion.useMutation();
  const utils = trpc.useUtils();

  const handleDismiss = (id: string) => {
    dismissMutation.mutate({ id }, {
      onSuccess: () => utils.intelligence.getRebalanceSuggestions.invalidate(),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-blue-400" />
            Rebalancing Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const items = suggestions || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4 text-blue-400" />
          Rebalancing Suggestions
          {items.length > 0 && (
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Scale className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No rebalancing suggestions right now. Portfolio looks balanced.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((s: any) => {
              const priority = PRIORITY_CONFIG[s.priority] || PRIORITY_CONFIG.low;
              const action = ACTION_CONFIG[s.suggestedAction] || ACTION_CONFIG.watch;
              const PriorityIcon = priority.icon;
              const ActionIcon = action.icon;

              return (
                <div
                  key={s.id}
                  className={`p-3 rounded-lg border ${priority.color} transition-all hover:bg-muted/10`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <PriorityIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="font-bold text-sm">{s.ticker}</span>
                        <Badge variant="outline" className={`text-[10px] ${priority.color}`}>
                          {priority.label}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${action.color}`}>
                          <ActionIcon className="h-2.5 w-2.5 mr-0.5" />
                          {s.suggestedAction.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground/80 mb-2">{s.reason}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Alpha: {s.currentAlphaScore} → {s.targetAlphaScore || "N/A"}</span>
                        {s.alphaChange !== 0 && (
                          <span className={s.alphaChange > 0 ? "text-emerald-400" : "text-red-400"}>
                            ({s.alphaChange > 0 ? "+" : ""}{s.alphaChange} in 24h)
                          </span>
                        )}
                        {s.trigger && (
                          <span className="text-muted-foreground">
                            Trigger: {s.trigger}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/predictions?ticker=${s.ticker}`);
                        }}
                      >
                        <ArrowRight className="h-3 w-3" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/trade-journal`);
                        }}
                      >
                        <BookOpen className="h-3 w-3" />
                        Log
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismiss(s.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
