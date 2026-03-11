import { useState, useEffect } from "react";
import { Settings, X, Check, RotateCcw } from "lucide-react";

export interface WidgetSettingsConfig {
  /** Predictions widget: which tickers to show */
  predictions_tickers?: string[];
  /** Sentiment gauge: time range */
  sentiment_timeRange?: "1h" | "4h" | "1d" | "1w";
  /** Activity feed: max items to display */
  activityFeed_maxItems?: number;
  /** Narratives: sector focus filter */
  narratives_sectors?: string[];
  /** Market overview: show/hide sectors */
  marketOverview_showSectors?: boolean;
  /** Leaderboard: sort by */
  leaderboard_sortBy?: "accuracy" | "signals" | "recent";
}

export const DEFAULT_WIDGET_SETTINGS: WidgetSettingsConfig = {
  predictions_tickers: [],
  sentiment_timeRange: "1d",
  activityFeed_maxItems: 15,
  narratives_sectors: [],
  marketOverview_showSectors: true,
  leaderboard_sortBy: "accuracy",
};

const POPULAR_TICKERS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AMD",
  "SPY", "QQQ", "NFLX", "CRM", "INTC", "BA", "DIS", "JPM",
  "V", "MA", "WMT", "PG", "XOM", "CVX", "UNH", "JNJ",
];

const SECTORS = [
  "Technology", "Healthcare", "Finance", "Energy", "Consumer",
  "Industrial", "Materials", "Utilities", "Real Estate", "Communications",
];

const TIME_RANGES = [
  { value: "1h", label: "1 Hour" },
  { value: "4h", label: "4 Hours" },
  { value: "1d", label: "1 Day" },
  { value: "1w", label: "1 Week" },
] as const;

const FEED_COUNTS = [5, 10, 15, 20, 30, 50];

const SORT_OPTIONS = [
  { value: "accuracy", label: "Accuracy" },
  { value: "signals", label: "Signal Count" },
  { value: "recent", label: "Most Recent" },
] as const;

// ── Per-Widget Settings Panels ─────────────────────────────────────

function PredictionsSettings({
  config,
  onChange,
}: {
  config: WidgetSettingsConfig;
  onChange: (c: WidgetSettingsConfig) => void;
}) {
  const selected = config.predictions_tickers || [];
  const toggle = (ticker: string) => {
    const next = selected.includes(ticker)
      ? selected.filter((t) => t !== ticker)
      : [...selected, ticker];
    onChange({ ...config, predictions_tickers: next });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider block mb-2">
          Filter by Tickers
        </label>
        <p className="text-[10px] text-muted-foreground/40 mb-2">
          Select tickers to focus on. Leave empty to show all predictions.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => toggle(t)}
              className={`text-[10px] px-2 py-1 rounded-md border transition-all font-mono ${
                selected.includes(t)
                  ? "bg-primary/15 border-primary/30 text-primary font-semibold"
                  : "bg-background/30 border-border/20 text-muted-foreground/50 hover:border-border/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="mt-2 text-[10px] text-primary/60">
            {selected.length} ticker{selected.length !== 1 ? "s" : ""} selected
          </div>
        )}
      </div>
    </div>
  );
}

function SentimentSettings({
  config,
  onChange,
}: {
  config: WidgetSettingsConfig;
  onChange: (c: WidgetSettingsConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider block mb-2">
          Time Range
        </label>
        <p className="text-[10px] text-muted-foreground/40 mb-2">
          Sentiment analysis window for the gauge display.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.value}
              onClick={() => onChange({ ...config, sentiment_timeRange: tr.value })}
              className={`text-[10px] px-2.5 py-1.5 rounded-md border transition-all ${
                config.sentiment_timeRange === tr.value
                  ? "bg-primary/15 border-primary/30 text-primary font-semibold"
                  : "bg-background/30 border-border/20 text-muted-foreground/50 hover:border-border/40"
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivityFeedSettings({
  config,
  onChange,
}: {
  config: WidgetSettingsConfig;
  onChange: (c: WidgetSettingsConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider block mb-2">
          Max Items Displayed
        </label>
        <p className="text-[10px] text-muted-foreground/40 mb-2">
          How many items to show in the activity feed.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FEED_COUNTS.map((n) => (
            <button
              key={n}
              onClick={() => onChange({ ...config, activityFeed_maxItems: n })}
              className={`text-[10px] px-3 py-1.5 rounded-md border transition-all ${
                config.activityFeed_maxItems === n
                  ? "bg-primary/15 border-primary/30 text-primary font-semibold"
                  : "bg-background/30 border-border/20 text-muted-foreground/50 hover:border-border/40"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NarrativesSettings({
  config,
  onChange,
}: {
  config: WidgetSettingsConfig;
  onChange: (c: WidgetSettingsConfig) => void;
}) {
  const selected = config.narratives_sectors || [];
  const toggle = (sector: string) => {
    const next = selected.includes(sector)
      ? selected.filter((s) => s !== sector)
      : [...selected, sector];
    onChange({ ...config, narratives_sectors: next });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider block mb-2">
          Sector Focus
        </label>
        <p className="text-[10px] text-muted-foreground/40 mb-2">
          Filter narratives by sector. Leave empty to show all.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SECTORS.map((s) => (
            <button
              key={s}
              onClick={() => toggle(s)}
              className={`text-[10px] px-2.5 py-1 rounded-md border transition-all ${
                selected.includes(s)
                  ? "bg-primary/15 border-primary/30 text-primary font-semibold"
                  : "bg-background/30 border-border/20 text-muted-foreground/50 hover:border-border/40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="mt-2 text-[10px] text-primary/60">
            {selected.length} sector{selected.length !== 1 ? "s" : ""} selected
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderboardSettings({
  config,
  onChange,
}: {
  config: WidgetSettingsConfig;
  onChange: (c: WidgetSettingsConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider block mb-2">
          Sort By
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...config, leaderboard_sortBy: opt.value })}
              className={`text-[10px] px-2.5 py-1.5 rounded-md border transition-all ${
                config.leaderboard_sortBy === opt.value
                  ? "bg-primary/15 border-primary/30 text-primary font-semibold"
                  : "bg-background/30 border-border/20 text-muted-foreground/50 hover:border-border/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketOverviewSettings({
  config,
  onChange,
}: {
  config: WidgetSettingsConfig;
  onChange: (c: WidgetSettingsConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider block mb-2">
          Display Options
        </label>
        <button
          onClick={() => onChange({ ...config, marketOverview_showSectors: !config.marketOverview_showSectors })}
          className={`flex items-center gap-2 text-[10px] px-3 py-2 rounded-md border transition-all w-full ${
            config.marketOverview_showSectors
              ? "bg-primary/15 border-primary/30 text-primary"
              : "bg-background/30 border-border/20 text-muted-foreground/50"
          }`}
        >
          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
            config.marketOverview_showSectors ? "bg-primary border-primary" : "border-border/40"
          }`}>
            {config.marketOverview_showSectors && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
          </div>
          Show sector breakdown
        </button>
      </div>
    </div>
  );
}

// ── Widget Settings Map ────────────────────────────────────────────

const WIDGET_SETTINGS_MAP: Record<
  string,
  {
    label: string;
    Panel: React.FC<{ config: WidgetSettingsConfig; onChange: (c: WidgetSettingsConfig) => void }>;
  }
> = {
  predictions: { label: "Prediction Feed", Panel: PredictionsSettings },
  "sentiment-watchlist": { label: "Sentiment & Watchlist", Panel: SentimentSettings },
  "activity-feed": { label: "Intelligence Stream", Panel: ActivityFeedSettings },
  narratives: { label: "Narrative Intelligence", Panel: NarrativesSettings },
  "leaderboard-accuracy": { label: "Leaderboard & Accuracy", Panel: LeaderboardSettings },
  "market-overview": { label: "Market Overview", Panel: MarketOverviewSettings },
};

// ── Widget Settings Button (for DashboardGrid) ────────────────────

export function WidgetSettingsButton({
  widgetId,
  config,
  onSave,
}: {
  widgetId: string;
  config: WidgetSettingsConfig;
  onSave: (config: WidgetSettingsConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WidgetSettingsConfig>(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const entry = WIDGET_SETTINGS_MAP[widgetId];
  if (!entry) return null;

  const { Panel, label } = entry;

  const handleSave = () => {
    onSave(draft);
    setOpen(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_WIDGET_SETTINGS);
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="w-7 h-7 rounded-md bg-muted/50 hover:bg-primary/20 flex items-center justify-center opacity-70 hover:opacity-100 transition-all border border-border/30"
        title={`Configure ${label}`}
      >
        <Settings className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[80vh] overflow-y-auto rounded-xl border border-border/30 bg-popover text-popover-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/15 flex items-center justify-between sticky top-0 bg-popover z-10">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary/60" />
                <span className="text-xs font-semibold">{label} Settings</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-md hover:bg-muted/30 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Panel */}
            <div className="p-4">
              <Panel config={draft} onChange={setDraft} />
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border/15 flex items-center justify-between sticky bottom-0 bg-popover">
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Default
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="text-[10px] px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                >
                  <Check className="w-3 h-3" />
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
