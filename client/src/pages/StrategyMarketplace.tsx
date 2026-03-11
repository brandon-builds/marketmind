import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Store, Star, TrendingUp, Users, Copy, Award, Search,
  BarChart3, Filter, ArrowUpDown, Sparkles, CheckCircle,
  ChevronRight, Shield, Zap, Target, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

type SortBy = "performance" | "popular" | "newest" | "rating";

export default function StrategyMarketplace() {
  const [sortBy, setSortBy] = useState<SortBy>("performance");
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: strategies, isLoading } = trpc.intelligence.getMarketplaceStrategies.useQuery(
    { sortBy, tag: selectedTag },
    { refetchInterval: 60000 }
  );
  const { data: featured } = trpc.intelligence.getFeaturedStrategies.useQuery(
    undefined,
    { refetchInterval: 300000 }
  );
  const { data: tags } = trpc.intelligence.getMarketplaceTags.useQuery();
  const { data: stats } = trpc.intelligence.getMarketplaceStats.useQuery();

  const cloneMutation = trpc.intelligence.cloneStrategy.useMutation({
    onSuccess: () => {
      toast.success("Strategy cloned! Check your Strategy Builder.");
    },
    onError: () => {
      toast.error("Failed to clone strategy");
    },
  });

  const filteredStrategies = useMemo(() => {
    if (!strategies) return [];
    if (!searchTerm) return strategies;
    const lower = searchTerm.toLowerCase();
    return strategies.filter(
      (s: any) =>
        s.name.toLowerCase().includes(lower) ||
        s.description?.toLowerCase().includes(lower) ||
        s.creator?.toLowerCase().includes(lower)
    );
  }, [strategies, searchTerm]);

  const handleClone = async (id: string) => {
    try {
      await cloneMutation.mutateAsync({ marketplaceId: id });
    } catch {
      // handled by onError
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />

      <div className="container max-w-7xl py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Store className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Strategy Marketplace</h1>
              <p className="text-muted-foreground text-sm">
                Discover, clone, and share community trading strategies
              </p>
            </div>
          </div>

          {/* Stats Bar */}
          {stats && (
            <div className="flex gap-6 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                <span><strong className="text-foreground">{stats.totalStrategies}</strong> strategies</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span><strong className="text-foreground">{stats.totalClones}</strong> clones</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Avg win rate: <strong className="text-emerald-400">{stats.avgWinRate?.toFixed(1)}%</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Award className="h-4 w-4" />
                <span>Top: <strong className="text-amber-400">{stats.topPerformer}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Featured Strategies */}
        {featured && featured.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-amber-400" />
              Featured Strategies
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {featured.slice(0, 4).map((strat: any) => (
                <Card
                  key={strat.id}
                  className="bg-gradient-to-br from-amber-500/5 to-violet-500/5 border-amber-500/20 hover:border-amber-500/40 transition-colors"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] mb-2">
                          <Sparkles className="h-3 w-3 mr-1" />
                          FEATURED
                        </Badge>
                        <CardTitle className="text-base">{strat.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1 text-amber-400">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        <span className="text-sm font-medium">{strat.rating?.toFixed(1) || "N/A"}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {strat.description || "No description provided"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mb-3 font-mono line-clamp-1">
                      {strat.rulesPreview}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      <div className="bg-muted/20 rounded p-1.5 text-center">
                        <span className="text-emerald-400 font-bold">
                          +{strat.backtestStats?.totalReturn?.toFixed(1) ?? 0}%
                        </span>
                        <p className="text-[10px] text-muted-foreground">Return</p>
                      </div>
                      <div className="bg-muted/20 rounded p-1.5 text-center">
                        <span className="text-blue-400 font-bold">
                          {strat.backtestStats?.winRate?.toFixed(0) ?? 0}%
                        </span>
                        <p className="text-[10px] text-muted-foreground">Win Rate</p>
                      </div>
                      <div className="bg-muted/20 rounded p-1.5 text-center">
                        <span className="text-purple-400 font-bold">
                          {strat.backtestStats?.sharpeRatio?.toFixed(2) ?? 0}
                        </span>
                        <p className="text-[10px] text-muted-foreground">Sharpe</p>
                      </div>
                      <div className="bg-muted/20 rounded p-1.5 text-center">
                        <span className="text-red-400 font-bold">
                          {strat.backtestStats?.maxDrawdown?.toFixed(1) ?? 0}%
                        </span>
                        <p className="text-[10px] text-muted-foreground">Max DD</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {strat.cloneCount} clones
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleClone(strat.id)}
                        disabled={cloneMutation.isPending}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Clone
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search strategies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-muted/30"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
              {(["performance", "popular", "newest", "rating"] as SortBy[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    sortBy === s
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "performance" ? "Top Performing" : s === "popular" ? "Most Cloned" : s === "newest" ? "Newest" : "Highest Rated"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedTag(undefined)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                !selectedTag
                  ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {tags.map((t: { tag: string; count: number }) => (
              <button
                key={t.tag}
                onClick={() => setSelectedTag(t.tag === selectedTag ? undefined : t.tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedTag === t.tag
                    ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                    : "bg-muted/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.tag} ({t.count})
              </button>
            ))}
          </div>
        )}

        {/* Strategy List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-muted/20 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredStrategies.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Store className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No strategies found</p>
            <p className="text-sm">Try adjusting your filters or search term</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStrategies.map((strat: any, idx: number) => (
              <Card
                key={strat.id}
                className="bg-card/50 backdrop-blur border-border/50 hover:border-border transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
                        <h3 className="font-semibold text-sm">{strat.name}</h3>
                        {strat.isFeatured && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                            <Sparkles className="h-3 w-3 mr-0.5" />
                            Featured
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                        {strat.description || "No description"}
                      </p>

                      {/* Rules Preview */}
                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/30 text-[10px] text-muted-foreground font-mono">
                          <Target className="h-3 w-3" />
                          {strat.rulesPreview}
                        </span>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {strat.tags?.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 text-xs flex-wrap">
                        <span className="text-muted-foreground">
                          by <strong className="text-foreground">{strat.creator || "Anonymous"}</strong>
                        </span>
                        <span className={`font-medium ${(strat.backtestStats?.totalReturn || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {(strat.backtestStats?.totalReturn || 0) >= 0 ? "+" : ""}{strat.backtestStats?.totalReturn?.toFixed(1) || 0}% return
                        </span>
                        <span className="text-muted-foreground">
                          {strat.backtestStats?.winRate?.toFixed(0) || 0}% win rate
                        </span>
                        <span className="text-muted-foreground">
                          Sharpe: {strat.backtestStats?.sharpeRatio?.toFixed(2) || "N/A"}
                        </span>
                        <span className="text-red-400/70">
                          DD: {strat.backtestStats?.maxDrawdown?.toFixed(1) || 0}%
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {strat.cloneCount || 0} clones
                        </span>
                        <span className="text-muted-foreground">
                          {strat.backtestStats?.totalTrades || 0} trades
                        </span>
                        <span className="text-amber-400 flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          {strat.rating?.toFixed(1) || "N/A"} ({strat.ratingCount || 0})
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleClone(strat.id)}
                        disabled={cloneMutation.isPending}
                        className="h-8 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Clone Strategy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => window.location.href = `/strategy-builder`}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Strategy Builder
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
