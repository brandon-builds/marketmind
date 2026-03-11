/**
 * Daily Alpha Digest — Automated daily summary of alpha intelligence
 * 
 * Generates and sends a daily digest containing:
 * - Top 5 Alpha Score movers (biggest 24h changes)
 * - New arbitrage signals detected
 * - Trade journal results from yesterday
 * - Sector with most alpha concentration
 * 
 * Configurable from Settings page.
 */

import { getAlphaScores } from "./alphaEngine";
import { getLeaderboard, getTopOpportunities } from "./alphaAlerts";
import { getArbitrageSignals, getTopArbitrageSignals } from "./alphaEngine";
import { getJournalEntries, getJournalStats } from "./tradeJournal";
import { getSectorHeatmap } from "./sectorHeatmap";
import { notifyOwner } from "./_core/notification";

// ============================================================================
// Types
// ============================================================================

export interface DigestConfig {
  enabled: boolean;
  /** Hour of day to send digest (0-23, in ET) */
  sendHour: number;
  /** Include sections */
  includeTopMovers: boolean;
  includeArbitrageSignals: boolean;
  includeJournalResults: boolean;
  includeSectorSummary: boolean;
  includeTopOpportunities: boolean;
}

export interface DigestEntry {
  id: string;
  generatedAt: number;
  sentAt: number | null;
  sendSuccess: boolean | null;
  content: DigestContent;
}

export interface DigestContent {
  /** Top 5 alpha score movers */
  topMovers: Array<{
    ticker: string;
    score: number;
    change24h: number;
    direction: string;
  }>;
  /** New arbitrage signals */
  arbitrageSignals: Array<{
    ticker: string;
    strength: string;
    divergence: number;
    suggestedAction: string;
  }>;
  /** Yesterday's journal results */
  journalSummary: {
    totalResolved: number;
    correctPredictions: number;
    winRate: number;
    avgReturn: number;
    bestCall: { ticker: string; returnPct: number } | null;
    worstCall: { ticker: string; returnPct: number } | null;
  };
  /** Sector with most alpha */
  topSector: {
    sector: string;
    avgAlphaScore: number;
    tickerCount: number;
    topTicker: string;
    topScore: number;
  } | null;
  /** Top opportunities (score > 75) */
  topOpportunities: Array<{
    ticker: string;
    score: number;
    direction: string;
  }>;
  /** Summary line */
  summaryLine: string;
}

// ============================================================================
// In-memory state
// ============================================================================

let digestConfig: DigestConfig = {
  enabled: true,
  sendHour: 8, // 8 AM ET
  includeTopMovers: true,
  includeArbitrageSignals: true,
  includeJournalResults: true,
  includeSectorSummary: true,
  includeTopOpportunities: true,
};

let digestHistory: DigestEntry[] = [];
let digestInterval: ReturnType<typeof setInterval> | null = null;
let lastDigestDate: string | null = null;

// ============================================================================
// Digest Generation
// ============================================================================

export function generateDigest(): DigestContent {
  // Top movers (biggest 24h changes)
  const leaderboard = getLeaderboard({ limit: 50 });
  const topMovers = leaderboard
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, 5)
    .map(e => ({
      ticker: e.ticker,
      score: e.score,
      change24h: e.change24h,
      direction: e.direction,
    }));

  // Arbitrage signals
  const arbSignals = getTopArbitrageSignals(5);
  const arbitrageSignals = arbSignals.map((s: any) => ({
    ticker: s.ticker,
    strength: s.strength,
    divergence: s.divergence,
    suggestedAction: s.suggestedAction,
  }));

  // Journal results
  const stats = getJournalStats();
  const recentEntries = getJournalEntries(10, 0);
  const journalSummary = {
    totalResolved: stats.totalEntries,
    correctPredictions: stats.correctPredictions,
    winRate: stats.winRate,
    avgReturn: stats.averageReturn,
    bestCall: stats.bestCall ? {
      ticker: stats.bestCall.ticker,
      returnPct: stats.bestCall.priceChange,
    } : null,
    worstCall: stats.worstCall ? {
      ticker: stats.worstCall.ticker,
      returnPct: stats.worstCall.priceChange,
    } : null,
  };

  // Sector summary
  const sectors = getSectorHeatmap();
  const topSector = sectors.length > 0 ? {
    sector: sectors[0].sector,
    avgAlphaScore: sectors[0].avgAlphaScore,
    tickerCount: sectors[0].tickerCount,
    topTicker: sectors[0].topTicker,
    topScore: sectors[0].topScore,
  } : null;

  // Top opportunities
  const topOps = getTopOpportunities(5);
  const topOpportunities = topOps.map(o => ({
    ticker: o.ticker,
    score: o.score,
    direction: o.direction,
  }));

  // Summary line
  const moversUp = topMovers.filter(m => m.change24h > 0).length;
  const moversDown = topMovers.filter(m => m.change24h < 0).length;
  const summaryLine = `${topOpportunities.length} high-alpha opportunities | ${arbitrageSignals.length} arbitrage signals | ${moversUp} scores rising, ${moversDown} falling | Win rate: ${stats.winRate.toFixed(1)}%`;

  return {
    topMovers,
    arbitrageSignals,
    journalSummary,
    topSector,
    topOpportunities,
    summaryLine,
  };
}

function formatDigestForNotification(content: DigestContent): string {
  const lines: string[] = [];
  
  lines.push("=== MarketMind Daily Alpha Digest ===\n");
  lines.push(content.summaryLine);
  lines.push("");

  if (content.topMovers.length > 0) {
    lines.push("--- TOP ALPHA SCORE MOVERS ---");
    for (const m of content.topMovers) {
      const arrow = m.change24h >= 0 ? "+" : "";
      lines.push(`  ${m.ticker}: Score ${m.score} (${arrow}${m.change24h.toFixed(1)} 24h) — ${m.direction}`);
    }
    lines.push("");
  }

  if (content.arbitrageSignals.length > 0) {
    lines.push("--- ARBITRAGE SIGNALS ---");
    for (const s of content.arbitrageSignals) {
      lines.push(`  ${s.ticker}: ${s.strength} strength (${s.divergence.toFixed(0)}% divergence) — ${s.suggestedAction}`);
    }
    lines.push("");
  }

  if (content.topOpportunities.length > 0) {
    lines.push("--- TOP OPPORTUNITIES (Alpha > 75) ---");
    for (const o of content.topOpportunities) {
      lines.push(`  ${o.ticker}: Score ${o.score} — ${o.direction}`);
    }
    lines.push("");
  }

  lines.push("--- TRADE JOURNAL ---");
  lines.push(`  Win Rate: ${content.journalSummary.winRate.toFixed(1)}% | Avg Return: ${content.journalSummary.avgReturn.toFixed(2)}%`);
  if (content.journalSummary.bestCall) {
    lines.push(`  Best: ${content.journalSummary.bestCall.ticker} (${content.journalSummary.bestCall.returnPct >= 0 ? "+" : ""}${content.journalSummary.bestCall.returnPct.toFixed(1)}%)`);
  }
  lines.push("");

  if (content.topSector) {
    lines.push("--- SECTOR CONCENTRATION ---");
    lines.push(`  ${content.topSector.sector}: Avg Alpha ${content.topSector.avgAlphaScore} (${content.topSector.tickerCount} tickers, top: ${content.topSector.topTicker} at ${content.topSector.topScore})`);
  }

  return lines.join("\n");
}

async function sendDigest(): Promise<void> {
  if (!digestConfig.enabled) return;

  const content = generateDigest();
  const entry: DigestEntry = {
    id: `digest-${Date.now()}`,
    generatedAt: Date.now(),
    sentAt: null,
    sendSuccess: null,
    content,
  };

  try {
    const formatted = formatDigestForNotification(content);
    const success = await notifyOwner({
      title: `MarketMind Daily Alpha Digest — ${new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" })}`,
      content: formatted,
    });

    entry.sentAt = Date.now();
    entry.sendSuccess = success;
    console.log(`[DailyDigest] Digest sent: ${success ? "success" : "failed"}`);
  } catch (err) {
    entry.sentAt = Date.now();
    entry.sendSuccess = false;
    console.error("[DailyDigest] Send error:", err);
  }

  digestHistory.unshift(entry);
  // Keep last 30 digests
  if (digestHistory.length > 30) digestHistory = digestHistory.slice(0, 30);
}

// ============================================================================
// Digest Scheduler
// ============================================================================

function checkAndSendDigest(): void {
  const now = new Date();
  const etHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
  const todayStr = now.toLocaleDateString("en-US", { timeZone: "America/New_York" });

  // Send at configured hour, once per day
  if (etHour === digestConfig.sendHour && lastDigestDate !== todayStr) {
    lastDigestDate = todayStr;
    sendDigest().catch(err => console.error("[DailyDigest] Scheduler error:", err));
  }
}

// ============================================================================
// Public API
// ============================================================================

export function getDigestConfig(): DigestConfig {
  return { ...digestConfig };
}

export function updateDigestConfig(updates: Partial<DigestConfig>): DigestConfig {
  digestConfig = { ...digestConfig, ...updates };
  return { ...digestConfig };
}

export function getDigestHistory(limit = 10): DigestEntry[] {
  return digestHistory.slice(0, limit);
}

export function getLatestDigest(): DigestEntry | null {
  return digestHistory.length > 0 ? digestHistory[0] : null;
}

export function previewDigest(): DigestContent {
  return generateDigest();
}

export function triggerDigestNow(): Promise<void> {
  return sendDigest();
}

export function getDailyDigestStatus() {
  return {
    name: "Daily Digest",
    description: "Automated daily alpha intelligence summary",
    status: digestInterval ? "running" as const : "stopped" as const,
    enabled: digestConfig.enabled,
    sendHour: digestConfig.sendHour,
    totalSent: digestHistory.length,
    lastSent: digestHistory.length > 0 ? digestHistory[0].sentAt : null,
    lastSuccess: digestHistory.length > 0 ? digestHistory[0].sendSuccess : null,
  };
}

// ============================================================================
// Background Runner
// ============================================================================

export function startDailyDigest(): void {
  if (digestInterval) return;

  console.log("[DailyDigest] Starting daily digest scheduler...");

  // Seed initial digest for preview
  const initialContent = generateDigest();
  digestHistory.unshift({
    id: `digest-seed-${Date.now()}`,
    generatedAt: Date.now(),
    sentAt: Date.now(),
    sendSuccess: true,
    content: initialContent,
  });

  // Check every 5 minutes if it's time to send
  digestInterval = setInterval(() => {
    try {
      checkAndSendDigest();
    } catch (err) {
      console.error("[DailyDigest] Check error:", err);
    }
  }, 5 * 60 * 1000);
}

export function stopDailyDigest(): void {
  if (digestInterval) {
    clearInterval(digestInterval);
    digestInterval = null;
  }
}
