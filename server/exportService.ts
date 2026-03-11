/**
 * Export Service — generates CSV and structured data for Trade Journal,
 * Backtest Results, and Alpha Leaderboard.
 * 
 * Returns data in formats ready for client-side download.
 * CSV is generated server-side for consistency.
 */

import { getJournalEntries, getJournalStats } from "./tradeJournal";
import { getLeaderboard } from "./alphaAlerts";

// ============================================================================
// Types
// ============================================================================

export interface ExportResult {
  filename: string;
  contentType: string;
  data: string; // CSV string or JSON string
}

// ============================================================================
// CSV Helpers
// ============================================================================

function escapeCsvField(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCsv(headers: string[], rows: any[][]): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map(row => row.map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

// ============================================================================
// Trade Journal Export
// ============================================================================

export function exportTradeJournalCsv(): ExportResult {
  const entries = getJournalEntries();
  const stats = getJournalStats();

  const headers = [
    "Date", "Ticker", "Predicted Direction", "Actual Direction",
    "Correct", "Confidence", "Alpha Score At Entry", "Signal Source Type",
    "Signal Source Detail", "Price Change %", "Entry Price", "Exit Price",
    "Hypothetical P&L", "Horizon"
  ];

  const rows = entries.map(e => [
    new Date(e.resolutionDate).toISOString().split("T")[0],
    e.ticker,
    e.predictedDirection,
    e.actualDirection,
    e.isCorrect ? "YES" : "NO",
    `${e.predictedConfidence}%`,
    e.alphaScoreAtEntry ?? "N/A",
    e.signalSource.type,
    e.signalSource.detail,
    `${e.priceChange.toFixed(2)}%`,
    e.entryPrice.toFixed(2),
    e.exitPrice.toFixed(2),
    e.hypotheticalPnl !== null ? `$${e.hypotheticalPnl.toFixed(2)}` : "N/A",
    e.horizon,
  ]);

  // Add summary rows at the bottom
  rows.push([]);
  rows.push(["=== SUMMARY ==="]);
  rows.push(["Total Entries", String(stats.totalEntries)]);
  rows.push(["Win Rate", `${stats.winRate.toFixed(1)}%`]);
  rows.push(["Average Return", `${stats.averageReturn.toFixed(2)}%`]);
  rows.push(["Best Call", stats.bestCall ? `${stats.bestCall.ticker} (${stats.bestCall.priceChange.toFixed(2)}%)` : "N/A"]);
  rows.push(["Worst Call", stats.worstCall ? `${stats.worstCall.ticker} (${stats.worstCall.priceChange.toFixed(2)}%)` : "N/A"]);
  rows.push(["Total Hypothetical P&L", `$${stats.totalHypotheticalPnl.toFixed(2)}`]);

  const timestamp = new Date().toISOString().split("T")[0];
  return {
    filename: `trade-journal-${timestamp}.csv`,
    contentType: "text/csv",
    data: arrayToCsv(headers, rows),
  };
}

export function exportTradeJournalJson(): ExportResult {
  const entries = getJournalEntries();
  const stats = getJournalStats();

  const timestamp = new Date().toISOString().split("T")[0];
  return {
    filename: `trade-journal-${timestamp}.json`,
    contentType: "application/json",
    data: JSON.stringify({ entries, stats, exportedAt: new Date().toISOString() }, null, 2),
  };
}

// ============================================================================
// Alpha Leaderboard Export
// ============================================================================

export function exportLeaderboardCsv(): ExportResult {
  const leaderboard = getLeaderboard();

  const headers = [
    "Rank", "Ticker", "Alpha Score", "24h Change", "Direction",
    "AI Confidence", "Market Divergence", "VIP Sentiment",
    "Narrative Velocity", "Anomaly Flags", "Sector", "Top Opportunity"
  ];

  const rows = leaderboard.map((item) => [
    item.rank,
    item.ticker,
    item.score,
    item.change24h > 0 ? `+${item.change24h.toFixed(1)}` : item.change24h.toFixed(1),
    item.direction,
    item.components?.aiConfidence ?? "N/A",
    item.components?.marketDivergence ?? "N/A",
    item.components?.vipSentiment ?? "N/A",
    item.components?.narrativeVelocity ?? "N/A",
    item.components?.anomalyFlags ?? "N/A",
    item.sector,
    item.isTopOpportunity ? "YES" : "NO",
  ]);

  const timestamp = new Date().toISOString().split("T")[0];
  return {
    filename: `alpha-leaderboard-${timestamp}.csv`,
    contentType: "text/csv",
    data: arrayToCsv(headers, rows),
  };
}

export function exportLeaderboardJson(): ExportResult {
  const leaderboard = getLeaderboard();

  const timestamp = new Date().toISOString().split("T")[0];
  return {
    filename: `alpha-leaderboard-${timestamp}.json`,
    contentType: "application/json",
    data: JSON.stringify({ leaderboard, exportedAt: new Date().toISOString() }, null, 2),
  };
}

// ============================================================================
// Backtest Results Export
// ============================================================================

export function exportBacktestCsv(backtestData: any): ExportResult {
  if (!backtestData) {
    return {
      filename: "backtest-no-data.csv",
      contentType: "text/csv",
      data: "No backtest data available",
    };
  }

  const headers = [
    "Date", "Ticker", "Action", "Entry Price", "Exit Price",
    "Return %", "Holding Days", "Win"
  ];

  const rows = (backtestData.tradeLog || []).map((trade: any) => [
    trade.date || "N/A",
    trade.ticker,
    trade.action || "buy",
    trade.entryPrice?.toFixed(2) ?? "N/A",
    trade.exitPrice?.toFixed(2) ?? "N/A",
    trade.returnPct ? `${trade.returnPct.toFixed(2)}%` : "N/A",
    trade.holdingDays ?? "N/A",
    trade.win ? "YES" : "NO",
  ]);

  // Summary
  rows.push([]);
  rows.push(["=== BACKTEST SUMMARY ==="]);
  rows.push(["Period", `${backtestData.periodDays} days`]);
  rows.push(["Total Trades", String(backtestData.totalTrades)]);
  rows.push(["Win Rate", `${backtestData.winRate?.toFixed(1)}%`]);
  rows.push(["Total Return", `${backtestData.totalReturn?.toFixed(2)}%`]);
  rows.push(["Sharpe Ratio", String(backtestData.sharpeRatio?.toFixed(2))]);
  rows.push(["Max Drawdown", `${backtestData.maxDrawdown?.toFixed(2)}%`]);
  rows.push(["Benchmark Return", `${backtestData.benchmarkReturn?.toFixed(2)}%`]);
  rows.push(["Alpha", `${backtestData.alpha?.toFixed(2)}%`]);

  const timestamp = new Date().toISOString().split("T")[0];
  return {
    filename: `backtest-results-${timestamp}.csv`,
    contentType: "text/csv",
    data: arrayToCsv(headers, rows),
  };
}

export function exportBacktestJson(backtestData: any): ExportResult {
  const timestamp = new Date().toISOString().split("T")[0];
  return {
    filename: `backtest-results-${timestamp}.json`,
    contentType: "application/json",
    data: JSON.stringify({ ...backtestData, exportedAt: new Date().toISOString() }, null, 2),
  };
}
