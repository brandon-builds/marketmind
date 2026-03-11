import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Grid3X3, ArrowRight } from "lucide-react";
import { Link } from "wouter";

/**
 * Sector Heatmap Widget — Visual grid showing Alpha Score intensity across sectors.
 * Color-coded cells: green = high alpha, amber = medium, red = low.
 * Click a sector to drill down to individual tickers.
 */
export default function SectorHeatmapWidget() {
  const { data: sectors, isLoading } = trpc.intelligence.getSectorHeatmap.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50 backdrop-blur-sm h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-purple-400" />
            Sector Alpha Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sectors || sectors.length === 0) {
    return (
      <Card className="bg-card/50 border-border/50 backdrop-blur-sm h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-purple-400" />
            Sector Alpha Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Waiting for alpha data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50 backdrop-blur-sm h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-purple-400" />
            Sector Alpha Heatmap
          </CardTitle>
          <Link href="/alpha-leaderboard">
            <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
              Full Leaderboard <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {sectors.map((sector) => (
            <SectorCell key={sector.sector} sector={sector} />
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-emerald-500/60" /> High Alpha
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-amber-500/60" /> Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-500/60" /> Low
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SectorCell({ sector }: { sector: any }) {
  const score = sector.avgAlphaScore;
  
  // Color based on alpha score
  const getBgColor = (s: number) => {
    if (s >= 70) return "from-emerald-500/30 to-emerald-600/20 border-emerald-500/40";
    if (s >= 55) return "from-blue-500/25 to-blue-600/15 border-blue-500/35";
    if (s >= 45) return "from-amber-500/25 to-amber-600/15 border-amber-500/35";
    if (s >= 30) return "from-orange-500/25 to-orange-600/15 border-orange-500/35";
    return "from-red-500/25 to-red-600/15 border-red-500/35";
  };

  const getScoreColor = (s: number) => {
    if (s >= 70) return "text-emerald-400";
    if (s >= 55) return "text-blue-400";
    if (s >= 45) return "text-amber-400";
    if (s >= 30) return "text-orange-400";
    return "text-red-400";
  };

  const TrendIcon = sector.trend === "up" ? TrendingUp : sector.trend === "down" ? TrendingDown : Minus;
  const trendColor = sector.trend === "up" ? "text-emerald-400" : sector.trend === "down" ? "text-red-400" : "text-muted-foreground";

  return (
    <Link href={`/alpha-leaderboard?sector=${encodeURIComponent(sector.sector)}`}>
      <div
        className={`relative rounded-lg border bg-gradient-to-br ${getBgColor(score)} p-2.5 cursor-pointer hover:scale-[1.03] transition-all duration-200 group overflow-hidden`}
      >
        {/* Glow effect for high alpha */}
        {score >= 70 && (
          <div className="absolute inset-0 bg-emerald-400/5 animate-pulse rounded-lg" />
        )}
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-foreground/80 truncate max-w-[80px]">
              {sector.sector}
            </span>
            <TrendIcon className={`h-3 w-3 ${trendColor}`} />
          </div>
          
          <div className={`text-lg font-bold ${getScoreColor(score)} leading-tight`}>
            {score.toFixed(0)}
          </div>
          
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[9px] text-muted-foreground">
              {sector.tickerCount} tickers
            </span>
            {score >= 75 && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-emerald-500/50 text-emerald-400">
                HOT
              </Badge>
            )}
          </div>
          
          <div className="text-[9px] text-muted-foreground mt-0.5 truncate">
            Top: {sector.topTicker} ({sector.topScore})
          </div>
        </div>
      </div>
    </Link>
  );
}
