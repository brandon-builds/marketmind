import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, Minus, BarChart3, RefreshCw,
  Flame, DollarSign, ExternalLink, Activity,
} from "lucide-react";

export function PredictionMarketsWidget() {
  const marketsQuery = trpc.intelligence.getMarkets.useQuery(
    { limit: 10 },
    { refetchInterval: 120000 } // Refresh every 2 min
  );
  const statsQuery = trpc.intelligence.getMarketStats.useQuery(
    undefined,
    { refetchInterval: 120000 }
  );

  const markets = marketsQuery.data || [];
  const stats = statsQuery.data;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-gradient-to-r from-purple-500/5 to-pink-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-purple-500/20 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Prediction Markets
            </h3>
            {stats?.realDataAvailable && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                REAL DATA
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
            {stats && (
              <span>{stats.totalMarkets} markets</span>
            )}
            <button
              onClick={() => marketsQuery.refetch()}
              className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${marketsQuery.isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Platform Stats */}
      {stats && (
        <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center gap-4 text-[10px] text-[var(--color-text-tertiary)]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Polymarket: {stats.polymarketCount}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Kalshi: {stats.kalshiCount}
          </span>
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-400" />
            Hot: {stats.hotCount}
          </span>
          <span className="ml-auto">
            Vol: ${formatVolume(stats.totalVolume)}
          </span>
        </div>
      )}

      {/* Markets List */}
      <div className="divide-y divide-[var(--color-border)]">
        {markets.length === 0 ? (
          <div className="p-6 text-center">
            <Activity className="w-8 h-8 text-purple-400/30 mx-auto mb-2" />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Loading prediction markets...
            </p>
            <RefreshCw className="w-4 h-4 text-purple-400 animate-spin mx-auto mt-2" />
          </div>
        ) : (
          markets.slice(0, 8).map((market: any, i: number) => {
            const tickers = (() => { try { return JSON.parse(market.relatedTickers || "[]"); } catch { return []; } })();
            const probChange = market.probabilityChange24h || 0;
            const changeColor = probChange > 0 ? "text-emerald-400" : probChange < 0 ? "text-red-400" : "text-gray-400";
            const changeIcon = probChange > 0
              ? <TrendingUp className="w-3 h-3" />
              : probChange < 0
              ? <TrendingDown className="w-3 h-3" />
              : <Minus className="w-3 h-3" />;

            return (
              <div
                key={market.id || i}
                className={`px-4 py-3 hover:bg-[var(--color-bg-tertiary)] transition-colors ${
                  market.isHot ? "bg-orange-500/5" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      {market.isHot ? (
                        <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      ) : null}
                      <span className="text-sm text-[var(--color-text-primary)] line-clamp-2 leading-tight">
                        {market.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        market.platform === "polymarket"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                      }`}>
                        {market.platform === "polymarket" ? "Polymarket" : "Kalshi"}
                      </span>
                      {market.category && (
                        <span className="text-[10px] text-[var(--color-text-tertiary)] px-1 rounded bg-[var(--color-bg-tertiary)]">
                          {market.category}
                        </span>
                      )}
                      {tickers.slice(0, 3).map((t: string) => (
                        <a
                          key={t}
                          href={`/ticker/${t}`}
                          className="text-[10px] font-mono font-bold text-blue-400 hover:underline"
                        >
                          ${t}
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {/* Probability */}
                    <div className="flex items-center gap-1">
                      <ProbabilityBar probability={market.yesProbability} />
                      <span className="text-lg font-bold font-mono text-[var(--color-text-primary)]">
                        {market.yesProbability}%
                      </span>
                    </div>
                    {/* Change */}
                    <div className={`flex items-center gap-0.5 text-xs font-mono ${changeColor}`}>
                      {changeIcon}
                      <span>{probChange > 0 ? "+" : ""}{probChange}%</span>
                    </div>
                    {/* Volume */}
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">
                      Vol: ${formatVolume(market.volume24h || 0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)] flex items-center justify-between text-[10px] text-[var(--color-text-tertiary)]">
        <span>Prediction markets as leading indicators</span>
        <span>Updated every 10 min</span>
      </div>
    </div>
  );
}

function ProbabilityBar({ probability }: { probability: number }) {
  const color = probability >= 70 ? "bg-emerald-500"
    : probability >= 40 ? "bg-amber-500"
    : "bg-red-500";

  return (
    <div className="w-12 h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all`}
        style={{ width: `${probability}%` }}
      />
    </div>
  );
}

function formatVolume(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}
