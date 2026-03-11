import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, Minus, Zap, Hash, BarChart3,
  RefreshCw, ArrowUpRight, AlertTriangle, Flame,
} from "lucide-react";

export function TrendingFeedWidget() {
  const trendingQuery = trpc.intelligence.getTrending.useQuery(
    { limit: 10 },
    { refetchInterval: 60000 } // Auto-refresh every 60s
  );
  const statsQuery = trpc.intelligence.getTrendingStats.useQuery(
    undefined,
    { refetchInterval: 60000 }
  );

  const trends = trendingQuery.data || [];
  const stats = statsQuery.data;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-gradient-to-r from-cyan-500/5 to-blue-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center">
              <Hash className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              X Trending Finance
            </h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse">
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
            {stats && (
              <span>{stats.breakingCount} breaking</span>
            )}
            <button
              onClick={() => trendingQuery.refetch()}
              className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${trendingQuery.isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Trends List */}
      <div className="divide-y divide-[var(--color-border)]">
        {trends.length === 0 ? (
          <div className="p-6 text-center">
            <Hash className="w-8 h-8 text-cyan-400/30 mx-auto mb-2" />
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Loading trending topics...
            </p>
            <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin mx-auto mt-2" />
          </div>
        ) : (
          trends.map((trend: any, i: number) => {
            const tickers = (() => { try { return JSON.parse(trend.relatedTickers || "[]"); } catch { return []; } })();
            const velocityIcon = trend.velocity === "rising"
              ? <TrendingUp className="w-3 h-3 text-emerald-400" />
              : trend.velocity === "falling"
              ? <TrendingDown className="w-3 h-3 text-red-400" />
              : <Minus className="w-3 h-3 text-gray-400" />;

            const sentimentColor = trend.sentiment === "bullish" ? "text-emerald-400"
              : trend.sentiment === "bearish" ? "text-red-400" : "text-gray-400";

            return (
              <div
                key={trend.id || i}
                className={`px-4 py-2.5 hover:bg-[var(--color-bg-tertiary)] transition-colors ${
                  trend.isBreaking ? "bg-red-500/5" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className="text-xs text-[var(--color-text-tertiary)] font-mono w-4 pt-0.5 shrink-0">
                      {trend.rank || i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a
                          href={`/narratives?topic=${encodeURIComponent(trend.topic)}`}
                          className="text-sm font-semibold text-[var(--color-text-primary)] truncate hover:text-cyan-400 transition-colors cursor-pointer"
                        >
                          {trend.topic}
                        </a>
                        {trend.isBreaking ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse shrink-0">
                            BREAKING
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {tickers.slice(0, 3).map((t: string) => (
                          <a
                            key={t}
                            href={`/ticker/${t}`}
                            className="text-[10px] font-mono font-bold text-blue-400 hover:underline"
                          >
                            ${t}
                          </a>
                        ))}
                        {trend.category && (
                          <span className="text-[10px] text-[var(--color-text-tertiary)] px-1 rounded bg-[var(--color-bg-tertiary)]">
                            {trend.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1">
                      {velocityIcon}
                      <span className={`text-xs font-medium ${sentimentColor}`}>
                        {trend.sentiment}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                      {formatVolume(trend.tweetVolume || 0)} tweets
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {stats && (
        <div className="px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)] flex items-center justify-between text-[10px] text-[var(--color-text-tertiary)]">
          <span>Tracking {stats.totalTopicsTracked} topics</span>
          <span>Avg volume: {formatVolume(stats.avgVolume)}</span>
          <span>Top: {stats.topCategory}</span>
        </div>
      )}
    </div>
  );
}

function formatVolume(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
