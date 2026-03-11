import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen, CheckCircle2, XCircle, TrendingUp, TrendingDown,
  DollarSign, Target, Percent, Award, ArrowUpRight, ArrowDownRight,
  Clock, Zap, RefreshCw, BarChart3, Download, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function StatCard({ icon: Icon, label, value, subtext, color }: {
  icon: any; label: string; value: string; subtext?: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TradeJournal() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<"all" | "correct" | "incorrect">("all");

  const { data: entries, isLoading, refetch } = trpc.intelligence.getJournalEntries.useQuery(
    { limit: 50, offset: 0 },
    { refetchInterval: 60000 }
  );

  const { data: stats } = trpc.intelligence.getJournalStats.useQuery(
    undefined,
    { refetchInterval: 60000 }
  );

  const journalEntries = entries || [];
  const filteredEntries = filter === "all"
    ? journalEntries
    : journalEntries.filter((e: any) => filter === "correct" ? e.isCorrect : !e.isCorrect);

  const winRate = stats?.winRate ?? 0;
  const avgReturn = stats?.averageReturn ?? 0;
  const totalTrades = stats?.totalEntries ?? 0;
  const bestCall = stats?.bestCall;
  const worstCall = stats?.worstCall;

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-purple-400" />
            Trade Journal
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automated prediction outcome tracking with P&L calculations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              const result = await fetch("/api/trpc/intelligence.exportTradeJournalCsv").then(r => r.json());
              const csvData = result?.result?.data?.json?.data;
              if (!csvData) { toast.error("No data to export"); return; }
              const blob = new Blob([csvData], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = result.result.data.json.filename || "trade-journal.csv";
              a.click();
              URL.revokeObjectURL(url);
              toast.success("CSV exported");
            } catch { toast.error("Export failed"); }
          }} className="gap-1">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          icon={Target}
          label="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          subtext={`${totalTrades} resolved`}
          color="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          icon={DollarSign}
          label="Avg Return"
          value={`${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(2)}%`}
          color={avgReturn >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}
        />
        <StatCard
          icon={CheckCircle2}
          label="Correct Calls"
          value={`${stats?.correctPredictions ?? 0}`}
          color="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          icon={XCircle}
          label="Incorrect Calls"
          value={`${stats?.incorrectPredictions ?? 0}`}
          color="bg-red-500/10 text-red-400"
        />
        <StatCard
          icon={Award}
          label="Best Call"
          value={bestCall ? `${bestCall.ticker} ${bestCall.priceChange >= 0 ? "+" : ""}${bestCall.priceChange.toFixed(1)}%` : "—"}
          subtext={bestCall?.signalSource?.label || undefined}
          color="bg-amber-500/10 text-amber-400"
        />
      </div>

      {/* Signal Source Breakdown */}
      {stats?.bySource && Object.keys(stats.bySource).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Win Rate by Signal Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(stats.bySource).map(([source, data]: [string, any]) => (
                <div key={source} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground capitalize mb-1">
                    {source.replace(/_/g, " ")}
                  </p>
                  <p className="text-lg font-bold">
                    {data.winRate.toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.total} trades
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          className="text-xs"
        >
          All ({journalEntries.length})
        </Button>
        <Button
          variant={filter === "correct" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("correct")}
          className="text-xs gap-1"
        >
          <CheckCircle2 className="h-3 w-3" />
          Correct ({journalEntries.filter((e: any) => e.isCorrect).length})
        </Button>
        <Button
          variant={filter === "incorrect" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("incorrect")}
          className="text-xs gap-1"
        >
          <XCircle className="h-3 w-3" />
          Incorrect ({journalEntries.filter((e: any) => !e.isCorrect).length})
        </Button>
      </div>

      {/* Journal Entries */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-16 bg-muted/30 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))
        ) : filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No journal entries yet</p>
              <p className="text-xs mt-1">Predictions will be automatically logged when they resolve (7-day window)</p>
            </CardContent>
          </Card>
        ) : (
          filteredEntries.map((entry: any) => (
            <Card
              key={entry.id}
              className={`cursor-pointer hover:border-border transition-colors ${
                entry.isCorrect ? "border-emerald-500/20" : "border-red-500/20"
              }`}
              onClick={() => navigate(`/predictions?ticker=${entry.ticker}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {/* Result Icon */}
                    <div className={`mt-0.5 p-1.5 rounded-full ${
                      entry.isCorrect ? "bg-emerald-500/10" : "bg-red-500/10"
                    }`}>
                      {entry.isCorrect ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold">{entry.ticker}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            entry.predictedDirection === "up"
                              ? "text-emerald-400 border-emerald-400/30"
                              : "text-red-400 border-red-400/30"
                          }`}
                        >
                          {entry.predictedDirection === "up" ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          Predicted {entry.predictedDirection}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            entry.priceChange >= 0
                              ? "text-emerald-400 border-emerald-400/30"
                              : "text-red-400 border-red-400/30"
                          }`}
                        >
                          Actual: {entry.priceChange >= 0 ? "+" : ""}{entry.priceChange.toFixed(2)}%
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground mb-2">
                        {entry.reasoning}
                      </p>

                      <div className="flex items-center gap-3 text-xs">
                        {/* Signal Source */}
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Zap className="h-3 w-3" />
                          {entry.signalSource?.label || "AI Research"}
                        </span>

                        {/* Confidence */}
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Percent className="h-3 w-3" />
                          {entry.predictedConfidence}% confidence
                        </span>

                        {/* Earnings proximity marker */}
                        {entry.alphaScoreAtEntry && entry.alphaScoreAtEntry > 60 && (
                          <span className="flex items-center gap-1 text-orange-400">
                            <Calendar className="h-3 w-3" />
                            Earnings Window
                          </span>
                        )}

                        {/* Resolved time */}
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(entry.resolutionDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* P&L */}
                  <div className="text-right">
                    {entry.hypotheticalPnl !== null && entry.hypotheticalPnl !== undefined ? (
                      <div>
                        <p className={`text-sm font-bold flex items-center gap-0.5 justify-end ${
                          entry.hypotheticalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {entry.hypotheticalPnl >= 0 ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          ${Math.abs(entry.hypotheticalPnl).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.portfolioShares} shares
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No position</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Worst Call */}
      {worstCall && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-muted-foreground">Worst call:</span>
              <span className="font-bold">{worstCall.ticker}</span>
              <span className="text-red-400">
                {worstCall.priceChange >= 0 ? "+" : ""}{worstCall.priceChange.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                Source: {worstCall.signalSource?.label || "AI Research"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
