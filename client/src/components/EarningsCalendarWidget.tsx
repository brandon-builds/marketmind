import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, AlertTriangle, Clock } from "lucide-react";

export function EarningsCalendarWidget() {
  const { data: earnings, isLoading } = trpc.intelligence.getUpcomingEarnings.useQuery(
    { days: 7 },
    { refetchInterval: 300000 }
  );
  const { data: badges } = trpc.intelligence.getEarningsBadges.useQuery(
    undefined,
    { refetchInterval: 300000 }
  );

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-orange-400" />
            Upcoming Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const items = earnings || [];
  const earningsBadges = badges || [];

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4 text-orange-400" />
          Upcoming Earnings
          {items.length > 0 && (
            <Badge variant="outline" className="ml-auto text-xs font-normal">
              {items.length} this week
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No upcoming earnings this week
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 8).map((item, idx) => {
              const badge = earningsBadges.find(b => b.ticker === item.ticker);
              const daysUntil = item.daysUntil;
              const isImminent = daysUntil <= 2;
              const isToday = daysUntil === 0;

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                    isToday
                      ? "bg-orange-500/10 border border-orange-500/30"
                      : isImminent
                      ? "bg-amber-500/5 border border-amber-500/20"
                      : "bg-muted/20 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col items-center w-10">
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {new Date(item.earningsDate).toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span className={`text-sm font-bold ${isToday ? "text-orange-400" : ""}`}>
                        {new Date(item.earningsDate).getDate()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{item.ticker}</span>
                        {item.timeOfDay && (
                          <span className="text-[10px] text-muted-foreground">
                            {item.timeOfDay === "before_open" ? "Pre-market" : "After-hours"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.companyName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isToday && (
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-1.5">
                        <AlertTriangle className="h-3 w-3 mr-0.5" />
                        TODAY
                      </Badge>
                    )}
                    {!isToday && isImminent && (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px] px-1.5">
                        <Clock className="h-3 w-3 mr-0.5" />
                        {daysUntil}d
                      </Badge>
                    )}
                    {badge && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 ${
                          badge.riskLevel === "extreme" || badge.riskLevel === "high"
                            ? "text-red-400 border-red-500/30"
                            : "text-amber-400 border-amber-500/30"
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3 mr-0.5" />
                        {badge.label}
                      </Badge>
                    )}
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
