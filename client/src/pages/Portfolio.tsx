import { usePageTracking } from "@/hooks/usePageTracking";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Plus, Trash2, TrendingUp, TrendingDown, Minus, Shield, AlertTriangle, AlertCircle, Info, PieChart, ArrowUpRight, ArrowDownRight, X, Target, Download, Loader2, Cloud, CloudOff } from "lucide-react";
import { exportReport, buildPortfolioReport } from "@/lib/exportReport";
import RebalanceSuggestions from "@/components/RebalanceSuggestions";
import { exportToCsv } from "@/lib/exportCsv";
import { exportPortfolioBrokerage, BROKERAGE_FORMATS, type BrokerageFormat } from "@/lib/brokerageExport";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ShareButton } from "@/components/ShareButton";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useCallback, useMemo, useEffect } from "react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

interface Holding {
  ticker: string;
  shares: number;
}

const POPULAR_TICKERS = ["SPY", "QQQ", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "XLK", "XLE", "XLF", "GLD", "TLT"];

const STORAGE_KEY = "marketmind-portfolio";

const DEFAULT_HOLDINGS: Holding[] = [
  { ticker: "AAPL", shares: 50 },
  { ticker: "NVDA", shares: 30 },
  { ticker: "SPY", shares: 100 },
  { ticker: "MSFT", shares: 25 },
];

export default function Portfolio() {
  usePageTracking("portfolio");
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  // Database holdings for logged-in users
  const { data: dbHoldings, isLoading: dbLoading } = trpc.watchlist.portfolioList.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const upsertMutation = trpc.watchlist.portfolioUpsert.useMutation({
    onSuccess: () => utils.watchlist.portfolioList.invalidate(),
  });
  const removeMutation = trpc.watchlist.portfolioRemove.useMutation({
    onSuccess: () => utils.watchlist.portfolioList.invalidate(),
  });

  // Local state for unauthenticated users
  const [localHoldings, setLocalHoldings] = useState<Holding[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_HOLDINGS;
  });

  // Persist local holdings to localStorage
  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localHoldings));
    }
  }, [localHoldings, isAuthenticated]);

  // Auto-migrate localStorage holdings to DB when user first logs in
  const [migrated, setMigrated] = useState(false);
  useEffect(() => {
    if (isAuthenticated && !dbLoading && dbHoldings && dbHoldings.length === 0 && !migrated) {
      setMigrated(true); // Prevent re-runs immediately
      // DB is empty — try migrating from localStorage first
      let holdingsToSeed = DEFAULT_HOLDINGS;
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed: Holding[] = JSON.parse(saved);
          if (parsed.length > 0) holdingsToSeed = parsed;
        } catch {}
      }
      // Deduplicate by ticker (keep last occurrence)
      const deduped = Object.values(
        holdingsToSeed.reduce((acc, h) => ({ ...acc, [h.ticker]: h }), {} as Record<string, Holding>)
      );
      deduped.forEach(h => {
        upsertMutation.mutate({ ticker: h.ticker, shares: Math.round(h.shares) });
      });
    }
  }, [isAuthenticated, dbLoading, dbHoldings, migrated, upsertMutation]);

  // Unified holdings view
  const holdings: Holding[] = useMemo(() => {
    if (isAuthenticated && dbHoldings) {
      return dbHoldings.map(h => ({ ticker: h.ticker, shares: h.shares }));
    }
    return localHoldings;
  }, [isAuthenticated, dbHoldings, localHoldings]);

  const [newTicker, setNewTicker] = useState("");
  const [newShares, setNewShares] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const holdingsInput = useMemo(() => holdings.map(h => ({ ticker: h.ticker, shares: h.shares })), [holdings]);

  const { data, isLoading } = trpc.market.portfolioAnalysis.useQuery(
    { holdings: holdingsInput },
    { refetchInterval: 60000, retry: 2, enabled: holdings.length > 0 }
  );

  const addHolding = useCallback(() => {
    const ticker = newTicker.trim().toUpperCase();
    const shares = parseFloat(newShares);
    if (!ticker || isNaN(shares) || shares <= 0) return;

    if (isAuthenticated) {
      // For existing holding, add shares to current amount
      const existing = holdings.find(h => h.ticker === ticker);
      const totalShares = existing ? existing.shares + shares : shares;
      upsertMutation.mutate({ ticker, shares: Math.round(totalShares) });
    } else {
      if (localHoldings.find(h => h.ticker === ticker)) {
        setLocalHoldings(prev => prev.map(h => h.ticker === ticker ? { ...h, shares: h.shares + shares } : h));
      } else {
        setLocalHoldings(prev => [...prev, { ticker, shares }]);
      }
    }
    setNewTicker("");
    setNewShares("");
    setShowAddForm(false);
  }, [newTicker, newShares, holdings, isAuthenticated, localHoldings, upsertMutation]);

  const removeHolding = useCallback((ticker: string) => {
    if (isAuthenticated) {
      removeMutation.mutate({ ticker });
    } else {
      setLocalHoldings(prev => prev.filter(h => h.ticker !== ticker));
    }
  }, [isAuthenticated, removeMutation]);

  const addQuickTicker = useCallback((ticker: string) => {
    if (holdings.find(h => h.ticker === ticker)) return;
    if (isAuthenticated) {
      upsertMutation.mutate({ ticker, shares: 10 });
    } else {
      setLocalHoldings(prev => [...prev, { ticker, shares: 10 }]);
    }
  }, [holdings, isAuthenticated, upsertMutation]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader title="Portfolio" subtitle="AI-Powered Analysis" showBack />

      {/* Sync Status + Export Button */}
      {data && holdings.length > 0 && (
        <div className="max-w-[1400px] mx-auto px-4 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isAuthenticated ? (
              <><Cloud className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Synced to cloud</span></>
            ) : (
              <><CloudOff className="w-3.5 h-3.5" /><span>Local only — sign in to sync</span></>
            )}
          </div>
          <button
            onClick={() => exportReport(buildPortfolioReport(data))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <BrokerageExportMenu holdings={data?.holdings} />
          <ShareButton
            reportType="portfolio"
            title={`Portfolio Snapshot — ${new Date().toLocaleDateString()}`}
            getData={() => JSON.stringify(data)}
          />
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {/* Portfolio Summary */}
        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <motion.div variants={fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Value</p>
            <p className="text-xl font-mono font-bold text-foreground">
              {isLoading ? <span className="inline-block w-20 h-6 bg-muted/20 rounded animate-pulse" /> : `$${(data?.totalValue || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            </p>
          </motion.div>
          <motion.div variants={fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Day Change</p>
            <p className={`text-xl font-mono font-bold ${(data?.totalChange || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {isLoading ? <span className="inline-block w-20 h-6 bg-muted/20 rounded animate-pulse" /> : `${(data?.totalChange || 0) >= 0 ? "+" : ""}$${(data?.totalChange || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} (${(data?.totalChangePercent || 0) >= 0 ? "+" : ""}${data?.totalChangePercent || 0}%)`}
            </p>
          </motion.div>
          <motion.div variants={fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Sentiment</p>
            <p className={`text-xl font-mono font-bold ${data?.narrativeSentiment.label === "Bullish" ? "text-emerald-400" : data?.narrativeSentiment.label === "Bearish" ? "text-rose-400" : "text-amber-400"}`}>
              {isLoading ? <span className="inline-block w-20 h-6 bg-muted/20 rounded animate-pulse" /> : data?.narrativeSentiment.label || "—"}
            </p>
          </motion.div>
          <motion.div variants={fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Holdings</p>
            <p className="text-xl font-mono font-bold text-foreground">{holdings.length}</p>
          </motion.div>
        </motion.div>

        {/* Rebalancing Suggestions */}
        <RebalanceSuggestions />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column: Holdings */}
          <div className="lg:col-span-2 space-y-4">
            {/* Holdings Table */}
            <motion.div {...fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  <h2 className="font-display font-semibold text-sm">Holdings</h2>
                </div>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-all border border-primary/20"
                >
                  {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showAddForm ? "Cancel" : "Add Holding"}
                </button>
              </div>

              <AnimatePresence>
                {showAddForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mb-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={newTicker}
                          onChange={e => setNewTicker(e.target.value.toUpperCase())}
                          placeholder="Ticker (e.g. AAPL)"
                          className="flex-1 px-3 py-2 rounded-lg bg-background border border-border/40 text-xs font-mono focus:outline-none focus:border-primary/50"
                          onKeyDown={e => e.key === "Enter" && addHolding()}
                        />
                        <input
                          type="number"
                          value={newShares}
                          onChange={e => setNewShares(e.target.value)}
                          placeholder="Shares"
                          className="w-24 px-3 py-2 rounded-lg bg-background border border-border/40 text-xs font-mono focus:outline-none focus:border-primary/50"
                          onKeyDown={e => e.key === "Enter" && addHolding()}
                        />
                        <button
                          onClick={addHolding}
                          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] text-muted-foreground mr-1">Quick add:</span>
                        {POPULAR_TICKERS.filter(t => !holdings.find(h => h.ticker === t)).slice(0, 8).map(t => (
                          <button
                            key={t}
                            onClick={() => addQuickTicker(t)}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted/20 hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20"
                          >
                            +{t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {holdings.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No holdings yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Add tickers to see AI-powered portfolio analysis</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Ticker</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-medium">Shares</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-medium">Price</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-medium">Value</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-medium">Day Chg</th>
                        <th className="text-center py-2 px-2 text-muted-foreground font-medium">Prediction</th>
                        <th className="text-center py-2 px-2 text-muted-foreground font-medium">Sentiment</th>
                        <th className="text-center py-2 px-2 text-muted-foreground font-medium w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.holdings.map(h => (
                        <tr key={h.ticker} className="border-b border-border/10 hover:bg-muted/5 transition-colors">
                          <td className="py-2.5 px-2">
                            <button onClick={() => navigate(`/ticker/${h.ticker}`)} className="font-mono font-bold hover:text-primary transition-colors">
                              {h.ticker}
                            </button>
                            <span className="text-muted-foreground ml-1.5 text-[10px]">{h.name}</span>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono">{h.shares}</td>
                          <td className="py-2.5 px-2 text-right font-mono">${h.price.toFixed(2)}</td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold">${h.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                          <td className={`py-2.5 px-2 text-right font-mono ${h.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {h.changePercent >= 0 ? "+" : ""}{h.changePercent.toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              h.prediction.direction === "up" ? "bg-emerald-500/10 text-emerald-400" :
                              h.prediction.direction === "down" ? "bg-rose-500/10 text-rose-400" :
                              "bg-amber-500/10 text-amber-400"
                            }`}>
                              {h.prediction.direction === "up" ? <ArrowUpRight className="w-3 h-3" /> :
                               h.prediction.direction === "down" ? <ArrowDownRight className="w-3 h-3" /> :
                               <Minus className="w-3 h-3" />}
                              {(h.prediction.confidence * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`text-[10px] font-mono ${h.sentimentScore > 20 ? "text-emerald-400" : h.sentimentScore < -10 ? "text-rose-400" : "text-amber-400"}`}>
                              {h.sentimentScore > 0 ? "+" : ""}{h.sentimentScore.toFixed(0)}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button onClick={() => removeHolding(h.ticker)} className="text-muted-foreground/40 hover:text-rose-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right Column: Analysis */}
          <div className="space-y-4">
            {/* Prediction Exposure */}
            <motion.div {...fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-primary" />
                <h2 className="font-display font-semibold text-sm">Prediction Exposure</h2>
              </div>
              {isLoading ? (
                <div className="h-24 bg-muted/10 rounded animate-pulse" />
              ) : data ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-emerald-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Bullish</span>
                      <span className="font-mono">{data.predictionExposure.bullish}%</span>
                    </div>
                    <div className="w-full bg-muted/20 rounded-full h-2">
                      <div className="h-2 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${data.predictionExposure.bullish}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-rose-400 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Bearish</span>
                      <span className="font-mono">{data.predictionExposure.bearish}%</span>
                    </div>
                    <div className="w-full bg-muted/20 rounded-full h-2">
                      <div className="h-2 rounded-full bg-rose-500 transition-all duration-700" style={{ width: `${data.predictionExposure.bearish}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-amber-400 flex items-center gap-1"><Minus className="w-3 h-3" /> Neutral</span>
                      <span className="font-mono">{data.predictionExposure.neutral}%</span>
                    </div>
                    <div className="w-full bg-muted/20 rounded-full h-2">
                      <div className="h-2 rounded-full bg-amber-500 transition-all duration-700" style={{ width: `${data.predictionExposure.neutral}%` }} />
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>

            {/* Sector Breakdown */}
            <motion.div {...fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-primary" />
                <h2 className="font-display font-semibold text-sm">Sector Breakdown</h2>
              </div>
              {isLoading ? (
                <div className="h-32 bg-muted/10 rounded animate-pulse" />
              ) : data?.sectorBreakdown.map((s, i) => {
                const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-cyan-500", "bg-orange-500"];
                return (
                  <div key={s.sector} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground">{s.sector}</span>
                      <span className="font-mono text-muted-foreground">{s.percentage}%</span>
                    </div>
                    <div className="w-full bg-muted/20 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${colors[i % colors.length]} transition-all duration-700`} style={{ width: `${s.percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </motion.div>

            {/* Risk Flags */}
            <motion.div {...fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-primary" />
                <h2 className="font-display font-semibold text-sm">Risk Flags</h2>
              </div>
              {isLoading ? (
                <div className="h-24 bg-muted/10 rounded animate-pulse" />
              ) : data?.riskFlags.map((flag, i) => (
                <div
                  key={i}
                  className={`mb-3 last:mb-0 p-3 rounded-lg border ${
                    flag.type === "danger" ? "border-rose-500/30 bg-rose-500/5" :
                    flag.type === "warning" ? "border-amber-500/30 bg-amber-500/5" :
                    "border-blue-500/30 bg-blue-500/5"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {flag.type === "danger" ? <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> :
                     flag.type === "warning" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> :
                     <Info className="w-3.5 h-3.5 text-blue-400" />}
                    <span className={`text-xs font-medium ${
                      flag.type === "danger" ? "text-rose-400" :
                      flag.type === "warning" ? "text-amber-400" :
                      "text-blue-400"
                    }`}>{flag.title}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed pl-5">{flag.description}</p>
                </div>
              ))}
            </motion.div>

            {/* Narrative Sentiment */}
            <motion.div {...fadeInUp} className="rounded-xl border border-border/40 bg-card/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="font-display font-semibold text-sm">Narrative Sentiment</h2>
              </div>
              {data && (
                <div className="text-center">
                  <div className={`text-3xl font-mono font-bold mb-1 ${
                    data.narrativeSentiment.label === "Bullish" ? "text-emerald-400" :
                    data.narrativeSentiment.label === "Bearish" ? "text-rose-400" :
                    "text-amber-400"
                  }`}>
                    {data.narrativeSentiment.score > 0 ? "+" : ""}{data.narrativeSentiment.score.toFixed(1)}
                  </div>
                  <div className={`text-xs font-medium ${
                    data.narrativeSentiment.label === "Bullish" ? "text-emerald-400" :
                    data.narrativeSentiment.label === "Bearish" ? "text-rose-400" :
                    "text-amber-400"
                  }`}>
                    {data.narrativeSentiment.label}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">Weighted average of narrative sentiment across your holdings</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}


// ============================================================================
// Brokerage Export Menu — dropdown with format selection
// ============================================================================

function BrokerageExportMenu({ holdings }: { holdings?: any[] }) {
  const [open, setOpen] = useState(false);

  const handleExport = (format: BrokerageFormat) => {
    if (!holdings || holdings.length === 0) {
      toast.error("No holdings to export");
      return;
    }
    const mapped = holdings.map((h: any) => ({
      ticker: h.ticker,
      shares: h.shares || 0,
      price: h.price || 0,
      value: h.value || 0,
      sector: h.sector || "",
      change: h.changePercent || 0,
      weight: h.weight || 0,
    }));
    exportPortfolioBrokerage(format, mapped);
    const label = BROKERAGE_FORMATS.find((f) => f.key === format)?.label || format;
    toast.success(`Exported in ${label} format`);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/10 border border-transparent hover:border-border/15 transition-all text-xs font-medium"
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
        <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border/15">
              <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Brokerage Format</p>
            </div>
            {BROKERAGE_FORMATS.map((fmt) => (
              <button
                key={fmt.key}
                onClick={() => handleExport(fmt.key)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/20 transition-colors border-b border-border/10 last:border-0"
              >
                <div className="text-xs font-medium text-foreground/90">{fmt.label}</div>
                <div className="text-[10px] text-muted-foreground/50 mt-0.5">{fmt.description}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
