import { useState, useMemo } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp,
  Clock,
  Eye,
  Share2,
  BarChart3,
  Activity,
  Brain,
  AlertTriangle,
  CheckCircle,
  Link,
} from "lucide-react";

/**
 * Public read-only snapshot page — beautiful static view of a user's dashboard
 * at a specific moment in time. Accessible without authentication.
 */
export default function SnapshotPage() {
  const [, params] = useRoute("/snapshot/:id");
  const shareId = params?.id || "";
  const [copied, setCopied] = useState(false);

  const { data: snapshot, isLoading, error } = trpc.watchlist.snapshotGet.useQuery(
    { shareId },
    { enabled: !!shareId, retry: 1 }
  );

  const parsedData = useMemo(() => {
    if (!snapshot?.data) return null;
    try {
      return JSON.parse(snapshot.data as string);
    } catch {
      return null;
    }
  }, [snapshot?.data]);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <div className="text-sm text-muted-foreground">Loading snapshot...</div>
        </div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">Snapshot Not Found</h1>
          <p className="text-sm text-muted-foreground">
            This snapshot may have expired or been deleted. Snapshots are available for 30 days after creation.
          </p>
          <a
            href="/"
            className="inline-block mt-4 text-sm text-primary hover:underline"
          >
            Go to MarketMind Dashboard
          </a>
        </div>
      </div>
    );
  }

  const createdAt = new Date(snapshot.createdAt);
  const visibleWidgets = parsedData?.layout?.filter((w: any) => w.visible) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/20 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Brain className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">MarketMind</div>
              <div className="text-[10px] text-muted-foreground/60">Dashboard Snapshot</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="text-[10px] font-medium px-2.5 py-1 rounded-md border border-border/30 bg-muted/10 text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all flex items-center gap-1"
            >
              {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Link className="w-3 h-3" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <a
              href="/"
              className="text-[10px] font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Open MarketMind
            </a>
          </div>
        </div>
      </header>

      {/* Snapshot Info Banner */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-border/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight">{snapshot.title || "Dashboard Snapshot"}</h1>
              <div className="flex items-center gap-4 mt-1.5">
                {snapshot.userName && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                      {(snapshot.userName as string).charAt(0).toUpperCase()}
                    </div>
                    {snapshot.userName as string}
                  </div>
                )}
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {createdAt.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Eye className="w-3 h-3" />
                  {snapshot.views} views
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded-md px-2.5 py-1.5">
              <Share2 className="w-3 h-3" />
              Read-only snapshot — data frozen at capture time
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Widget Grid */}
        {visibleWidgets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            {visibleWidgets.map((widget: any) => {
              const colSpan = widget.colSpan || 4;
              return (
                <div
                  key={widget.id}
                  className={`lg:col-span-${colSpan} sm:col-span-1`}
                  style={{ gridColumn: `span ${Math.min(colSpan, 12)} / span ${Math.min(colSpan, 12)}` }}
                >
                  <SnapshotWidget widget={widget} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <BarChart3 className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <div className="text-sm text-muted-foreground">No widget data in this snapshot</div>
          </div>
        )}

        {/* Snapshot Metadata */}
        <div className="mt-8 pt-6 border-t border-border/10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetaCard
              icon={BarChart3}
              label="Widgets"
              value={`${visibleWidgets.length} active`}
            />
            <MetaCard
              icon={Clock}
              label="Captured"
              value={createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            />
            <MetaCard
              icon={Activity}
              label="Layout Size"
              value={widget_size_label(parsedData?.layout?.length || 0)}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/10 mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
            <Brain className="w-3 h-3" />
            MarketMind — AI-Powered Market Intelligence
          </div>
          <div className="text-[10px] text-muted-foreground/30">
            Snapshot expires {new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
          </div>
        </div>
      </footer>
    </div>
  );
}

function widget_size_label(count: number): string {
  if (count <= 4) return "Compact";
  if (count <= 8) return "Standard";
  return "Full";
}

// ── Widget Icon Map ──────────────────────────────────────────────────
const WIDGET_ICONS: Record<string, any> = {
  "market-grid": BarChart3,
  "predictions": TrendingUp,
  "sentiment-gauge": Activity,
  "activity-feed": Clock,
  "narratives": Brain,
  "accuracy-tracker": CheckCircle,
  "anomaly-detection": AlertTriangle,
};

function SnapshotWidget({ widget }: { widget: any }) {
  const Icon = WIDGET_ICONS[widget.id] || BarChart3;
  const sizeClass = widget.size === "large" ? "min-h-[200px]" : widget.size === "small" ? "min-h-[100px]" : "min-h-[140px]";

  return (
    <div className={`bg-card/60 backdrop-blur-sm border border-border/15 rounded-xl p-4 ${sizeClass} transition-all hover:border-border/25`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="w-3 h-3 text-primary" />
        </div>
        <div className="text-[11px] font-semibold">{widget.title}</div>
        {widget.size && (
          <span className="text-[9px] text-muted-foreground/40 ml-auto uppercase tracking-wider">
            {widget.size}
          </span>
        )}
      </div>

      {/* Simulated frozen data visualization */}
      <div className="space-y-2">
        {widget.size === "large" ? (
          <>
            <div className="h-3 bg-muted/20 rounded-full w-full" />
            <div className="h-3 bg-muted/15 rounded-full w-4/5" />
            <div className="h-3 bg-muted/10 rounded-full w-3/5" />
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-muted/10 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-muted-foreground/40">Metric {i}</div>
                  <div className="text-sm font-bold text-foreground/60 mt-0.5">—</div>
                </div>
              ))}
            </div>
          </>
        ) : widget.size === "small" ? (
          <>
            <div className="h-2.5 bg-muted/20 rounded-full w-3/4" />
            <div className="h-2.5 bg-muted/15 rounded-full w-1/2" />
          </>
        ) : (
          <>
            <div className="h-3 bg-muted/20 rounded-full w-full" />
            <div className="h-3 bg-muted/15 rounded-full w-3/4" />
            <div className="h-3 bg-muted/10 rounded-full w-1/2" />
          </>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-border/10 text-[9px] text-muted-foreground/30 italic">
        Data frozen at snapshot time
      </div>
    </div>
  );
}

function MetaCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-card/40 border border-border/10 rounded-lg p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-md bg-primary/5 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary/40" />
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground/50">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}
