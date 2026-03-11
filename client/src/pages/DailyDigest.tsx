import { trpc } from "@/lib/trpc";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Mail, Clock, Settings, Send, Eye, History,
  TrendingUp, Zap, BookOpen, Grid3X3, Target,
  CheckCircle, XCircle, Loader2,
} from "lucide-react";
import { useState } from "react";

export default function DailyDigest() {
  const utils = trpc.useUtils();
  const { data: config, isLoading: configLoading } = trpc.intelligence.getDigestConfig.useQuery();
  const { data: history, isLoading: historyLoading } = trpc.intelligence.getDigestHistory.useQuery({ limit: 10 });
  const { data: preview, isLoading: previewLoading } = trpc.intelligence.previewDigest.useQuery();

  const updateConfig = trpc.intelligence.updateDigestConfig.useMutation({
    onSuccess: () => utils.intelligence.getDigestConfig.invalidate(),
  });
  const sendNow = trpc.intelligence.sendDigestNow.useMutation({
    onSuccess: () => {
      utils.intelligence.getDigestHistory.invalidate();
      utils.intelligence.getLatestDigest.invalidate();
    },
  });

  const [showPreview, setShowPreview] = useState(true);

  const toggleSection = (key: string, value: boolean) => {
    updateConfig.mutate({ [key]: value } as any);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <div className="container max-w-5xl py-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6 text-purple-400" />
              Daily Alpha Digest
            </h1>
            <p className="text-muted-foreground mt-1">
              Automated daily summary of Alpha Score changes, signals, and opportunities
            </p>
          </div>
          <Button
            onClick={() => sendNow.mutate()}
            disabled={sendNow.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {sendNow.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Now
          </Button>
        </div>

        {configLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="h-16 bg-muted/30 animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : config ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Settings Column */}
            <div className="lg:col-span-1 space-y-4">
              {/* Master Toggle */}
              <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4 text-purple-400" />
                    Digest Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Enable Digest</p>
                      <p className="text-xs text-muted-foreground">Daily summary notifications</p>
                    </div>
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(v) => toggleSection("enabled", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Send Time</p>
                      <p className="text-xs text-muted-foreground">Daily at this hour (ET)</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <select
                        value={config.sendHour}
                        onChange={(e) => updateConfig.mutate({ sendHour: parseInt(e.target.value) })}
                        className="bg-muted/30 border border-border/50 rounded px-2 py-1 text-sm"
                      >
                        {Array.from({ length: 24 }).map((_, h) => (
                          <option key={h} value={h}>
                            {h === 0 ? "12:00 AM" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Content Sections */}
              <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Include in Digest</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <DigestToggle
                    icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
                    label="Top Alpha Movers"
                    description="Top 5 tickers by Alpha Score change"
                    checked={config.includeTopMovers}
                    onChange={(v) => toggleSection("includeTopMovers", v)}
                  />
                  <DigestToggle
                    icon={<Zap className="h-4 w-4 text-amber-400" />}
                    label="Arbitrage Signals"
                    description="New market vs AI disagreements"
                    checked={config.includeArbitrageSignals}
                    onChange={(v) => toggleSection("includeArbitrageSignals", v)}
                  />
                  <DigestToggle
                    icon={<BookOpen className="h-4 w-4 text-blue-400" />}
                    label="Journal Results"
                    description="Yesterday's prediction outcomes"
                    checked={config.includeJournalResults}
                    onChange={(v) => toggleSection("includeJournalResults", v)}
                  />
                  <DigestToggle
                    icon={<Grid3X3 className="h-4 w-4 text-purple-400" />}
                    label="Sector Summary"
                    description="Sector with most alpha concentration"
                    checked={config.includeSectorSummary}
                    onChange={(v) => toggleSection("includeSectorSummary", v)}
                  />
                  <DigestToggle
                    icon={<Target className="h-4 w-4 text-red-400" />}
                    label="Top Opportunities"
                    description="Highest Alpha Score tickers"
                    checked={config.includeTopOpportunities}
                    onChange={(v) => toggleSection("includeTopOpportunities", v)}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Preview & History Column */}
            <div className="lg:col-span-2 space-y-4">
              {/* Preview */}
              <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4 text-blue-400" />
                      Digest Preview
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPreview(!showPreview)}
                      className="text-xs"
                    >
                      {showPreview ? "Collapse" : "Expand"}
                    </Button>
                  </div>
                </CardHeader>
                {showPreview && (
                  <CardContent>
                    {previewLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating preview...
                      </div>
                    ) : preview ? (
                      <div className="bg-muted/20 rounded-lg p-4 border border-border/30 space-y-4">
                        <p className="text-xs text-muted-foreground italic">{preview.summaryLine}</p>
                        
                        {/* Top Movers */}
                        {preview.topMovers.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                              Top Alpha Movers
                            </p>
                            <div className="space-y-1">
                              {preview.topMovers.map((m, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                  <span className="font-mono">{m.ticker}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Score: {m.score}</span>
                                    <span className={m.change24h >= 0 ? "text-emerald-400" : "text-red-400"}>
                                      {m.change24h >= 0 ? "+" : ""}{m.change24h.toFixed(1)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Arbitrage Signals */}
                        {preview.arbitrageSignals.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                              Arbitrage Signals
                            </p>
                            <div className="space-y-1">
                              {preview.arbitrageSignals.map((s, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                  <span className="font-mono">{s.ticker}</span>
                                  <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400">
                                    {s.strength} ({s.divergence.toFixed(0)}% divergence)
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sector Summary */}
                        {preview.topSector && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                              Sector with Most Alpha
                            </p>
                            <p className="text-sm">
                              <span className="font-medium text-purple-400">{preview.topSector.sector}</span>
                              {" — "}Avg Score: {preview.topSector.avgAlphaScore.toFixed(0)}, {preview.topSector.tickerCount} tickers
                              {" — "}Top: {preview.topSector.topTicker} ({preview.topSector.topScore})
                            </p>
                          </div>
                        )}

                        {/* Journal Summary */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                            Yesterday's Results
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                              {preview.journalSummary.correctPredictions} correct
                            </span>
                            <span className="flex items-center gap-1">
                              <XCircle className="h-3.5 w-3.5 text-red-400" />
                              {preview.journalSummary.totalResolved - preview.journalSummary.correctPredictions} incorrect
                            </span>
                            <span className="text-muted-foreground">
                              Win Rate: {preview.journalSummary.winRate.toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        {/* Top Opportunities */}
                        {preview.topOpportunities.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                              Top Opportunities
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {preview.topOpportunities.map((t, i) => (
                                <Badge key={i} variant="outline" className="border-purple-500/40 text-purple-400">
                                  {t.ticker}: {t.score}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No preview available</p>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* History */}
              <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Digest History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {historyLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-12 bg-muted/30 animate-pulse rounded" />
                      ))}
                    </div>
                  ) : history && history.length > 0 ? (
                    <div className="space-y-2">
                      {history.map((entry, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-muted/10 border border-border/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${entry.sendSuccess ? "bg-emerald-400" : "bg-amber-400"}`} />
                            <div>
                              <p className="text-sm font-medium">{entry.content.summaryLine || `Digest #${entry.id.slice(0, 6)}`}</p>
                              <p className="text-xs text-muted-foreground">
                                {entry.sentAt ? new Date(entry.sentAt).toLocaleString("en-US", {
                                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                                }) : "Pending"}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={entry.sendSuccess ? "border-emerald-500/50 text-emerald-400" : "border-amber-500/50 text-amber-400"}
                          >
                            {entry.sendSuccess ? "Sent" : "Failed"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No digests sent yet. Click "Send Now" to generate your first digest.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DigestToggle({ icon, label, description, checked, onChange }: {
  icon: React.ReactNode; label: string; description: string;
  checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2.5">
        {icon}
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
