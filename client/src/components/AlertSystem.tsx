import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellRing,
  Plus,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  FileText,
  ArrowRightLeft,
  Volume2,
  VolumeX,
  Play,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAlertSounds, SOUND_OPTIONS, type SoundType } from "@/hooks/useAlertSounds";

// ============================================================================
// Types
// ============================================================================

export type AlertType =
  | "price_above"
  | "price_below"
  | "sentiment_above"
  | "sentiment_below"
  | "narrative_mention"
  | "sentiment_shift";

export interface Alert {
  id: number;
  ticker: string;
  type: AlertType;
  threshold: number;
  sentimentFilter?: string | null;
  keyword?: string | null;
  triggerContext?: string | null;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number | null;
}

// ============================================================================
// Popular Tickers
// ============================================================================

const POPULAR_TICKERS = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA",
  "SPY", "QQQ", "GLD", "XLE", "XLF", "XLK",
];

const ALERT_TYPES: { value: AlertType; label: string; icon: React.ReactNode; category: string }[] = [
  { value: "price_above", label: "Price rises above", icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />, category: "Price" },
  { value: "price_below", label: "Price drops below", icon: <TrendingDown className="w-3.5 h-3.5 text-rose-400" />, category: "Price" },
  { value: "sentiment_above", label: "Sentiment rises above", icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />, category: "Sentiment" },
  { value: "sentiment_below", label: "Sentiment drops below", icon: <Activity className="w-3.5 h-3.5 text-rose-400" />, category: "Sentiment" },
  { value: "narrative_mention", label: "Narrative mentions ticker", icon: <FileText className="w-3.5 h-3.5 text-blue-400" />, category: "Narrative" },
  { value: "sentiment_shift", label: "Sentiment shifts to", icon: <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />, category: "Narrative" },
];

// ============================================================================
// Alert Bell Button (for AppHeader)
// ============================================================================

export function AlertBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  const { data: serverAlerts } = trpc.watchlist.alertsList.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const alerts: Alert[] = useMemo(() => {
    if (!serverAlerts) return [];
    return serverAlerts.map((a) => ({
      id: a.id,
      ticker: a.ticker,
      type: a.type as AlertType,
      threshold: a.threshold,
      triggered: a.triggered,
      triggeredAt: a.triggeredAt,
      createdAt: a.createdAt,
    }));
  }, [serverAlerts]);

  const activeCount = alerts.filter((a) => !a.triggered).length;
  const triggeredCount = alerts.filter((a) => a.triggered).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        title="Alerts"
      >
        {triggeredCount > 0 ? (
          <BellRing className="w-4 h-4 text-amber-400" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
        {activeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <AlertPanel
            alerts={alerts}
            onClose={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Alert Panel
// ============================================================================

function AlertPanel({
  alerts,
  onClose,
}: {
  alerts: Alert[];
  onClose: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const utils = trpc.useUtils();

  const deleteMutation = trpc.watchlist.alertsDelete.useMutation({
    onSuccess: () => utils.watchlist.alertsList.invalidate(),
  });

  const createMutation = trpc.watchlist.alertsCreate.useMutation({
    onSuccess: () => {
      utils.watchlist.alertsList.invalidate();
      setShowCreate(false);
    },
  });

  const deleteAlert = useCallback(
    (id: number) => {
      deleteMutation.mutate({ alertId: id });
    },
    [deleteMutation]
  );

  const clearTriggered = useCallback(() => {
    const triggered = alerts.filter((a) => a.triggered);
    triggered.forEach((a) => deleteMutation.mutate({ alertId: a.id }));
  }, [alerts, deleteMutation]);

  const addAlert = useCallback(
    (alert: { ticker: string; type: AlertType; threshold: number; sentimentFilter?: "bullish" | "bearish" | "any"; keyword?: string }) => {
      createMutation.mutate(alert);
    },
    [createMutation]
  );

  const activeAlerts = useMemo(() => alerts.filter((a) => !a.triggered), [alerts]);
  const triggeredAlerts = useMemo(() => alerts.filter((a) => a.triggered), [alerts]);

  return (
    <motion.div
      className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[400px] max-h-[560px] rounded-xl overflow-hidden z-50"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 32px oklch(0 0 0 / 12%), 0 0 0 1px var(--border)",
      }}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary/70" />
          <span className="font-display text-sm font-semibold">Alerts</span>
          {activeAlerts.length > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground/50">
              {activeAlerts.length} active
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sound Controls */}
      <SoundControlsSection />

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto">
        {/* Create button */}
        {!showCreate && (
          <div className="p-3 border-b border-border/10">
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-2.5 rounded-lg border border-dashed border-border/30 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent/30 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Create New Alert
            </button>
          </div>
        )}

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <CreateAlertForm
              onSubmit={addAlert}
              onCancel={() => setShowCreate(false)}
              isLoading={createMutation.isPending}
            />
          )}
        </AnimatePresence>

        {/* Triggered alerts */}
        {triggeredAlerts.length > 0 && (
          <div className="border-b border-border/10">
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-wider">
                Triggered ({triggeredAlerts.length})
              </span>
              <button
                onClick={clearTriggered}
                className="text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            </div>
            {triggeredAlerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} onDelete={deleteAlert} />
            ))}
          </div>
        )}

        {/* Active alerts */}
        {activeAlerts.length > 0 && (
          <div>
            <div className="px-4 py-2">
              <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
                Active ({activeAlerts.length})
              </span>
            </div>
            {activeAlerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} onDelete={deleteAlert} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {alerts.length === 0 && !showCreate && (
          <div className="py-10 text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/50 mb-1">No alerts set</p>
            <p className="text-xs text-muted-foreground/30 max-w-[280px] mx-auto">
              Create alerts for price thresholds, narrative mentions, or sentiment shifts
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Sound Controls
// ============================================================================

function SoundControlsSection() {
  const { config, updateConfig, preview } = useAlertSounds();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border/10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <div className="flex items-center gap-1.5">
          {config.enabled ? (
            <Volume2 className="w-3 h-3 text-primary/60" />
          ) : (
            <VolumeX className="w-3 h-3" />
          )}
          <span>Alert Sounds {config.enabled ? "On" : "Off"}</span>
        </div>
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3">
              {/* Enable toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[11px] font-medium">Enable sounds</span>
                <button
                  onClick={() => updateConfig({ enabled: !config.enabled })}
                  className={`w-8 h-4.5 rounded-full transition-colors relative ${
                    config.enabled ? "bg-primary" : "bg-muted/30"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                      config.enabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>

              {config.enabled && (
                <>
                  {/* Volume slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground/50">Volume</span>
                      <span className="text-[10px] font-mono text-muted-foreground/40">{config.volume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.volume}
                      onChange={(e) => updateConfig({ volume: Number(e.target.value) })}
                      className="w-full h-1 bg-muted/20 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>

                  {/* Sound type selection */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground/50">Sound Type</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SOUND_OPTIONS.map((sound) => (
                        <button
                          key={sound.id}
                          onClick={() => {
                            updateConfig({ soundType: sound.id as SoundType });
                            preview(sound.id as SoundType);
                          }}
                          className={`text-left p-2 rounded-lg border transition-all ${
                            config.soundType === sound.id
                              ? "border-primary/30 bg-primary/5"
                              : "border-border/10 hover:border-border/20 hover:bg-accent/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium">{sound.name}</span>
                            <Play className="w-2.5 h-2.5 text-muted-foreground/30" />
                          </div>
                          <div className="text-[9px] text-muted-foreground/40 mt-0.5">{sound.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Alert Row
// ============================================================================

function AlertRow({ alert, onDelete }: { alert: Alert; onDelete: (id: number) => void }) {
  const typeInfo = ALERT_TYPES.find((t) => t.value === alert.type);
  const isPrice = alert.type.startsWith("price_");
  const isNarrative = alert.type === "narrative_mention" || alert.type === "sentiment_shift";

  const getDescription = () => {
    if (isPrice) {
      return `$${(alert.threshold / 100).toFixed(2)}`;
    }
    if (alert.type === "narrative_mention") {
      const parts: string[] = [];
      if (alert.sentimentFilter && alert.sentimentFilter !== "any") {
        parts.push(alert.sentimentFilter);
      }
      if (alert.keyword) {
        parts.push(`"${alert.keyword}"`);
      }
      return parts.length > 0 ? parts.join(" · ") : "any narrative";
    }
    if (alert.type === "sentiment_shift") {
      return `shift to ${alert.sentimentFilter || "any"}`;
    }
    return `Score: ${alert.threshold / 100}`;
  };

  return (
    <div
      className={`px-4 py-2.5 flex items-center gap-3 hover:bg-accent/30 transition-colors group ${
        alert.triggered ? "opacity-60" : ""
      }`}
    >
      <div className="flex-shrink-0">
        {alert.triggered ? (
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        ) : (
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            isNarrative ? "bg-blue-500/10" : "bg-accent/50"
          }`}>
            {typeInfo?.icon}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-semibold">{alert.ticker}</span>
          <span className="text-[10px] text-muted-foreground/50 truncate">
            {typeInfo?.label}
          </span>
        </div>
        <div className="text-xs text-muted-foreground/70 truncate">
          {getDescription()}
          {alert.triggered && alert.triggeredAt && (
            <span className="ml-2 text-emerald-400/70">
              Triggered {new Date(alert.triggeredAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {alert.triggered && alert.triggerContext && (
          <div className="text-[10px] text-muted-foreground/40 mt-0.5 truncate">
            {alert.triggerContext}
          </div>
        )}
      </div>

      <button
        onClick={() => onDelete(alert.id)}
        className="p-1.5 rounded text-muted-foreground/20 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ============================================================================
// Create Alert Form
// ============================================================================

function CreateAlertForm({
  onSubmit,
  onCancel,
  isLoading,
}: {
  onSubmit: (alert: { ticker: string; type: AlertType; threshold: number; sentimentFilter?: "bullish" | "bearish" | "any"; keyword?: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [ticker, setTicker] = useState("AAPL");
  const [type, setType] = useState<AlertType>("price_above");
  const [threshold, setThreshold] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<"bullish" | "bearish" | "any">("any");
  const [keyword, setKeyword] = useState("");
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("Price");

  const isPrice = type.startsWith("price_");
  const isSentiment = type.startsWith("sentiment_") && !type.includes("shift");
  const isNarrative = type === "narrative_mention";
  const isSentimentShift = type === "sentiment_shift";
  const needsThreshold = isPrice || isSentiment;
  const needsSentimentFilter = isNarrative || isSentimentShift;
  const needsKeyword = isNarrative;

  const placeholder = isPrice ? "e.g. 250.00" : "e.g. 50";

  const categories = ["Price", "Sentiment", "Narrative"];

  const handleSubmit = () => {
    const val = needsThreshold ? parseFloat(threshold) : 0;
    if (needsThreshold && (isNaN(val) || val <= 0)) return;
    onSubmit({
      ticker,
      type,
      threshold: needsThreshold ? val : 0,
      sentimentFilter: needsSentimentFilter ? sentimentFilter : undefined,
      keyword: needsKeyword && keyword.trim() ? keyword.trim() : undefined,
    });
  };

  const canSubmit = () => {
    if (needsThreshold) {
      const val = parseFloat(threshold);
      return !isNaN(val) && val > 0;
    }
    return true; // Narrative alerts don't require threshold
  };

  return (
    <motion.div
      className="p-4 border-b border-border/10 bg-accent/20"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="space-y-3">
        {/* Ticker selector */}
        <div>
          <label className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-1 block">
            Ticker
          </label>
          <div className="relative">
            <button
              onClick={() => setShowTickerDropdown(!showTickerDropdown)}
              className="w-full py-2 px-3 rounded-lg bg-background border border-border/30 text-sm font-mono text-left flex items-center justify-between hover:border-primary/30 transition-colors"
            >
              {ticker}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />
            </button>
            <AnimatePresence>
              {showTickerDropdown && (
                <motion.div
                  className="absolute top-full mt-1 left-0 right-0 rounded-lg overflow-hidden z-10 max-h-[180px] overflow-y-auto"
                  style={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    boxShadow: "0 4px 12px oklch(0 0 0 / 8%)",
                  }}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  {POPULAR_TICKERS.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTicker(t);
                        setShowTickerDropdown(false);
                      }}
                      className={`w-full py-1.5 px-3 text-left text-xs font-mono hover:bg-accent/50 transition-colors ${
                        t === ticker ? "text-primary bg-accent/30" : "text-foreground/80"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Alert category tabs */}
        <div>
          <label className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-1 block">
            Alert Type
          </label>
          <div className="flex gap-1 mb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  // Auto-select first type in category
                  const first = ALERT_TYPES.find((t) => t.category === cat);
                  if (first) setType(first.value);
                }}
                className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-background border border-border/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ALERT_TYPES.filter((at) => at.category === activeCategory).map((at) => (
              <button
                key={at.value}
                onClick={() => setType(at.value)}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-medium flex items-center gap-1.5 transition-all ${
                  type === at.value
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-background border border-border/20 text-muted-foreground hover:text-foreground hover:border-border/40"
                }`}
              >
                {at.icon}
                <span className="truncate">{at.label.replace("Price ", "").replace("Sentiment ", "")}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Threshold (for price/sentiment alerts) */}
        {needsThreshold && (
          <div>
            <label className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-1 block">
              {isPrice ? "Price ($)" : "Sentiment Score"}
            </label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder={placeholder}
              className="w-full py-2 px-3 rounded-lg bg-background border border-border/30 text-sm font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 transition-colors"
              step={isPrice ? "0.01" : "1"}
            />
          </div>
        )}

        {/* Sentiment filter (for narrative alerts) */}
        {needsSentimentFilter && (
          <div>
            <label className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-1 block">
              {isSentimentShift ? "Shift Direction" : "Sentiment Filter"}
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["bullish", "bearish", "any"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSentimentFilter(s)}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-medium capitalize transition-all ${
                    sentimentFilter === s
                      ? s === "bullish"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : s === "bearish"
                        ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        : "bg-primary/15 text-primary border border-primary/30"
                      : "bg-background border border-border/20 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Keyword (for narrative mention alerts) */}
        {needsKeyword && (
          <div>
            <label className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-1 block">
              Keyword (optional)
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder='e.g. "earnings", "AI", "tariff"'
              className="w-full py-2 px-3 rounded-lg bg-background border border-border/30 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 transition-colors"
            />
            <p className="text-[9px] text-muted-foreground/40 mt-1">
              Leave empty to match any narrative for this ticker
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit() || isLoading}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-display font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {isLoading ? "Creating..." : "Create Alert"}
          </button>
          <button
            onClick={onCancel}
            className="py-2 px-4 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}
