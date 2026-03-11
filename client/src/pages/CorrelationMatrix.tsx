import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { AppHeader } from "@/components/AppHeader";
import {
  Grid3X3, AlertTriangle, Shield, TrendingUp, TrendingDown, Layers,
  ArrowRight, Info, RefreshCw,
} from "lucide-react";

export default function CorrelationMatrix() {
  const { data: matrixData, isLoading, refetch } = trpc.intelligence.getCorrelationMatrix.useQuery({ lookbackDays: 30 });
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const selectedCorrelations = useMemo(() => {
    if (!matrixData || !selectedTicker) return [];
    const idx = matrixData.tickers.indexOf(selectedTicker);
    if (idx === -1) return [];
    return matrixData.tickers.map((t, i) => ({
      ticker: t,
      correlation: matrixData.matrix[idx][i],
    })).filter(c => c.ticker !== selectedTicker).sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }, [matrixData, selectedTicker]);

  function getCorrColor(corr: number): string {
    if (corr >= 0.7) return "bg-red-600";
    if (corr >= 0.5) return "bg-red-500/80";
    if (corr >= 0.3) return "bg-orange-500/60";
    if (corr >= 0.1) return "bg-yellow-500/30";
    if (corr > -0.1) return "bg-zinc-700/40";
    if (corr > -0.3) return "bg-cyan-500/30";
    if (corr > -0.5) return "bg-green-500/50";
    if (corr > -0.7) return "bg-green-500/70";
    return "bg-green-600";
  }

  function getCorrTextColor(corr: number): string {
    if (Math.abs(corr) >= 0.5) return "text-white";
    return "text-foreground";
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="container max-w-7xl py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Grid3X3 className="w-8 h-8 text-cyan-500" />
              Correlation Matrix
            </h1>
            <p className="text-muted-foreground mt-1">
              Alpha Score correlation analysis — identify hidden concentration, diversification, and contagion risk
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">
            <Grid3X3 className="w-12 h-12 mx-auto mb-3 opacity-40 animate-pulse" />
            <p>Computing correlation matrix...</p>
          </div>
        ) : matrixData ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-cyan-400">{matrixData.tickers.length}</div>
                <div className="text-xs text-muted-foreground">Tickers Tracked</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${matrixData.diversificationScore >= 60 ? "text-emerald-400" : matrixData.diversificationScore >= 40 ? "text-amber-400" : "text-red-400"}`}>
                  {matrixData.diversificationScore}
                </div>
                <div className="text-xs text-muted-foreground">Diversification Score</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-violet-400">{matrixData.clusters.length}</div>
                <div className="text-xs text-muted-foreground">Clusters Found</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-400">{matrixData.contagionRisks.length}</div>
                <div className="text-xs text-muted-foreground">Contagion Risks</div>
              </div>
            </div>

            {/* Color Legend */}
            <div className="flex items-center justify-center gap-1 mb-6">
              <span className="text-xs text-muted-foreground mr-2">Inversely Correlated</span>
              <div className="w-6 h-4 rounded bg-green-600" />
              <div className="w-6 h-4 rounded bg-green-500/70" />
              <div className="w-6 h-4 rounded bg-cyan-500/30" />
              <div className="w-6 h-4 rounded bg-zinc-700/40" />
              <div className="w-6 h-4 rounded bg-yellow-500/30" />
              <div className="w-6 h-4 rounded bg-orange-500/60" />
              <div className="w-6 h-4 rounded bg-red-500/80" />
              <div className="w-6 h-4 rounded bg-red-600" />
              <span className="text-xs text-muted-foreground ml-2">Highly Correlated</span>
            </div>

            {/* Heatmap Grid */}
            <div className="bg-card border border-border rounded-xl p-4 mb-8 overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Column Headers */}
                <div className="flex">
                  <div className="w-16 shrink-0" />
                  {matrixData.tickers.map((ticker, colIdx) => (
                    <div
                      key={ticker}
                      className={`flex-1 text-center text-xs font-medium py-1 cursor-pointer transition-colors ${
                        selectedTicker === ticker ? "text-cyan-400" : "text-muted-foreground hover:text-foreground"
                      }`}
                      style={{ writingMode: "vertical-lr", transform: "rotate(180deg)", height: "60px" }}
                      onClick={() => setSelectedTicker(selectedTicker === ticker ? null : ticker)}
                    >
                      {ticker}
                    </div>
                  ))}
                </div>

                {/* Matrix Rows */}
                {matrixData.tickers.map((rowTicker, rowIdx) => (
                  <div key={rowTicker} className="flex">
                    <div
                      className={`w-16 shrink-0 text-xs font-medium flex items-center cursor-pointer transition-colors ${
                        selectedTicker === rowTicker ? "text-cyan-400" : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setSelectedTicker(selectedTicker === rowTicker ? null : rowTicker)}
                    >
                      {rowTicker}
                    </div>
                    {matrixData.tickers.map((colTicker, colIdx) => {
                      const corr = matrixData.matrix[rowIdx][colIdx];
                      const isHovered = hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx;
                      const isSelected = selectedTicker === rowTicker || selectedTicker === colTicker;
                      return (
                        <div
                          key={colTicker}
                          className={`flex-1 aspect-square flex items-center justify-center text-xs font-medium rounded-sm m-px transition-all cursor-pointer ${getCorrColor(corr)} ${getCorrTextColor(corr)} ${
                            isHovered ? "ring-2 ring-white scale-110 z-10" : ""
                          } ${isSelected ? "ring-1 ring-cyan-400/50" : ""}`}
                          onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() => setSelectedTicker(selectedTicker === rowTicker ? null : rowTicker)}
                          title={`${rowTicker} × ${colTicker}: ${corr.toFixed(2)}`}
                        >
                          {corr.toFixed(1)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Ticker Detail */}
            {selectedTicker && selectedCorrelations.length > 0 && (
              <div className="bg-card border border-cyan-500/30 rounded-xl p-5 mb-8">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  {selectedTicker} Correlations
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {selectedCorrelations.map(c => (
                    <div key={c.ticker} className="bg-muted/30 rounded-lg p-3 flex items-center justify-between">
                      <span className="font-medium text-sm">{c.ticker}</span>
                      <span className={`text-sm font-bold ${
                        c.correlation >= 0.5 ? "text-red-400" :
                        c.correlation >= 0.2 ? "text-amber-400" :
                        c.correlation > -0.2 ? "text-muted-foreground" :
                        c.correlation > -0.5 ? "text-cyan-400" :
                        "text-emerald-400"
                      }`}>
                        {c.correlation >= 0 ? "+" : ""}{c.correlation.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clusters */}
            {matrixData.clusters.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-violet-400" />
                  Identified Clusters
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matrixData.clusters.map((cluster: any, idx: number) => (
                    <div key={idx} className={`rounded-lg p-4 border ${
                      cluster.riskLevel === "high" ? "border-red-500/30 bg-red-500/5" :
                      cluster.riskLevel === "medium" ? "border-amber-500/30 bg-amber-500/5" :
                      "border-emerald-500/30 bg-emerald-500/5"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{cluster.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          cluster.riskLevel === "high" ? "bg-red-500/20 text-red-400" :
                          cluster.riskLevel === "medium" ? "bg-amber-500/20 text-amber-400" :
                          "bg-emerald-500/20 text-emerald-400"
                        }`}>
                          {cluster.riskLevel} concentration
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {cluster.tickers.map((t: string) => (
                          <span key={t} className="px-2 py-0.5 bg-muted rounded text-xs font-medium">{t}</span>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Avg correlation: <span className="font-medium text-foreground">{cluster.avgCorrelation.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contagion Risks */}
            {matrixData.contagionRisks.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Contagion Risks
                </h3>
                <div className="space-y-3">
                  {matrixData.contagionRisks.map((risk: any, idx: number) => (
                    <div key={idx} className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-amber-400">{risk.sourceTicker}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        <div className="flex flex-wrap gap-1">
                          {risk.affectedTickers.map((t: string) => (
                            <span key={t} className="px-2 py-0.5 bg-amber-500/20 rounded text-xs font-medium text-amber-300">{t}</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{risk.riskDescription}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <Info className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No correlation data available</p>
          </div>
        )}
      </main>
    </div>
  );
}
