import { usePageTracking } from "@/hooks/usePageTracking";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AppHeader } from "@/components/AppHeader";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Download, Trash2, Plus, Calendar, BarChart3,
  TrendingUp, Target, Clock, ExternalLink, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { FirstVisitTooltip } from "@/components/FirstVisitTooltip";

export default function Reports() {
  usePageTracking("reports");
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const reports = trpc.watchlist.reportsList.useQuery(undefined, { enabled: !!user });

  const generateMutation = trpc.watchlist.reportsGenerate.useMutation({
    onSuccess: (data) => {
      utils.watchlist.reportsList.invalidate();
      toast.success(`Report generated: ${data.title}`);
    },
    onError: () => {
      toast.error("Failed to generate report. Please try again.");
    },
  });

  const deleteMutation = trpc.watchlist.reportsDelete.useMutation({
    onMutate: async ({ reportId }) => {
      await utils.watchlist.reportsList.cancel();
      const prev = utils.watchlist.reportsList.getData();
      utils.watchlist.reportsList.setData(undefined, (old) =>
        old?.filter((r) => r.id !== reportId)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.watchlist.reportsList.setData(undefined, ctx.prev);
      toast.error("Failed to delete report");
    },
    onSettled: () => {
      utils.watchlist.reportsList.invalidate();
    },
  });

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatPeriod = (start: number, end: number) =>
    `${new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-5xl py-8">
        <FirstVisitTooltip
          storageKey="reports"
          title="Intelligence Reports"
          description="Generate comprehensive weekly reports covering prediction accuracy, market narrative shifts, and portfolio performance. Reports are AI-generated and stored for historical comparison."
          tips={[
            "Click 'Generate Report' to create a new weekly intelligence summary",
            "Each report includes prediction hit rates, top narratives, and portfolio P&L",
            "Download reports as PDF for offline review or sharing with your team",
          ]}
          accentColor="amber"
          icon={<FileText className="w-4.5 h-4.5 text-amber-400" />}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              Intelligence Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Weekly performance reports with prediction accuracy, market analysis, and portfolio insights.
            </p>
          </div>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {generateMutation.isPending ? "Generating..." : "Generate Report"}
          </button>
        </div>

        {/* Reports List */}
        {reports.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl p-5 animate-pulse"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="h-5 bg-muted/20 rounded w-2/3 mb-3" />
                <div className="h-4 bg-muted/10 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : !reports.data || reports.data.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-12 text-center"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-display font-semibold mb-2">No Reports Yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Generate your first weekly intelligence report to get a comprehensive summary of prediction
              performance, market narratives, and portfolio insights.
            </p>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Generate First Report
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {reports.data.map((report, i) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl p-5 group"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-display font-semibold text-sm mb-1">{report.title}</h3>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatPeriod(report.periodStart, report.periodEnd)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Generated {formatDate(report.createdAt)}
                        </span>
                      </div>

                      {/* Metadata KPIs */}
                      {report.metadata && (
                        <div className="flex items-center gap-4 mt-3">
                          {report.metadata.predictionsCount && (
                            <span className="flex items-center gap-1.5 text-xs">
                              <Target className="w-3.5 h-3.5 text-blue-400" />
                              <span className="font-mono font-medium">{report.metadata.predictionsCount}</span>
                              <span className="text-muted-foreground">predictions</span>
                            </span>
                          )}
                          {report.metadata.accuracy && (
                            <span className="flex items-center gap-1.5 text-xs">
                              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="font-mono font-medium text-emerald-400">{report.metadata.accuracy}%</span>
                              <span className="text-muted-foreground">accuracy</span>
                            </span>
                          )}
                          {report.metadata.bullishRatio && (
                            <span className="flex items-center gap-1.5 text-xs">
                              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                              <span className="font-mono font-medium text-amber-400">{report.metadata.bullishRatio}%</span>
                              <span className="text-muted-foreground">bullish</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <a
                        href={report.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-accent/20 transition-colors"
                        title="View report"
                      >
                        <ExternalLink className="w-4 h-4 text-primary" />
                      </a>
                      <a
                        href={report.fileUrl}
                        download
                        className="p-2 rounded-lg hover:bg-accent/20 transition-colors"
                        title="Download report"
                      >
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </a>
                      <button
                        onClick={() => deleteMutation.mutate({ reportId: report.id })}
                        className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Delete report"
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground/40 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Reports are automatically generated every Sunday at 6:00 AM UTC.
            You can also generate a report on demand at any time.
          </p>
        </div>
      </main>
    </div>
  );
}
