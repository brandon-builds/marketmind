import { usePageTracking } from "@/hooks/usePageTracking";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { AppHeader } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Activity, Eye, TrendingUp, BarChart3, Zap, Shield, Clock,
  GraduationCap, SkipForward, CheckCircle2, Lightbulb, MousePointerClick,
  MapPin, FlaskConical, Download, Timer, ArrowRight,
} from "lucide-react";
import { useEffect, useCallback } from "react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

function formatDuration(seconds: number): string {
  if (seconds === 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function AdminAnalytics() {
  usePageTracking("admin-analytics");
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  // Redirect non-admin users
  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "admin")) {
      navigate("/");
    }
  }, [loading, isAuthenticated, user, navigate]);

  const { data, isLoading } = trpc.watchlist.adminAnalytics.useQuery(
    { days: 30 },
    { enabled: isAuthenticated && user?.role === "admin", retry: 1 }
  );

  const { data: onboardingData, isLoading: onboardingLoading } = trpc.onboarding.summary.useQuery(
    { days: 30 },
    { enabled: isAuthenticated && user?.role === "admin", retry: 1 }
  );

  const { data: cohortData, isLoading: cohortLoading } = trpc.onboarding.cohortRetention.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin", retry: 1 }
  );

  const trpcUtils = trpc.useUtils();

  const { data: variantOverride } = trpc.onboarding.getVariantOverride.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const setVariantOverrideMutation = trpc.onboarding.setVariantOverride.useMutation({
    onSuccess: () => trpcUtils.onboarding.getVariantOverride.invalidate(),
  });

  const downloadCsv = useCallback(async (type: "funnel" | "features" | "pages" | "tooltips" | "variants" | "velocity" | "all") => {
    try {
      const result = await trpcUtils.onboarding.exportCsv.fetch({ days: 30, type });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail
    }
  }, [trpcUtils]);

  if (loading || !isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Shield className="w-5 h-5" />
          <span className="text-sm">Verifying access...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader title="Admin Analytics" subtitle="Owner Dashboard" showBack />

      {/* Export All Button */}
      <div className="max-w-[1920px] mx-auto px-4 lg:px-6 pt-4 flex justify-end">
        <button
          onClick={() => downloadCsv("all")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-display font-semibold hover:bg-primary/20 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export All Analytics (CSV)
        </button>
      </div>

      <motion.main
        className="max-w-[1920px] mx-auto px-4 lg:px-6 py-6 space-y-5"
        initial="initial"
        animate="animate"
        variants={stagger}
      >
        {/* KPI Cards */}
        <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          ) : (
            <>
              <KPICard
                icon={<Users className="w-4 h-4 text-blue-400" />}
                label="Total Users"
                value={data?.totalUsers ?? 0}
                accent="blue"
              />
              <KPICard
                icon={<Activity className="w-4 h-4 text-emerald-400" />}
                label="Active Users (30d)"
                value={data?.activeUsers ?? 0}
                accent="emerald"
              />
              <KPICard
                icon={<Zap className="w-4 h-4 text-amber-400" />}
                label="Total Events (30d)"
                value={data?.totalEvents ?? 0}
                accent="amber"
              />
              <KPICard
                icon={<Eye className="w-4 h-4 text-purple-400" />}
                label="Engagement Rate"
                value={data && data.totalUsers > 0
                  ? `${((data.activeUsers / data.totalUsers) * 100).toFixed(0)}%`
                  : "—"
                }
                accent="purple"
              />
            </>
          )}
        </motion.div>

        {/* Daily Active Users Chart */}
        <motion.div variants={fadeInUp} className="section-card">
          <div className="h-[2px] bg-gradient-to-r from-blue-500 to-blue-400 opacity-40" />
          <div className="px-4 py-3 border-b border-border/15 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400/70" />
            <h2 className="font-display text-[13px] font-semibold tracking-tight">Daily Active Users (14 days)</h2>
          </div>
          <div className="p-4">
            {isLoading ? (
              <Skeleton className="h-48 rounded-lg" />
            ) : data?.dailyActive && data.dailyActive.length > 0 ? (
              <div className="space-y-2">
                {/* Simple bar chart using divs */}
                <div className="flex items-end gap-1 h-40">
                  {data.dailyActive.map((d, i) => {
                    const max = Math.max(...data.dailyActive.map(x => x.users), 1);
                    const pct = (d.users / max) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-mono text-muted-foreground/50">{d.users}</span>
                        <div
                          className="w-full rounded-t-sm bg-blue-500/30 border border-blue-500/20 transition-all hover:bg-blue-500/50"
                          style={{ height: `${Math.max(pct, 4)}%` }}
                        />
                        <span className="text-[8px] font-mono text-muted-foreground/30 -rotate-45 origin-center">
                          {String(d.day).slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground/40">
                No activity data yet. Events will appear as users interact with the platform.
              </div>
            )}
          </div>
        </motion.div>

        {/* Top Pages + Top Tickers + Event Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div variants={fadeInUp} className="section-card">
            <div className="h-[2px] bg-gradient-to-r from-emerald-500 to-emerald-400 opacity-40" />
            <div className="px-4 py-3 border-b border-border/15 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400/70" />
              <h2 className="font-display text-[13px] font-semibold tracking-tight">Top Pages</h2>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
                </div>
              ) : data?.topPages && data.topPages.length > 0 ? (
                <div className="space-y-1.5">
                  {data.topPages.map((p, i) => {
                    const max = data.topPages[0]?.count || 1;
                    return (
                      <div key={i} className="relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-emerald-500/8 rounded"
                          style={{ width: `${(p.count / max) * 100}%` }}
                        />
                        <div className="relative flex items-center justify-between px-3 py-1.5">
                          <span className="text-xs font-mono text-foreground/70">{p.page}</span>
                          <span className="text-xs font-mono text-emerald-400">{p.count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground/40">No page data yet</div>
              )}
            </div>
          </motion.div>

          <motion.div variants={fadeInUp} className="section-card">
            <div className="h-[2px] bg-gradient-to-r from-amber-500 to-amber-400 opacity-40" />
            <div className="px-4 py-3 border-b border-border/15 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400/70" />
              <h2 className="font-display text-[13px] font-semibold tracking-tight">Top Tickers</h2>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
                </div>
              ) : data?.topTickers && data.topTickers.length > 0 ? (
                <div className="space-y-1.5">
                  {data.topTickers.map((t, i) => {
                    const max = data.topTickers[0]?.count || 1;
                    return (
                      <div key={i} className="relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-amber-500/8 rounded"
                          style={{ width: `${(t.count / max) * 100}%` }}
                        />
                        <div className="relative flex items-center justify-between px-3 py-1.5">
                          <span className="text-xs font-mono font-bold text-foreground/70">{t.ticker}</span>
                          <span className="text-xs font-mono text-amber-400">{t.count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground/40">No ticker data yet</div>
              )}
            </div>
          </motion.div>

          <motion.div variants={fadeInUp} className="section-card">
            <div className="h-[2px] bg-gradient-to-r from-purple-500 to-violet-400 opacity-40" />
            <div className="px-4 py-3 border-b border-border/15 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-purple-400/70" />
              <h2 className="font-display text-[13px] font-semibold tracking-tight">Event Breakdown</h2>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
                </div>
              ) : data?.eventBreakdown && data.eventBreakdown.length > 0 ? (
                <div className="space-y-1.5">
                  {data.eventBreakdown.map((e, i) => {
                    const max = data.eventBreakdown[0]?.count || 1;
                    return (
                      <div key={i} className="relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-purple-500/8 rounded"
                          style={{ width: `${(e.count / max) * 100}%` }}
                        />
                        <div className="relative flex items-center justify-between px-3 py-1.5">
                          <span className="text-xs font-mono text-foreground/70">{e.event}</span>
                          <span className="text-xs font-mono text-purple-400">{e.count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground/40">No event data yet</div>
              )}
            </div>
          </motion.div>
        </div>
        {/* Onboarding Analytics Section */}
        <motion.div variants={fadeInUp}>
          <div className="flex items-center gap-2 mb-3 mt-2">
            <GraduationCap className="w-4 h-4 text-cyan-400" />
            <h2 className="font-display text-base font-bold tracking-tight">Onboarding Analytics</h2>
          </div>
        </motion.div>

        {/* Onboarding KPI Cards */}
        <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {onboardingLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          ) : (
            <>
              <KPICard
                icon={<GraduationCap className="w-4 h-4 text-cyan-400" />}
                label="Tour Starts"
                value={onboardingData?.tourStarts ?? 0}
                accent="blue"
              />
              <KPICard
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                label="Tour Completes"
                value={onboardingData?.tourCompletes ?? 0}
                accent="emerald"
              />
              <KPICard
                icon={<SkipForward className="w-4 h-4 text-amber-400" />}
                label="Tour Skips"
                value={onboardingData?.tourSkips ?? 0}
                accent="amber"
              />
              <KPICard
                icon={<TrendingUp className="w-4 h-4 text-purple-400" />}
                label="Completion Rate"
                value={`${onboardingData?.completionRate ?? 0}%`}
                accent="purple"
              />
              <KPICard
                icon={<Activity className="w-4 h-4 text-rose-400" />}
                label="Avg Skip Step"
                value={onboardingData?.avgSkipStep ?? "—"}
                accent="blue"
              />
            </>
          )}
        </motion.div>

        {/* Onboarding Funnel + Feature Usage + Tooltip Dismissals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div variants={fadeInUp} className="section-card">
            <div className="h-[2px] bg-gradient-to-r from-cyan-500 to-blue-400 opacity-40" />
            <div className="px-4 py-3 border-b border-border/15 flex items-center gap-2">
              <GraduationCap className="w-3.5 h-3.5 text-cyan-400/70" />
              <h2 className="font-display text-[13px] font-semibold tracking-tight">Tour Step Funnel</h2>
              <button onClick={() => downloadCsv("funnel")} className="ml-auto p-1 rounded hover:bg-accent/50 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" title="Export funnel data"><Download className="w-3 h-3" /></button>
            </div>
            <div className="p-4">
              {onboardingLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 rounded" />)}
                </div>
              ) : onboardingData?.stepFunnel && onboardingData.stepFunnel.length > 0 ? (
                <div className="space-y-1">
                  {onboardingData.stepFunnel.map((s, i) => {
                    const max = onboardingData.stepFunnel[0]?.sessions || 1;
                    return (
                      <div key={i} className="relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-cyan-500/10 rounded"
                          style={{ width: `${(s.sessions / max) * 100}%` }}
                        />
                        <div className="relative flex items-center justify-between px-3 py-1">
                          <span className="text-[11px] font-mono text-foreground/70">Step {s.step}</span>
                          <span className="text-[11px] font-mono text-cyan-400">{s.sessions} sessions</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground/40">No funnel data yet</div>
              )}
            </div>
          </motion.div>

          <motion.div variants={fadeInUp} className="section-card">
            <div className="h-[2px] bg-gradient-to-r from-emerald-500 to-teal-400 opacity-40" />
            <div className="px-4 py-3 border-b border-border/15 flex items-center gap-2">
              <MousePointerClick className="w-3.5 h-3.5 text-emerald-400/70" />
              <h2 className="font-display text-[13px] font-semibold tracking-tight">Feature First Use</h2>
              <button onClick={() => downloadCsv("features")} className="ml-auto p-1 rounded hover:bg-accent/50 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" title="Export feature data"><Download className="w-3 h-3" /></button>
            </div>
            <div className="p-4">
              {onboardingLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 rounded" />)}
                </div>
              ) : onboardingData?.featureUsage && onboardingData.featureUsage.length > 0 ? (
                <div className="space-y-1">
                  {onboardingData.featureUsage.map((f, i) => {
                    const max = onboardingData.featureUsage[0]?.sessions || 1;
                    return (
                      <div key={i} className="relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-emerald-500/10 rounded"
                          style={{ width: `${(f.sessions / max) * 100}%` }}
                        />
                        <div className="relative flex items-center justify-between px-3 py-1">
                          <span className="text-[11px] font-mono text-foreground/70">{f.feature}</span>
                          <span className="text-[11px] font-mono text-emerald-400">{f.sessions}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground/40">No feature usage data yet</div>
              )}
            </div>
          </motion.div>

          <motion.div variants={fadeInUp} className="section-card">
            <div className="h-[2px] bg-gradient-to-r from-amber-500 to-orange-400 opacity-40" />
            <div className="px-4 py-3 border-b border-border/15 flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400/70" />
              <h2 className="font-display text-[13px] font-semibold tracking-tight">Tooltip Dismissals</h2>
              <button onClick={() => downloadCsv("tooltips")} className="ml-auto p-1 rounded hover:bg-accent/50 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" title="Export tooltip data"><Download className="w-3 h-3" /></button>
            </div>
            <div className="p-4">
              {onboardingLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 rounded" />)}
                </div>
              ) : onboardingData?.tooltipDismissals && onboardingData.tooltipDismissals.length > 0 ? (
                <div className="space-y-1">
                  {onboardingData.tooltipDismissals.map((t, i) => {
                    const max = onboardingData.tooltipDismissals[0]?.count || 1;
                    return (
                      <div key={i} className="relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-amber-500/10 rounded"
                          style={{ width: `${(t.count / max) * 100}%` }}
                        />
                        <div className="relative flex items-center justify-between px-3 py-1">
                          <span className="text-[11px] font-mono text-foreground/70">{t.tooltip}</span>
                          <span className="text-[11px] font-mono text-amber-400">{t.count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground/40">No tooltip data yet</div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Page Discovery Funnel */}
        <motion.div variants={fadeInUp} className="section-card">
          <div className="h-[2px] bg-gradient-to-r from-rose-500 to-pink-400 opacity-40" />
          <div className="px-4 py-3 border-b border-border/15 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-rose-400/70" />
            <h2 className="font-display text-[13px] font-semibold tracking-tight">Page Discovery Funnel</h2>
            <span className="ml-auto text-[10px] text-muted-foreground/40 mr-2">Which pages new users visit first</span>
            <button onClick={() => downloadCsv("pages")} className="p-1 rounded hover:bg-accent/50 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" title="Export page data"><Download className="w-3 h-3" /></button>
          </div>
          <div className="p-4">
            {onboardingLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : onboardingData?.pageDiscovery && onboardingData.pageDiscovery.length > 0 ? (
              <div className="space-y-1.5">
                {onboardingData.pageDiscovery.map((p, i) => {
                  const max = onboardingData.pageDiscovery[0]?.sessions || 1;
                  const pct = Math.round((p.sessions / max) * 100);
                  return (
                    <div key={i} className="relative">
                      <div
                        className="absolute inset-y-0 left-0 bg-rose-500/10 rounded"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center justify-between px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground/40 w-4">#{i + 1}</span>
                          <span className="text-[11px] font-mono text-foreground/70 capitalize">{p.page.replace(/-/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground/30">{pct}%</span>
                          <span className="text-[11px] font-mono text-rose-400">{p.sessions}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground/40">
                No page discovery data yet. Data will appear as new users explore the app.
              </div>
            )}
          </div>
        </motion.div>

        {/* Conversion Velocity */}
        <motion.div variants={fadeInUp} className="section-card">
          <div className="h-[2px] bg-gradient-to-r from-teal-500 to-emerald-400 opacity-40" />
          <div className="px-4 py-3 border-b border-border/15 flex items-center gap-2">
            <Timer className="w-3.5 h-3.5 text-teal-400/70" />
            <h2 className="font-display text-[13px] font-semibold tracking-tight">Conversion Velocity</h2>
            <span className="ml-auto text-[10px] text-muted-foreground/40 mr-2">Time from tour completion to first meaningful action</span>
            <button onClick={() => downloadCsv("velocity")} className="p-1 rounded hover:bg-accent/50 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" title="Export velocity data"><Download className="w-3 h-3" /></button>
          </div>
          <div className="p-4">
            {onboardingLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded" />)}
              </div>
            ) : onboardingData?.conversionVelocity ? (
              <div className="space-y-4">
                {/* KPI Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-accent/30 border border-border/10 p-3 text-center">
                    <div className="text-[10px] text-muted-foreground/40 mb-1">Avg Time</div>
                    <div className="text-lg font-display font-bold text-teal-400">
                      {formatDuration(onboardingData.conversionVelocity.avgSeconds)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-accent/30 border border-border/10 p-3 text-center">
                    <div className="text-[10px] text-muted-foreground/40 mb-1">Median Time</div>
                    <div className="text-lg font-display font-bold text-emerald-400">
                      {formatDuration(onboardingData.conversionVelocity.medianSeconds)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-accent/30 border border-border/10 p-3 text-center">
                    <div className="text-[10px] text-muted-foreground/40 mb-1">Converted</div>
                    <div className="text-lg font-display font-bold">
                      {onboardingData.conversionVelocity.totalConverted}
                    </div>
                  </div>
                </div>
                {/* First Action Breakdown */}
                {onboardingData.conversionVelocity.actions.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium">First Action Breakdown</div>
                    {onboardingData.conversionVelocity.actions.map((a) => (
                      <div key={a.action} className="flex items-center gap-3 py-1.5">
                        <ArrowRight className="w-3 h-3 text-teal-400/50 flex-shrink-0" />
                        <span className="text-xs font-medium flex-1 truncate">{a.action}</span>
                        <span className="text-[10px] text-muted-foreground/50 font-mono">{a.count} users</span>
                        <span className="text-xs font-mono font-semibold text-teal-400">{formatDuration(a.avgSeconds)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground/40">
                No conversion data yet. Data will appear after users complete the tour and take actions.
              </div>
            )}
          </div>
        </motion.div>

        {/* A/B Test Variant Comparison */}
        <motion.div variants={fadeInUp} className="section-card">
          <div className="h-[2px] bg-gradient-to-r from-indigo-500 to-violet-400 opacity-40" />
          <div className="px-4 py-3 border-b border-border/15 flex items-center gap-2">
            <FlaskConical className="w-3.5 h-3.5 text-indigo-400/70" />
            <h2 className="font-display text-[13px] font-semibold tracking-tight">A/B Test: Tour Variant Comparison</h2>
            <span className="ml-auto text-[10px] text-muted-foreground/40 mr-2">Quick Tour (6 steps) vs Full Tour (12 steps)</span>
            <button onClick={() => downloadCsv("variants")} className="p-1 rounded hover:bg-accent/50 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" title="Export variant data"><Download className="w-3 h-3" /></button>
          </div>
          <div className="p-4">
            {onboardingLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 rounded" />)}
              </div>
            ) : onboardingData?.variantComparison && onboardingData.variantComparison.length > 0 ? (
              <div className="space-y-3">
                {onboardingData.variantComparison.map((v) => {
                  const isQuick = v.variant === 'quick_tour';
                  const color = isQuick ? 'cyan' : 'violet';
                  return (
                    <div key={v.variant} className="rounded-lg bg-accent/30 border border-border/10 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`}>
                            {isQuick ? 'Quick Tour' : 'Full Tour'}
                          </span>
                          <span className="text-[10px] text-muted-foreground/40">{isQuick ? '6 steps' : '12 steps'}</span>
                        </div>
                        <span className={`text-lg font-display font-bold text-${color}-400`}>{v.completionRate}%</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground/40 mb-0.5">Starts</div>
                          <div className="text-sm font-mono font-semibold">{v.starts}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground/40 mb-0.5">Completes</div>
                          <div className="text-sm font-mono font-semibold text-emerald-400">{v.completes}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground/40 mb-0.5">Skips</div>
                          <div className="text-sm font-mono font-semibold text-amber-400">{v.skips}</div>
                        </div>
                      </div>
                      {/* Completion bar */}
                      <div className="mt-2 h-1.5 bg-border/20 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${isQuick ? 'from-cyan-500 to-cyan-400' : 'from-violet-500 to-violet-400'}`}
                          style={{ width: `${v.completionRate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground/40">
                No A/B test data yet. Data will appear as users go through the onboarding tour.
              </div>
            )}
          </div>
          {/* Variant Override Toggle */}
          <div className="px-4 py-3 border-t border-border/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-foreground/70">Variant Override</div>
                <div className="text-[10px] text-muted-foreground/40 mt-0.5">
                  {!variantOverride?.override ? "Random 50/50 assignment" : `Forcing all new users to ${variantOverride.override === 'quick_tour' ? 'Quick Tour' : 'Full Tour'}`}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setVariantOverrideMutation.mutate({ variant: null })}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-semibold transition-colors ${
                    !variantOverride?.override ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-accent/30 text-muted-foreground/50 border border-border/10 hover:bg-accent/50'
                  }`}
                >
                  Random
                </button>
                <button
                  onClick={() => setVariantOverrideMutation.mutate({ variant: "quick_tour" })}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-semibold transition-colors ${
                    variantOverride?.override === 'quick_tour' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-accent/30 text-muted-foreground/50 border border-border/10 hover:bg-accent/50'
                  }`}
                >
                  Quick
                </button>
                <button
                  onClick={() => setVariantOverrideMutation.mutate({ variant: "full_tour" })}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-semibold transition-colors ${
                    variantOverride?.override === 'full_tour' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-accent/30 text-muted-foreground/50 border border-border/10 hover:bg-accent/50'
                  }`}
                >
                  Full
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Cohort Retention */}
        <motion.div variants={fadeInUp} className="section-card">
          <div className="h-[2px] bg-gradient-to-r from-cyan-500 to-cyan-400 opacity-40" />
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h3 className="font-display text-sm font-semibold">Cohort Retention</h3>
                <span className="text-[10px] text-muted-foreground/50">Users returning after signup</span>
              </div>
            </div>

            {cohortLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !cohortData?.cohorts?.length ? (
              <div className="text-center py-8 text-muted-foreground/50 text-sm">No cohort data yet</div>
            ) : (
              <div className="space-y-4">
                {/* Retention chart — horizontal bars */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-border/15">
                        <th className="text-left py-2 pr-3 font-mono text-muted-foreground/50 font-medium">Week</th>
                        <th className="text-center py-2 px-2 font-mono text-muted-foreground/50 font-medium">Signups</th>
                        <th className="text-center py-2 px-2 font-mono text-muted-foreground/50 font-medium">Day 1</th>
                        <th className="text-center py-2 px-2 font-mono text-muted-foreground/50 font-medium">Day 7</th>
                        <th className="text-center py-2 px-2 font-mono text-muted-foreground/50 font-medium">Day 30</th>
                        <th className="text-left py-2 pl-3 font-mono text-muted-foreground/50 font-medium w-48">Retention Curve</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohortData.cohorts.map((cohort) => {
                        const d1Pct = cohort.signups > 0 ? Math.round((cohort.day1 / cohort.signups) * 100) : 0;
                        const d7Pct = cohort.signups > 0 ? Math.round((cohort.day7 / cohort.signups) * 100) : 0;
                        const d30Pct = cohort.signups > 0 ? Math.round((cohort.day30 / cohort.signups) * 100) : 0;
                        return (
                          <tr key={cohort.week} className="border-b border-border/10 hover:bg-accent/5">
                            <td className="py-2.5 pr-3 font-mono text-muted-foreground/70">{cohort.week}</td>
                            <td className="py-2.5 px-2 text-center font-semibold">{cohort.signups}</td>
                            <td className="py-2.5 px-2 text-center">
                              <span className={`font-mono ${d1Pct >= 50 ? 'text-emerald' : d1Pct >= 25 ? 'text-amber' : 'text-muted-foreground/60'}`}>
                                {d1Pct}%
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className={`font-mono ${d7Pct >= 30 ? 'text-emerald' : d7Pct >= 15 ? 'text-amber' : 'text-muted-foreground/60'}`}>
                                {d7Pct}%
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className={`font-mono ${d30Pct >= 20 ? 'text-emerald' : d30Pct >= 10 ? 'text-amber' : 'text-muted-foreground/60'}`}>
                                {d30Pct}%
                              </span>
                            </td>
                            <td className="py-2.5 pl-3">
                              <div className="flex items-center gap-1 h-5">
                                {/* Mini retention curve visualization */}
                                <div className="flex-1 flex items-end gap-[2px] h-full">
                                  <div
                                    className="flex-1 rounded-sm bg-emerald/60 transition-all"
                                    style={{ height: `${Math.max(d1Pct, 4)}%` }}
                                    title={`Day 1: ${d1Pct}%`}
                                  />
                                  <div
                                    className="flex-1 rounded-sm bg-blue-400/60 transition-all"
                                    style={{ height: `${Math.max(d7Pct, 4)}%` }}
                                    title={`Day 7: ${d7Pct}%`}
                                  />
                                  <div
                                    className="flex-1 rounded-sm bg-purple-400/60 transition-all"
                                    style={{ height: `${Math.max(d30Pct, 4)}%` }}
                                    title={`Day 30: ${d30Pct}%`}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground/50">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-emerald/60" />
                    <span>Day 1</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-blue-400/60" />
                    <span>Day 7</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-purple-400/60" />
                    <span>Day 30</span>
                  </div>
                  <span className="ml-auto font-mono">Color: green ≥ good, amber = moderate, gray = low</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.main>
    </div>
  );
}

function KPICard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent: string }) {
  const gradients: Record<string, string> = {
    blue: "from-blue-500 to-blue-400",
    emerald: "from-emerald-500 to-emerald-400",
    amber: "from-amber-500 to-amber-400",
    purple: "from-purple-500 to-violet-400",
  };
  return (
    <div className="section-card">
      <div className={`h-[2px] bg-gradient-to-r ${gradients[accent] || gradients.blue} opacity-40`} />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">{label}</span>
        </div>
        <div className="font-display text-2xl font-bold tracking-tight">{value}</div>
      </div>
    </div>
  );
}
