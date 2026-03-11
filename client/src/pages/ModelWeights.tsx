import { usePageTracking } from "@/hooks/usePageTracking";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AppHeader } from "@/components/AppHeader";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sliders, Save, Trash2, Check, BarChart3, TrendingUp, TrendingDown,
  Minus, Brain, Newspaper, LineChart, Users, Zap, ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { FirstVisitTooltip } from "@/components/FirstVisitTooltip";

interface Weights {
  social: number;
  technical: number;
  fundamental: number;
  news: number;
}

// Simulated prediction data that responds to weight changes
function generateWeightedPredictions(weights: Weights) {
  const tickers = [
    { symbol: "AAPL", baseConf: 0.72, baseSentiment: 0.6, baseTechnical: 0.7, baseFundamental: 0.8, baseNews: 0.5 },
    { symbol: "NVDA", baseConf: 0.68, baseSentiment: 0.8, baseTechnical: 0.5, baseFundamental: 0.6, baseNews: 0.9 },
    { symbol: "TSLA", baseConf: 0.55, baseSentiment: 0.3, baseTechnical: 0.6, baseFundamental: 0.4, baseNews: 0.7 },
    { symbol: "MSFT", baseConf: 0.78, baseSentiment: 0.7, baseTechnical: 0.8, baseFundamental: 0.85, baseNews: 0.6 },
    { symbol: "AMZN", baseConf: 0.65, baseSentiment: 0.5, baseTechnical: 0.65, baseFundamental: 0.7, baseNews: 0.55 },
    { symbol: "META", baseConf: 0.61, baseSentiment: 0.4, baseTechnical: 0.7, baseFundamental: 0.75, baseNews: 0.45 },
    { symbol: "GOOGL", baseConf: 0.70, baseSentiment: 0.6, baseTechnical: 0.72, baseFundamental: 0.78, baseNews: 0.5 },
    { symbol: "AMD", baseConf: 0.58, baseSentiment: 0.7, baseTechnical: 0.45, baseFundamental: 0.5, baseNews: 0.8 },
  ];

  const total = weights.social + weights.technical + weights.fundamental + weights.news;
  if (total === 0) return tickers.map(t => ({
    symbol: t.symbol,
    confidence: t.baseConf,
    direction: "bullish" as const,
    weightedScore: 0.5,
    signals: {
      social: Math.round(t.baseSentiment * 100),
      technical: Math.round(t.baseTechnical * 100),
      fundamental: Math.round(t.baseFundamental * 100),
      news: Math.round(t.baseNews * 100),
    },
  }));

  const w = {
    social: weights.social / total,
    technical: weights.technical / total,
    fundamental: weights.fundamental / total,
    news: weights.news / total,
  };

  return tickers.map(t => {
    const weightedScore =
      t.baseSentiment * w.social +
      t.baseTechnical * w.technical +
      t.baseFundamental * w.fundamental +
      t.baseNews * w.news;

    // Confidence is the weighted score mapped to 0.35-0.95 range
    const confidence = Math.min(0.95, Math.max(0.35, weightedScore * 1.1));
    const direction = weightedScore >= 0.5 ? "bullish" : "bearish";

    return {
      symbol: t.symbol,
      confidence: Math.round(confidence * 100) / 100,
      direction: direction as "bullish" | "bearish",
      weightedScore: Math.round(weightedScore * 100) / 100,
      signals: {
        social: Math.round(t.baseSentiment * 100),
        technical: Math.round(t.baseTechnical * 100),
        fundamental: Math.round(t.baseFundamental * 100),
        news: Math.round(t.baseNews * 100),
      },
    };
  }).sort((a, b) => b.confidence - a.confidence);
}

const sourceIcons: Record<string, React.ReactNode> = {
  social: <Users className="w-4 h-4" />,
  technical: <LineChart className="w-4 h-4" />,
  fundamental: <BarChart3 className="w-4 h-4" />,
  news: <Newspaper className="w-4 h-4" />,
};

const sourceColors: Record<string, string> = {
  social: "oklch(0.75 0.18 160)",
  technical: "oklch(0.75 0.18 250)",
  fundamental: "oklch(0.75 0.18 50)",
  news: "oklch(0.75 0.18 310)",
};

const sourceDescriptions: Record<string, string> = {
  social: "Reddit, Twitter/X, StockTwits sentiment analysis",
  technical: "Moving averages, RSI, MACD, volume patterns",
  fundamental: "P/E ratios, earnings, revenue growth, margins",
  news: "Breaking news, analyst reports, SEC filings",
};

export default function ModelWeights() {
  usePageTracking("model-weights");
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const activeProfile = trpc.watchlist.weightProfileActive.useQuery(undefined, { enabled: !!user });
  const profileList = trpc.watchlist.weightProfileList.useQuery(undefined, { enabled: !!user });

  const [weights, setWeights] = useState<Weights>({
    social: 25,
    technical: 25,
    fundamental: 25,
    news: 25,
  });

  const [profileName, setProfileName] = useState("Custom Profile");
  const [showProfiles, setShowProfiles] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync weights from active profile
  useEffect(() => {
    if (activeProfile.data) {
      setWeights({
        social: activeProfile.data.socialWeight,
        technical: activeProfile.data.technicalWeight,
        fundamental: activeProfile.data.fundamentalWeight,
        news: activeProfile.data.newsWeight,
      });
      setProfileName(activeProfile.data.name);
      setHasChanges(false);
    }
  }, [activeProfile.data]);

  const saveMutation = trpc.watchlist.weightProfileSave.useMutation({
    onSuccess: () => {
      utils.watchlist.weightProfileActive.invalidate();
      utils.watchlist.weightProfileList.invalidate();
      setHasChanges(false);
      toast.success("Weight profile saved!");
    },
  });

  const activateMutation = trpc.watchlist.weightProfileActivate.useMutation({
    onSuccess: () => {
      utils.watchlist.weightProfileActive.invalidate();
      utils.watchlist.weightProfileList.invalidate();
      setShowProfiles(false);
      toast.success("Profile activated!");
    },
  });

  const deleteMutation = trpc.watchlist.weightProfileDelete.useMutation({
    onSuccess: () => {
      utils.watchlist.weightProfileList.invalidate();
      toast.success("Profile deleted");
    },
  });

  const updateWeight = useCallback((key: keyof Weights, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const totalWeight = weights.social + weights.technical + weights.fundamental + weights.news;

  const predictions = useMemo(() => generateWeightedPredictions(weights), [weights]);

  // Aggregate stats
  const bullishCount = predictions.filter(p => p.direction === "bullish").length;
  const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-6xl py-8">
        <FirstVisitTooltip
          storageKey="model-weights"
          title="Prediction Model Weights"
          description="Control how different signal sources influence your prediction feed. Adjust weights for technical analysis, sentiment, fundamentals, and more — the model recalculates in real time."
          tips={[
            "Drag sliders to increase or decrease the influence of each signal source",
            "Save custom profiles to quickly switch between different strategies",
            "Watch the preview panel to see how weight changes affect current predictions",
          ]}
          accentColor="primary"
          icon={<Sliders className="w-4.5 h-4.5 text-primary" />}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-3">
              <Sliders className="w-6 h-6 text-primary" />
              Prediction Model Weights
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Customize how signal sources influence your prediction feed. Changes preview in real time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Profile Selector */}
            <div className="relative">
              <button
                onClick={() => setShowProfiles(!showProfiles)}
                className="px-3 py-2 rounded-lg border border-border/50 text-sm font-medium hover:bg-accent/30 transition-colors flex items-center gap-2"
              >
                <Brain className="w-4 h-4 text-primary" />
                {profileName}
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <AnimatePresence>
                {showProfiles && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full mt-1 w-64 rounded-xl p-2 z-50"
                    style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                  >
                    {(!profileList.data || profileList.data.length === 0) && (
                      <p className="text-xs text-muted-foreground p-2">No saved profiles yet.</p>
                    )}
                    {profileList.data?.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/20 transition-colors cursor-pointer"
                        onClick={() => activateMutation.mutate({ profileId: p.id })}
                      >
                        <div>
                          <span className="text-sm font-medium">{p.name}</span>
                          <div className="flex gap-1 mt-0.5">
                            <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400">S:{p.socialWeight}</span>
                            <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400">T:{p.technicalWeight}</span>
                            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400">F:{p.fundamentalWeight}</span>
                            <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400">N:{p.newsWeight}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {p.isActive && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate({ profileId: p.id });
                            }}
                            className="p-1 rounded hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3 h-3 text-muted-foreground/40 hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Save Button */}
            <button
              onClick={() => {
                saveMutation.mutate({
                  name: profileName,
                  socialWeight: weights.social,
                  technicalWeight: weights.technical,
                  fundamentalWeight: weights.fundamental,
                  newsWeight: weights.news,
                });
              }}
              disabled={saveMutation.isPending}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                hasChanges
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-primary/20 text-primary/60 cursor-default"
              }`}
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Weight Sliders */}
          <div className="lg:col-span-2 space-y-4">
            {/* Profile Name */}
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <label className="text-xs text-muted-foreground mb-1.5 block">Profile Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => { setProfileName(e.target.value); setHasChanges(true); }}
                className="w-full px-3 py-2 rounded-lg bg-background/50 border border-border/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Weight Sliders */}
            {(["social", "technical", "fundamental", "news"] as const).map((key) => (
              <motion.div
                key={key}
                className="rounded-xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${sourceColors[key]}20`, color: sourceColors[key] }}
                    >
                      {sourceIcons[key]}
                    </div>
                    <div>
                      <span className="text-sm font-medium capitalize">{key}</span>
                      <p className="text-[10px] text-muted-foreground leading-tight">{sourceDescriptions[key]}</p>
                    </div>
                  </div>
                  <span
                    className="text-lg font-mono font-bold tabular-nums"
                    style={{ color: sourceColors[key] }}
                  >
                    {weights[key]}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[key]}
                  onChange={(e) => updateWeight(key, parseInt(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${sourceColors[key]} 0%, ${sourceColors[key]} ${weights[key]}%, var(--muted) ${weights[key]}%, var(--muted) 100%)`,
                  }}
                />
                {/* Weight bar visualization */}
                <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-muted/20">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: sourceColors[key] }}
                    animate={{ width: `${totalWeight > 0 ? (weights[key] / totalWeight) * 100 : 25}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                </div>
              </motion.div>
            ))}

            {/* Total Weight Indicator */}
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Weight Distribution</span>
                <span className="text-xs font-mono text-muted-foreground">Total: {totalWeight}%</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {(["social", "technical", "fundamental", "news"] as const).map((key) => (
                  <motion.div
                    key={key}
                    className="h-full rounded-sm"
                    style={{ background: sourceColors[key] }}
                    animate={{ width: `${totalWeight > 0 ? (weights[key] / totalWeight) * 100 : 25}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1.5">
                {(["social", "technical", "fundamental", "news"] as const).map((key) => (
                  <span key={key} className="text-[9px] font-mono" style={{ color: sourceColors[key] }}>
                    {totalWeight > 0 ? Math.round((weights[key] / totalWeight) * 100) : 25}%
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Presets */}
            <div
              className="rounded-xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h4 className="text-xs text-muted-foreground mb-2">Quick Presets</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Balanced", s: 25, t: 25, f: 25, n: 25 },
                  { label: "Momentum", s: 40, t: 40, f: 10, n: 10 },
                  { label: "Value", s: 10, t: 15, f: 60, n: 15 },
                  { label: "News-Driven", s: 30, t: 10, f: 10, n: 50 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setWeights({ social: preset.s, technical: preset.t, fundamental: preset.f, news: preset.n });
                      setHasChanges(true);
                    }}
                    className="px-3 py-2 rounded-lg border border-border/30 text-xs font-medium hover:bg-accent/20 transition-colors text-left"
                  >
                    <span className="block">{preset.label}</span>
                    <span className="text-[9px] text-muted-foreground">
                      S:{preset.s} T:{preset.t} F:{preset.f} N:{preset.n}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Real-time Prediction Preview */}
          <div className="lg:col-span-3 space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div
                className="rounded-xl p-4 text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <Zap className="w-5 h-5 text-primary mx-auto mb-1" />
                <span className="text-2xl font-display font-bold">{predictions.length}</span>
                <p className="text-[10px] text-muted-foreground">Predictions</p>
              </div>
              <div
                className="rounded-xl p-4 text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <span className="text-2xl font-display font-bold text-emerald-400">{bullishCount}</span>
                <p className="text-[10px] text-muted-foreground">Bullish</p>
              </div>
              <div
                className="rounded-xl p-4 text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <BarChart3 className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <span className="text-2xl font-display font-bold text-blue-400">
                  {Math.round(avgConfidence * 100)}%
                </span>
                <p className="text-[10px] text-muted-foreground">Avg Confidence</p>
              </div>
            </div>

            {/* Prediction Cards */}
            <div className="space-y-2">
              <h3 className="text-sm font-display font-semibold text-muted-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Weighted Prediction Preview
              </h3>
              {predictions.map((p, i) => (
                <motion.div
                  key={p.symbol}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl p-4"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-lg">{p.symbol}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                        p.direction === "bullish"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                          : "bg-red-500/15 text-red-400 border-red-500/20"
                      }`}>
                        {p.direction === "bullish" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {p.direction}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-mono font-bold">{Math.round(p.confidence * 100)}%</span>
                      <p className="text-[10px] text-muted-foreground">confidence</p>
                    </div>
                  </div>

                  {/* Signal Breakdown */}
                  <div className="grid grid-cols-4 gap-2">
                    {(["social", "technical", "fundamental", "news"] as const).map((key) => {
                      const signal = p.signals[key];
                      const weight = totalWeight > 0 ? weights[key] / totalWeight : 0.25;
                      return (
                        <div key={key} className="text-center">
                          <div className="relative h-1.5 rounded-full bg-muted/20 mb-1">
                            <motion.div
                              className="absolute left-0 top-0 h-full rounded-full"
                              style={{ background: sourceColors[key] }}
                              animate={{ width: `${signal}%` }}
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          </div>
                          <span className="text-[9px] font-mono" style={{ color: sourceColors[key] }}>
                            {signal}
                          </span>
                          <span className="text-[8px] text-muted-foreground/50 ml-0.5">
                            ×{Math.round(weight * 100)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Weighted Score Bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground">Weighted Score</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: p.direction === "bullish"
                            ? "linear-gradient(to right, oklch(0.65 0.18 160), oklch(0.75 0.18 160))"
                            : "linear-gradient(to right, oklch(0.65 0.18 25), oklch(0.75 0.18 25))",
                        }}
                        animate={{ width: `${p.weightedScore * 100}%` }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground">{p.weightedScore}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
