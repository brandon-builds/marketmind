import { usePageTracking } from "@/hooks/usePageTracking";
import { Link } from "wouter";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  Eye,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  Target,
  Loader2,
  Star,
  LogIn,
  Users,
  Zap,
} from "lucide-react";
import { Sparkline, generateHistoricalPrices } from "@/components/Sparkline";

const AVAILABLE_TICKERS = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA",
  "SPY", "QQQ", "XLK", "XLE", "XLF", "XLI", "XLB",
  "GLD", "TLT", "USO", "BRK-B",
];

export default function WatchlistPage() {
  usePageTracking("watchlist");
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [addingTicker, setAddingTicker] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState("");

  const utils = trpc.useUtils();

  // Watchlist data
  const { data: watchlistData, isLoading: watchlistLoading } =
    trpc.watchlist.list.useQuery(undefined, { enabled: isAuthenticated });

  // Add/remove mutations
  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: () => {
      utils.watchlist.list.invalidate();
      setAddingTicker(false);
      setSelectedTicker("");
    },
  });

  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => {
      utils.watchlist.list.invalidate();
    },
  });

  // Get tickers from watchlist
  const watchedTickers = useMemo(
    () => (watchlistData ?? []).map((w) => w.ticker),
    [watchlistData]
  );

  // Fetch quotes for sparkline price data
  const { data: quotesData } = trpc.market.quotes.useQuery(undefined, {
    enabled: watchedTickers.length > 0,
  });

  // Build price map for sparklines
  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (quotesData) {
      (quotesData as any[]).forEach((q: any) => {
        map[q.symbol] = q.price;
      });
    }
    return map;
  }, [quotesData]);

  // Fetch predictions and narratives for watched tickers
  const { data: predictionsData } = trpc.market.predictions.useQuery(
    undefined,
    { enabled: watchedTickers.length > 0 }
  );

  const { data: narrativesData } = trpc.market.narrativesFiltered.useQuery(
    { sentiment: "all", sector: "all" },
    { enabled: watchedTickers.length > 0 }
  );

  // Fetch alpha scores for watched tickers
  const { data: alphaScores } = trpc.intelligence.getAlphaScores.useQuery(
    undefined,
    { enabled: watchedTickers.length > 0, refetchInterval: 120000 }
  );

  const alphaMap = useMemo(() => {
    const map = new Map<string, any>();
    if (alphaScores) {
      for (const a of alphaScores) {
        map.set(a.ticker, a);
      }
    }
    return map;
  }, [alphaScores]);

  // Filter predictions and narratives for watched tickers
  const filteredPredictions = useMemo(() => {
    if (!predictionsData || watchedTickers.length === 0) return [];
    return predictionsData.filter((p: any) =>
      watchedTickers.includes(p.ticker)
    );
  }, [predictionsData, watchedTickers]);

  const filteredNarratives = useMemo(() => {
    if (!narrativesData || watchedTickers.length === 0) return [];
    return narrativesData.filter((n: any) =>
      n.relatedTickers?.some((t: string) => watchedTickers.includes(t))
    );
  }, [narrativesData, watchedTickers]);

  // Available tickers to add (not already in watchlist)
  const availableToAdd = useMemo(
    () => AVAILABLE_TICKERS.filter((t) => !watchedTickers.includes(t)),
    [watchedTickers]
  );

  const isLoading = authLoading || watchlistLoading;

  // Not authenticated state
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader title="Watchlist" subtitle="PERSONALIZED FEED" />
        <div className="container py-16">
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-6">
              <Eye className="w-10 h-10 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Sign in to use Watchlist</h2>
            <p className="text-muted-foreground mb-6">
              Save your favorite tickers and get a personalized feed of predictions and narratives.
            </p>
            <a
              href={getLoginUrl()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold hover:opacity-90 transition-opacity"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader title="Watchlist" subtitle="PERSONALIZED FEED" />

      <div className="container py-8">
        {/* Collab Watchlists Banner */}
        <Link
          href="/collab"
          className="mb-6 flex items-center gap-3 rounded-xl p-3 border border-primary/15 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium">Collaborative Watchlists</span>
            <span className="text-xs text-muted-foreground ml-2">Share & annotate tickers with your team</span>
          </div>
          <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">Open &rarr;</span>
        </Link>

        {/* Watched Tickers Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-semibold">Your Tickers</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {watchedTickers.length} watching
              </span>
            </div>
            {!addingTicker && (
              <button
                onClick={() => setAddingTicker(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-purple-500/50 hover:text-purple-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Ticker
              </button>
            )}
          </div>

          {/* Add ticker dropdown */}
          {addingTicker && (
            <div className="mb-4 p-4 rounded-xl border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium">Select a ticker to watch:</span>
                <button
                  onClick={() => { setAddingTicker(false); setSelectedTicker(""); }}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableToAdd.map((ticker) => (
                  <button
                    key={ticker}
                    onClick={() => addMutation.mutate({ ticker })}
                    disabled={addMutation.isPending}
                    className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors ${
                      selectedTicker === ticker
                        ? "border-purple-500 bg-purple-500/20 text-purple-300"
                        : "border-border hover:border-purple-500/50 hover:bg-purple-500/10"
                    }`}
                  >
                    {ticker}
                  </button>
                ))}
                {availableToAdd.length === 0 && (
                  <p className="text-sm text-muted-foreground">All available tickers are in your watchlist.</p>
                )}
              </div>
            </div>
          )}

          {/* Ticker chips */}
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading watchlist...</span>
            </div>
          ) : watchedTickers.length === 0 ? (
            <>
              <div className="text-center py-10 rounded-xl border border-dashed border-muted-foreground/20 mb-8">
                <Eye className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground mb-1">Your watchlist is empty</p>
                <p className="text-sm text-muted-foreground/60 mb-4">
                  Add tickers to get a personalized feed of predictions and narratives.
                </p>
                <button
                  onClick={() => setAddingTicker(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Ticker
                </button>
              </div>

              {/* Suggested Tickers */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Popular Tickers to Watch</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {["AAPL", "NVDA", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "SPY", "QQQ", "XLK", "GLD", "TLT"].map(ticker => (
                    <button
                      key={ticker}
                      onClick={() => addMutation.mutate({ ticker })}
                      disabled={addMutation.isPending}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/40 bg-card/50 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all group"
                    >
                      <span className="font-mono text-sm font-semibold">{ticker}</span>
                      <Plus className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-purple-400 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl border border-border/30 bg-card/30">
                  <Target className="w-6 h-6 text-cyan-400 mb-3" />
                  <h3 className="font-semibold text-sm mb-1">Personalized Predictions</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Get AI predictions filtered to only the tickers you care about, with confidence scores and horizon analysis.</p>
                </div>
                <div className="p-5 rounded-xl border border-border/30 bg-card/30">
                  <BookOpen className="w-6 h-6 text-purple-400 mb-3" />
                  <h3 className="font-semibold text-sm mb-1">Narrative Feed</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">See market narratives relevant to your watchlist — Fed policy, earnings, sector rotations, and more.</p>
                </div>
                <div className="p-5 rounded-xl border border-border/30 bg-card/30">
                  <TrendingUp className="w-6 h-6 text-emerald-400 mb-3" />
                  <h3 className="font-semibold text-sm mb-1">Real-Time Signals</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Track price movements and sentiment shifts across your watched tickers in one unified view.</p>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {watchedTickers.map((ticker) => {
                const price = priceMap[ticker] || 0;
                const history7d = price ? generateHistoricalPrices(ticker, price, 7) : [];
                const history30d = price ? generateHistoricalPrices(ticker, price, 30) : [];
                const change7d = history7d.length >= 2 ? ((history7d[history7d.length - 1] - history7d[0]) / history7d[0]) * 100 : 0;
                const isPositive = change7d >= 0;

                return (
                  <div
                    key={ticker}
                    className="group relative rounded-xl border border-border/50 bg-card hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/[0.04] transition-all duration-300 overflow-hidden"
                  >
                    {/* Accent top line */}
                    <div className={`h-[2px] ${isPositive ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-red-400'} opacity-30 group-hover:opacity-60 transition-opacity`} />

                    <div className="p-3.5">
                      <div className="flex items-start justify-between mb-2.5">
                        <div>
                          <Link
                            href={`/ticker/${ticker}`}
                            className="font-mono font-bold text-sm hover:text-purple-400 transition-colors"
                          >
                            {ticker}
                          </Link>
                          {price > 0 && (
                            <div className={`text-[10px] font-mono mt-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                              {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{change7d.toFixed(1)}% (7d)
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeMutation.mutate({ ticker })}
                          disabled={removeMutation.isPending}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-0.5 -mt-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {price > 0 ? (
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xl font-bold font-mono">${price.toFixed(2)}</div>
                            {alphaMap.get(ticker) && (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/20">
                                <Zap className="w-3 h-3 text-violet-400" />
                                <span className="text-[10px] font-bold font-mono" style={{
                                  color: (alphaMap.get(ticker)?.score ?? 0) >= 70 ? '#34d399' :
                                         (alphaMap.get(ticker)?.score ?? 0) >= 40 ? '#60a5fa' : '#a1a1aa'
                                }}>
                                  \u03b1{alphaMap.get(ticker)?.score}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Sparkline data={history7d} width={80} height={28} label="7d" />
                            <Sparkline data={history30d} width={80} height={28} label="30d" />
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 py-3">
                          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/40" />
                          <span className="text-xs text-muted-foreground/60">Loading price...</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Two-column layout: Predictions + Narratives */}
        {watchedTickers.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Predictions Column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-semibold">Predictions</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {filteredPredictions.length}
                </span>
              </div>

              {filteredPredictions.length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-dashed border-muted-foreground/20">
                  <Target className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No predictions for your watched tickers yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPredictions.slice(0, 12).map((pred: any, i: number) => (
                    <Link
                      key={pred.id || i}
                      href={`/ticker/${pred.ticker}`}
                      className="block p-4 rounded-xl border border-border bg-card hover:border-cyan-500/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {pred.direction === "up" ? (
                            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                          ) : pred.direction === "down" ? (
                            <ArrowDownRight className="w-4 h-4 text-red-400" />
                          ) : (
                            <Minus className="w-4 h-4 text-yellow-400" />
                          )}
                          <span className="font-mono font-bold text-sm">{pred.ticker}</span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              pred.direction === "up"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : pred.direction === "down"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                            {pred.direction === "up" ? "Bullish" : pred.direction === "down" ? "Bearish" : "Neutral"}
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {pred.horizon}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                          {pred.confidence}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Target: <span className="text-foreground font-mono">${pred.priceTarget?.toFixed(2)}</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            pred.status === "active"
                              ? "bg-cyan-500/20 text-cyan-400"
                              : pred.status === "hit"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {pred.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Narratives Column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold">Narratives</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {filteredNarratives.length}
                </span>
              </div>

              {filteredNarratives.length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-dashed border-muted-foreground/20">
                  <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No narratives mentioning your watched tickers yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNarratives.slice(0, 8).map((narrative: any, i: number) => (
                    <div
                      key={narrative.id || i}
                      className="p-4 rounded-xl border border-border bg-card hover:border-purple-500/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-sm font-semibold leading-tight line-clamp-2">
                          {narrative.title}
                        </h3>
                        <span
                          className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${
                            narrative.sentiment === "bullish"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : narrative.sentiment === "bearish"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {narrative.sentiment === "bullish" ? "Bullish" : narrative.sentiment === "bearish" ? "Bearish" : "Neutral"}{" "}
                          {narrative.confidence}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                        {narrative.summary}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {narrative.relatedTickers
                          ?.filter((t: string) => watchedTickers.includes(t))
                          .map((t: string) => (
                            <Link
                              key={t}
                              href={`/ticker/${t}`}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
                            >
                              {t}
                            </Link>
                          ))}
                        {narrative.relatedTickers
                          ?.filter((t: string) => !watchedTickers.includes(t))
                          .slice(0, 3)
                          .map((t: string) => (
                            <Link
                              key={t}
                              href={`/ticker/${t}`}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {t}
                            </Link>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
