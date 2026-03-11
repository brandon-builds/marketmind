import { useState, useCallback, useMemo, useEffect } from "react";
import {
  GripVertical,
  RotateCcw,
  Save,
  Check,
  Eye,
  EyeOff,
  TrendingUp,
  BookOpen,
  Briefcase,
  ChevronDown,
  Plus,
  Minimize2,
  Square,
  Maximize2,
  FileDown,
  Loader2,
  Share2,
  Link,
  CheckCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  WidgetSettingsButton,
  DEFAULT_WIDGET_SETTINGS,
  type WidgetSettingsConfig,
} from "./WidgetSettings";

export type WidgetSize = "small" | "medium" | "large";

export interface WidgetConfig {
  id: string;
  title: string;
  /** Grid column span on large screens (out of 12) */
  colSpan: number;
  /** Whether this widget is visible */
  visible: boolean;
  /** Widget size: small = compact, medium = normal, large = expanded */
  size: WidgetSize;
}

/** Column spans per size for each widget */
const SIZE_COL_MAP: Record<string, Record<WidgetSize, number>> = {
  "activity-feed":        { small: 3, medium: 5, large: 8 },
  "sentiment-watchlist":  { small: 3, medium: 4, large: 6 },
  "leaderboard-accuracy": { small: 3, medium: 3, large: 5 },
  "market-overview":      { small: 6, medium: 12, large: 12 },
  "narratives":           { small: 4, medium: 6, large: 8 },
  "predictions":          { small: 4, medium: 6, large: 8 },
  "experiments":          { small: 6, medium: 12, large: 12 },
  "anomaly-detection":    { small: 4, medium: 6, large: 12 },
  "trending-feed":        { small: 4, medium: 4, large: 6 },
  "prediction-markets":   { small: 4, medium: 4, large: 6 },
  "agent-status":         { small: 4, medium: 4, large: 6 },
  "arbitrage-signals":    { small: 4, medium: 6, large: 8 },
  "sector-heatmap":       { small: 4, medium: 6, large: 8 },
  "earnings-calendar":    { small: 4, medium: 4, large: 6 },
};

function getColSpanForSize(widgetId: string, size: WidgetSize): number {
  return SIZE_COL_MAP[widgetId]?.[size] ?? (size === "small" ? 4 : size === "large" ? 8 : 6);
}

export const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: "activity-feed", title: "Intelligence Stream", colSpan: 5, visible: true, size: "medium" },
  { id: "sentiment-watchlist", title: "Sentiment & Watchlist", colSpan: 4, visible: true, size: "medium" },
  { id: "leaderboard-accuracy", title: "Leaderboard & Accuracy", colSpan: 3, visible: true, size: "medium" },
  { id: "market-overview", title: "Market Overview", colSpan: 12, visible: true, size: "medium" },
  { id: "narratives", title: "Narrative Intelligence", colSpan: 6, visible: true, size: "medium" },
  { id: "predictions", title: "Prediction Feed", colSpan: 6, visible: true, size: "medium" },
  { id: "anomaly-detection", title: "Anomaly Detection", colSpan: 12, visible: true, size: "medium" },
  { id: "trending-feed", title: "X Trending Finance", colSpan: 4, visible: true, size: "medium" },
  { id: "prediction-markets", title: "Prediction Markets", colSpan: 4, visible: true, size: "medium" },
  { id: "agent-status", title: "Agent Status", colSpan: 4, visible: true, size: "medium" },
  { id: "arbitrage-signals", title: "Arbitrage Opportunities", colSpan: 6, visible: true, size: "medium" },
  { id: "sector-heatmap", title: "Sector Alpha Heatmap", colSpan: 6, visible: true, size: "medium" },
  { id: "earnings-calendar", title: "Upcoming Earnings", colSpan: 4, visible: true, size: "medium" },
  { id: "experiments", title: "Experiment Log", colSpan: 12, visible: true, size: "medium" },
];

// ── Layout Presets ──────────────────────────────────────────────────
export const LAYOUT_PRESETS: {
  id: string;
  name: string;
  description: string;
  icon: typeof TrendingUp;
  layout: WidgetConfig[];
}[] = [
  {
    id: "trader",
    name: "Trader Focus",
    description: "Predictions & watchlist front and center",
    icon: TrendingUp,
    layout: [
      { id: "predictions", title: "Prediction Feed", colSpan: 7, visible: true, size: "large" },
      { id: "sentiment-watchlist", title: "Sentiment & Watchlist", colSpan: 5, visible: true, size: "medium" },
      { id: "activity-feed", title: "Intelligence Stream", colSpan: 6, visible: true, size: "medium" },
      { id: "market-overview", title: "Market Overview", colSpan: 6, visible: true, size: "small" },
      { id: "leaderboard-accuracy", title: "Leaderboard & Accuracy", colSpan: 12, visible: false, size: "medium" },
      { id: "anomaly-detection", title: "Anomaly Detection", colSpan: 12, visible: true, size: "medium" },
      { id: "narratives", title: "Narrative Intelligence", colSpan: 6, visible: false, size: "medium" },
      { id: "experiments", title: "Experiment Log", colSpan: 12, visible: false, size: "medium" },
    ],
  },
  {
    id: "researcher",
    name: "Researcher",
    description: "Narratives & experiments prominent",
    icon: BookOpen,
    layout: [
      { id: "narratives", title: "Narrative Intelligence", colSpan: 7, visible: true, size: "large" },
      { id: "activity-feed", title: "Intelligence Stream", colSpan: 5, visible: true, size: "medium" },
      { id: "experiments", title: "Experiment Log", colSpan: 12, visible: true, size: "large" },
      { id: "predictions", title: "Prediction Feed", colSpan: 6, visible: true, size: "medium" },
      { id: "leaderboard-accuracy", title: "Leaderboard & Accuracy", colSpan: 6, visible: true, size: "medium" },
      { id: "anomaly-detection", title: "Anomaly Detection", colSpan: 12, visible: true, size: "medium" },
      { id: "sentiment-watchlist", title: "Sentiment & Watchlist", colSpan: 12, visible: false, size: "medium" },
      { id: "market-overview", title: "Market Overview", colSpan: 12, visible: false, size: "medium" },
    ],
  },
  {
    id: "portfolio",
    name: "Portfolio Manager",
    description: "Market overview & performance tracking",
    icon: Briefcase,
    layout: [
      { id: "market-overview", title: "Market Overview", colSpan: 12, visible: true, size: "large" },
      { id: "sentiment-watchlist", title: "Sentiment & Watchlist", colSpan: 6, visible: true, size: "large" },
      { id: "leaderboard-accuracy", title: "Leaderboard & Accuracy", colSpan: 6, visible: true, size: "medium" },
      { id: "predictions", title: "Prediction Feed", colSpan: 6, visible: true, size: "small" },
      { id: "activity-feed", title: "Intelligence Stream", colSpan: 6, visible: true, size: "small" },
      { id: "anomaly-detection", title: "Anomaly Detection", colSpan: 12, visible: true, size: "medium" },
      { id: "narratives", title: "Narrative Intelligence", colSpan: 12, visible: false, size: "medium" },
      { id: "experiments", title: "Experiment Log", colSpan: 12, visible: false, size: "medium" },
    ],
  },
];

const LAYOUT_KEY = "dashboard_layout";
const WIDGET_SETTINGS_KEY = "widget_settings";

const SIZE_LABELS: Record<WidgetSize, string> = {
  small: "S",
  medium: "M",
  large: "L",
};

const SIZE_CYCLE: WidgetSize[] = ["small", "medium", "large"];

// ── Draggable Widget ────────────────────────────────────────────────
function DraggableWidget({
  widget,
  children,
  editMode,
  draggedId,
  dragOverId,
  widgetSettings,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onToggleVisibility,
  onCycleSize,
  onSaveWidgetSettings,
}: {
  widget: WidgetConfig;
  children: React.ReactNode;
  editMode: boolean;
  draggedId: string | null;
  dragOverId: string | null;
  widgetSettings: WidgetSettingsConfig;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onToggleVisibility: (id: string) => void;
  onCycleSize: (id: string) => void;
  onSaveWidgetSettings: (config: WidgetSettingsConfig) => void;
}) {
  const isDragging = draggedId === widget.id;
  const isDragOver = dragOverId === widget.id && draggedId !== widget.id;
  const colSpan = getColSpanForSize(widget.id, widget.size);

  // Size-based height classes
  const sizeClass =
    widget.size === "small"
      ? "max-h-[260px] overflow-hidden"
      : widget.size === "large"
        ? ""
        : "max-h-[520px] overflow-hidden";

  return (
    <div
      draggable={editMode}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", widget.id);
        setTimeout(() => onDragStart(widget.id), 0);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(e, widget.id);
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, widget.id)}
      style={{ '--widget-col-span': colSpan } as React.CSSProperties}
      className={`relative group/widget transition-all duration-200 ${sizeClass} col-span-1 sm:col-span-1 lg:[grid-column:span_var(--widget-col-span)] ${
        isDragging ? "opacity-30 scale-[0.97]" : ""
      } ${isDragOver ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background rounded-xl" : ""} ${
        editMode ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      {/* Edit mode overlay controls */}
      {editMode && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
          {/* Widget settings button */}
          <WidgetSettingsButton
            widgetId={widget.id}
            config={widgetSettings}
            onSave={onSaveWidgetSettings}
          />
          {/* Size cycle button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCycleSize(widget.id);
            }}
            className="h-7 px-1.5 rounded-md bg-muted/50 hover:bg-primary/20 flex items-center gap-0.5 opacity-80 hover:opacity-100 transition-all border border-border/30"
            title={`Size: ${widget.size} — click to cycle`}
          >
            {SIZE_CYCLE.map((s) => {
              const isActive = widget.size === s;
              return (
                <span
                  key={s}
                  className={`text-[9px] font-bold w-4 h-4 rounded flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-primary/30 text-primary"
                      : "text-muted-foreground/40"
                  }`}
                >
                  {SIZE_LABELS[s]}
                </span>
              );
            })}
          </button>
          {/* Hide button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(widget.id);
            }}
            className="w-7 h-7 rounded-md bg-muted/50 hover:bg-destructive/20 flex items-center justify-center opacity-70 hover:opacity-100 transition-all border border-border/30"
            title={`Hide ${widget.title}`}
          >
            <EyeOff className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
          </button>
          {/* Drag handle */}
          <div className="w-7 h-7 rounded-md bg-muted/50 hover:bg-muted/80 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-70 hover:opacity-100 transition-opacity border border-border/30">
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Size indicator badge — always visible in edit mode */}
      {editMode && (
        <div className="absolute top-2 left-2 z-20">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
            widget.size === "small"
              ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
              : widget.size === "large"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                : "bg-muted/30 border-border/20 text-muted-foreground/60"
          }`}>
            {widget.size === "small" ? "COMPACT" : widget.size === "large" ? "EXPANDED" : "NORMAL"}
          </span>
        </div>
      )}

      {children}
    </div>
  );
}

// ── Hidden Widgets Tray ─────────────────────────────────────────────
function HiddenWidgetsTray({
  hiddenWidgets,
  onRestore,
}: {
  hiddenWidgets: WidgetConfig[];
  onRestore: (id: string) => void;
}) {
  if (hiddenWidgets.length === 0) return null;

  return (
    <div className="mt-3 p-3 rounded-lg border border-dashed border-border/40 bg-muted/5">
      <div className="flex items-center gap-2 mb-2">
        <EyeOff className="w-3 h-3 text-muted-foreground/40" />
        <span className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider">
          Hidden Widgets
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {hiddenWidgets.map((w) => (
          <button
            key={w.id}
            onClick={() => onRestore(w.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/30 bg-background/50 hover:bg-primary/10 hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all text-[11px]"
          >
            <Plus className="w-3 h-3" />
            {w.title}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Preset Selector ─────────────────────────────────────────────────
function PresetSelector({
  onApply,
}: {
  onApply: (layout: WidgetConfig[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] font-medium px-2.5 py-1 rounded-md border border-border/30 bg-muted/10 text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all flex items-center gap-1"
      >
        Presets
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-64 rounded-lg border border-border/40 bg-popover text-popover-foreground shadow-xl overflow-hidden">
            {LAYOUT_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    onApply(preset.layout);
                    setOpen(false);
                  }}
                  className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold">{preset.name}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {preset.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Share Snapshot Button ─────────────────────────────────────────────────────────
function ShareSnapshotButton({ layout, widgetSettings }: { layout: WidgetConfig[]; widgetSettings: WidgetSettingsConfig }) {
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createSnapshot = trpc.watchlist.snapshotCreate.useMutation();

  const handleShare = async () => {
    setSharing(true);
    try {
      const snapshotData = JSON.stringify({
        layout,
        widgetSettings,
        capturedAt: Date.now(),
      });
      const result = await createSnapshot.mutateAsync({
        title: `Dashboard Snapshot — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        snapshotData,
      });
      const url = `${window.location.origin}/snapshot/${result.shareId}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Failed to create snapshot:", err);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        disabled={sharing}
        className="text-[10px] font-medium px-2.5 py-1 rounded-md border border-border/30 bg-muted/10 text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all flex items-center gap-1"
      >
        {sharing ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : copied ? (
          <CheckCircle className="w-3 h-3 text-emerald-400" />
        ) : (
          <Share2 className="w-3 h-3" />
        )}
        {sharing ? "Creating..." : copied ? "Link Copied!" : "Share Snapshot"}
      </button>
      {shareUrl && !sharing && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-card border border-border/30 rounded-lg p-2.5 shadow-xl min-w-[280px]">
          <div className="text-[10px] text-muted-foreground/60 mb-1.5">Shareable link (30 days):</div>
          <div className="flex items-center gap-1.5">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 text-[10px] font-mono bg-accent/30 border border-border/20 rounded px-2 py-1 text-foreground truncate"
            />
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              {copied ? <CheckCircle className="w-3 h-3" /> : <Link className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setShareUrl(null)}
            className="text-[9px] text-muted-foreground/40 hover:text-foreground mt-1.5 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard Grid ───────────────────────────────────────────────────────────────
export function DashboardGrid({
  children,
  widgetMap,
  onExportPdf,
  exportingPdf,
}: {
  children: (layout: WidgetConfig[]) => Record<string, React.ReactNode>;
  widgetMap?: Record<string, React.ReactNode>;
  onExportPdf?: () => void;
  exportingPdf?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const [layout, setLayout] = useState<WidgetConfig[]>(DEFAULT_LAYOUT);
  const [widgetSettings, setWidgetSettings] = useState<WidgetSettingsConfig>(DEFAULT_WIDGET_SETTINGS);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Load saved layout from server
  const layoutQuery = trpc.preferences.get.useQuery(
    { key: LAYOUT_KEY },
    { enabled: isAuthenticated, retry: 1 }
  );

  // Load saved widget settings from server
  const widgetSettingsQuery = trpc.preferences.get.useQuery(
    { key: WIDGET_SETTINGS_KEY },
    { enabled: isAuthenticated, retry: 1 }
  );

  useEffect(() => {
    if (layoutQuery.data?.value) {
      try {
        const savedLayout = JSON.parse(layoutQuery.data.value) as WidgetConfig[];
        // Merge with defaults to handle new widgets added after save
        const merged = DEFAULT_LAYOUT.map((def) => {
          const savedWidget = savedLayout.find((s) => s.id === def.id);
          return savedWidget ? { ...def, ...savedWidget } : def;
        });
        // Reorder to match saved order
        const orderedIds = savedLayout.map((s) => s.id);
        merged.sort((a, b) => {
          const aIdx = orderedIds.indexOf(a.id);
          const bIdx = orderedIds.indexOf(b.id);
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
        setLayout(merged);
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, [layoutQuery.data]);

  useEffect(() => {
    if (widgetSettingsQuery.data?.value) {
      try {
        const saved = JSON.parse(widgetSettingsQuery.data.value) as WidgetSettingsConfig;
        setWidgetSettings({ ...DEFAULT_WIDGET_SETTINGS, ...saved });
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, [widgetSettingsQuery.data]);

  const saveMutation = trpc.preferences.set.useMutation({
    onSuccess: () => {
      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const resetMutation = trpc.preferences.delete.useMutation({
    onSuccess: () => {
      setLayout(DEFAULT_LAYOUT);
      setWidgetSettings(DEFAULT_WIDGET_SETTINGS);
      setHasChanges(false);
    },
  });

  // ── Drag handlers ──
  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback((_e: React.DragEvent, id: string) => {
    setDragOverId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(
    (_e: React.DragEvent, targetId: string) => {
      if (!draggedId || draggedId === targetId) {
        handleDragEnd();
        return;
      }
      setLayout((items) => {
        const newItems = [...items];
        const oldIndex = newItems.findIndex((i) => i.id === draggedId);
        const newIndex = newItems.findIndex((i) => i.id === targetId);
        if (oldIndex === -1 || newIndex === -1) return items;
        const [moved] = newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, moved);
        return newItems;
      });
      setHasChanges(true);
      handleDragEnd();
    },
    [draggedId, handleDragEnd]
  );

  // ── Visibility handlers ──
  const handleToggleVisibility = useCallback((id: string) => {
    setLayout((items) =>
      items.map((item) =>
        item.id === id ? { ...item, visible: !item.visible } : item
      )
    );
    setHasChanges(true);
  }, []);

  const handleRestoreWidget = useCallback((id: string) => {
    setLayout((items) =>
      items.map((item) =>
        item.id === id ? { ...item, visible: true } : item
      )
    );
    setHasChanges(true);
  }, []);

  // ── Size cycle handler ──
  const handleCycleSize = useCallback((id: string) => {
    setLayout((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const currentIdx = SIZE_CYCLE.indexOf(item.size);
        const nextSize = SIZE_CYCLE[(currentIdx + 1) % SIZE_CYCLE.length];
        return {
          ...item,
          size: nextSize,
          colSpan: getColSpanForSize(item.id, nextSize),
        };
      })
    );
    setHasChanges(true);
  }, []);

  // ── Widget settings handler ──
  const handleSaveWidgetSettings = useCallback((newConfig: WidgetSettingsConfig) => {
    setWidgetSettings(newConfig);
    setHasChanges(true);
  }, []);

  // ── Preset handler ──
  const handleApplyPreset = useCallback((presetLayout: WidgetConfig[]) => {
    setLayout(presetLayout);
    setHasChanges(true);
  }, []);

  // ── Save / Reset ──
  const handleSave = useCallback(() => {
    saveMutation.mutate({ key: LAYOUT_KEY, value: JSON.stringify(layout) });
    // Also save widget settings
    saveMutation.mutate({ key: WIDGET_SETTINGS_KEY, value: JSON.stringify(widgetSettings) });
  }, [layout, widgetSettings, saveMutation]);

  const handleReset = useCallback(() => {
    resetMutation.mutate({ key: LAYOUT_KEY });
    resetMutation.mutate({ key: WIDGET_SETTINGS_KEY });
    setEditMode(false);
  }, [resetMutation]);

  // ── Derived state ──
  const visibleLayout = useMemo(
    () => layout.filter((w) => w.visible),
    [layout]
  );

  const hiddenLayout = useMemo(
    () => layout.filter((w) => !w.visible),
    [layout]
  );

  const widgetContent = useMemo(() => {
    if (widgetMap) return widgetMap;
    return children(layout);
  }, [children, layout, widgetMap]);

  return (
    <div>
      {/* Layout controls */}
      {isAuthenticated && (
        <div className="flex items-center justify-end gap-2 mb-3 flex-wrap px-1 sm:px-0">
          {/* Share Snapshot */}
          <ShareSnapshotButton layout={layout} widgetSettings={widgetSettings} />
          {/* Export PDF — always visible */}
          {onExportPdf && (
            <button
              onClick={onExportPdf}
              disabled={exportingPdf}
              className="text-[10px] font-medium px-2.5 py-1 rounded-md border border-border/30 bg-muted/10 text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all flex items-center gap-1"
            >
              {exportingPdf ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <FileDown className="w-3 h-3" />
              )}
              {exportingPdf ? "Exporting..." : "Export PDF"}
            </button>
          )}
          <button
            onClick={() => setEditMode(!editMode)}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-md border transition-all ${
              editMode
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/30 bg-muted/10 text-muted-foreground hover:text-foreground hover:bg-muted/20"
            }`}
          >
            {editMode ? "Done Editing" : "Customize Layout"}
          </button>
          {editMode && (
            <>
              <PresetSelector onApply={handleApplyPreset} />
              {hasChanges && (
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="text-[10px] font-medium px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                >
                  {saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                  {saved ? "Saved" : "Save Layout"}
                </button>
              )}
              <button
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className="text-[10px] font-medium px-2.5 py-1 rounded-md border border-border/30 bg-muted/10 text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </>
          )}
        </div>
      )}

      {/* Size legend — only in edit mode */}
      {editMode && (
        <div className="flex items-center gap-4 mb-3 px-1">
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">Widget Sizes:</span>
          {SIZE_CYCLE.map((s) => (
            <div key={s} className="flex items-center gap-1">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                s === "small"
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                  : s === "large"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    : "bg-muted/30 border-border/20 text-muted-foreground/60"
              }`}>
                {SIZE_LABELS[s]}
              </span>
              <span className="text-[10px] text-muted-foreground/40 capitalize">{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Widget Grid — responsive: 1 col phone, 2 col tablet, 12 col desktop */}
      <div id="dashboard-grid-content" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
        {visibleLayout.map((widget) => (
          <DraggableWidget
            key={widget.id}
            widget={widget}
            editMode={editMode}
            draggedId={draggedId}
            dragOverId={dragOverId}
            widgetSettings={widgetSettings}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onToggleVisibility={handleToggleVisibility}
            onCycleSize={handleCycleSize}
            onSaveWidgetSettings={handleSaveWidgetSettings}
          >
            {widgetContent[widget.id]}
          </DraggableWidget>
        ))}
      </div>

      {/* Hidden Widgets Tray — only in edit mode */}
      {editMode && (
        <HiddenWidgetsTray
          hiddenWidgets={hiddenLayout}
          onRestore={handleRestoreWidget}
        />
      )}
    </div>
  );
}

// Re-export for Home.tsx to use
export { type WidgetSettingsConfig } from "./WidgetSettings";
