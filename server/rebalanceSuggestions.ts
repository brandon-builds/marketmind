/**
 * Portfolio Rebalancing Suggestions Engine
 *
 * Monitors Alpha Score changes for portfolio holdings and generates
 * actionable suggestions when significant shifts occur:
 *   - Holdings with dropping Alpha Scores → "Consider reducing"
 *   - Non-holdings with spiking Alpha Scores → "High-conviction opportunity"
 *   - Multi-timeframe alignment changes → "Conviction shift detected"
 */

import { getAlphaScores, type AlphaScore } from "./alphaEngine";
import { getMultiTimeframeForTicker, type MultiTimeframeAlpha } from "./multiTimeframeAlpha";
import { getSmartMoneyForTicker, type SmartMoneyFlow } from "./multiTimeframeAlpha";
import { getDb } from "./db";
import { portfolioHoldings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export type SuggestionType = "reduce" | "increase" | "opportunity" | "conviction_shift" | "smart_money_alert";
export type SuggestionPriority = "critical" | "high" | "medium" | "low";

export interface RebalanceSuggestion {
  id: string;
  ticker: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  title: string;
  description: string;
  /** Current Alpha Score */
  currentAlpha: number;
  /** Previous Alpha Score (24h ago) */
  previousAlpha: number;
  /** Change in Alpha Score */
  alphaChange: number;
  /** Smart money rating if available */
  smartMoneyRating?: string;
  /** Multi-timeframe trade type */
  tradeType?: string;
  /** Suggested actions */
  actions: Array<{
    label: string;
    action: "add_watchlist" | "log_trade" | "view_predictions" | "dismiss";
    ticker?: string;
  }>;
  /** Is this for a current holding? */
  isHolding: boolean;
  /** Shares held (if holding) */
  sharesHeld?: number;
  createdAt: number;
  expiresAt: number;
}

// ============================================================================
// In-memory state
// ============================================================================

/** Previous alpha scores for change detection */
let previousScores: Map<string, number> = new Map();

/** Active suggestions */
let activeSuggestions: RebalanceSuggestion[] = [];

/** Portfolio holdings cache */
let holdingsCache: Map<string, number> = new Map(); // ticker -> shares

let lastCheckTime = 0;
let checkCount = 0;
let rebalanceInterval: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// Core Logic
// ============================================================================

async function refreshHoldings(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const holdings = await db.select().from(portfolioHoldings);
    holdingsCache.clear();
    for (const h of holdings) {
      const existing = holdingsCache.get(h.ticker) || 0;
      holdingsCache.set(h.ticker, existing + h.shares);
    }
  } catch {
    // Keep existing cache
  }
}

function generateSuggestions(): void {
  const currentScores = getAlphaScores();
  const newSuggestions: RebalanceSuggestion[] = [];
  const now = Date.now();
  let idCounter = 0;

  for (const score of currentScores) {
    const prevScore = previousScores.get(score.ticker);
    const change = prevScore !== undefined ? score.score - prevScore : 0;
    const isHolding = holdingsCache.has(score.ticker);
    const shares = holdingsCache.get(score.ticker) || 0;
    const mtf = getMultiTimeframeForTicker(score.ticker);
    const smf = getSmartMoneyForTicker(score.ticker);

    // === Holding drops significantly ===
    if (isHolding && change <= -15) {
      const priority: SuggestionPriority = change <= -30 ? "critical" : change <= -20 ? "high" : "medium";
      newSuggestions.push({
        id: `rebal-${now}-${idCounter++}`,
        ticker: score.ticker,
        type: "reduce",
        priority,
        title: `Consider reducing ${score.ticker} position`,
        description: `Alpha Score dropped ${Math.abs(change)} points in 24h (${prevScore} → ${score.score}). ${shares} shares held.${smf ? ` Smart Money: ${smf.ratingLabel}.` : ""}`,
        currentAlpha: score.score,
        previousAlpha: prevScore || score.score,
        alphaChange: change,
        smartMoneyRating: smf?.ratingLabel,
        tradeType: mtf?.tradeTypeLabel,
        actions: [
          { label: "Log Trade", action: "log_trade", ticker: score.ticker },
          { label: "View Predictions", action: "view_predictions", ticker: score.ticker },
          { label: "Dismiss", action: "dismiss" },
        ],
        isHolding: true,
        sharesHeld: shares,
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      });
    }

    // === Holding improves significantly ===
    if (isHolding && change >= 15) {
      newSuggestions.push({
        id: `rebal-${now}-${idCounter++}`,
        ticker: score.ticker,
        type: "increase",
        priority: change >= 25 ? "high" : "medium",
        title: `${score.ticker} showing strengthening alpha`,
        description: `Alpha Score rose ${change} points in 24h (${prevScore} → ${score.score}). Consider increasing position.${mtf ? ` Trade type: ${mtf.tradeType}.` : ""}`,
        currentAlpha: score.score,
        previousAlpha: prevScore || score.score,
        alphaChange: change,
        smartMoneyRating: smf?.ratingLabel,
        tradeType: mtf?.tradeTypeLabel,
        actions: [
          { label: "Log Trade", action: "log_trade", ticker: score.ticker },
          { label: "View Predictions", action: "view_predictions", ticker: score.ticker },
          { label: "Dismiss", action: "dismiss" },
        ],
        isHolding: true,
        sharesHeld: shares,
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      });
    }

    // === Non-holding spikes to high alpha ===
    if (!isHolding && score.score >= 80 && (prevScore === undefined || prevScore < 70)) {
      const isConviction = mtf?.tradeType === "conviction";
      newSuggestions.push({
        id: `rebal-${now}-${idCounter++}`,
        ticker: score.ticker,
        type: "opportunity",
        priority: isConviction ? "critical" : "high",
        title: `High-conviction opportunity: ${score.ticker} Alpha Score hit ${score.score}`,
        description: `${score.ticker} Alpha Score surged to ${score.score}${isConviction ? " across ALL timeframes" : ""}.${smf && smf.rating === "strong_buy" ? " Smart Money confirms: Strong Buy." : ""}`,
        currentAlpha: score.score,
        previousAlpha: prevScore || 0,
        alphaChange: prevScore !== undefined ? score.score - prevScore : score.score,
        smartMoneyRating: smf?.ratingLabel,
        tradeType: mtf?.tradeTypeLabel,
        actions: [
          { label: "Add to Watchlist", action: "add_watchlist", ticker: score.ticker },
          { label: "View Predictions", action: "view_predictions", ticker: score.ticker },
          { label: "Dismiss", action: "dismiss" },
        ],
        isHolding: false,
        createdAt: now,
        expiresAt: now + 12 * 60 * 60 * 1000,
      });
    }

    // === Conviction shift (trade type changed) ===
    if (mtf && isHolding) {
      if (mtf.tradeType === "momentum" && score.score < 60) {
        newSuggestions.push({
          id: `rebal-${now}-${idCounter++}`,
          ticker: score.ticker,
          type: "conviction_shift",
          priority: "medium",
          title: `${score.ticker} conviction weakening — now momentum-only`,
          description: `${score.ticker} shows high short-term alpha but weak long-term conviction. Consider whether this is still a position trade or a momentum play.`,
          currentAlpha: score.score,
          previousAlpha: prevScore || score.score,
          alphaChange: change,
          smartMoneyRating: smf?.ratingLabel,
          tradeType: mtf.tradeTypeLabel,
          actions: [
            { label: "View Predictions", action: "view_predictions", ticker: score.ticker },
            { label: "Dismiss", action: "dismiss" },
          ],
          isHolding: true,
          sharesHeld: shares,
          createdAt: now,
          expiresAt: now + 24 * 60 * 60 * 1000,
        });
      }
    }

    // === Smart money divergence alert ===
    if (isHolding && smf && (smf.rating === "strong_sell" || smf.rating === "sell")) {
      newSuggestions.push({
        id: `rebal-${now}-${idCounter++}`,
        ticker: score.ticker,
        type: "smart_money_alert",
        priority: smf.rating === "strong_sell" ? "critical" : "high",
        title: `Smart Money ${smf.ratingLabel} on ${score.ticker}`,
        description: `Smart money flow indicator is ${smf.ratingLabel} for ${score.ticker} (flow score: ${smf.flowScore}). You hold ${shares} shares.`,
        currentAlpha: score.score,
        previousAlpha: prevScore || score.score,
        alphaChange: change,
        smartMoneyRating: smf.ratingLabel,
        tradeType: mtf?.tradeTypeLabel,
        actions: [
          { label: "Log Trade", action: "log_trade", ticker: score.ticker },
          { label: "View Predictions", action: "view_predictions", ticker: score.ticker },
          { label: "Dismiss", action: "dismiss" },
        ],
        isHolding: true,
        sharesHeld: shares,
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      });
    }
  }

  // Deduplicate by ticker+type (keep highest priority)
  const seen = new Set<string>();
  const deduped: RebalanceSuggestion[] = [];
  const priorityOrder: Record<SuggestionPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  newSuggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  for (const s of newSuggestions) {
    const key = `${s.ticker}-${s.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(s);
    }
  }

  // Merge with existing (remove expired, keep new)
  const validExisting = activeSuggestions.filter(s => s.expiresAt > now);
  const existingKeys = new Set(validExisting.map(s => `${s.ticker}-${s.type}`));
  const merged = [...validExisting];
  for (const s of deduped) {
    const key = `${s.ticker}-${s.type}`;
    if (!existingKeys.has(key)) {
      merged.push(s);
    }
  }

  activeSuggestions = merged.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Update previous scores for next cycle
  previousScores.clear();
  for (const score of currentScores) {
    previousScores.set(score.ticker, score.score);
  }
}

// ============================================================================
// Public API
// ============================================================================

export function getRebalanceSuggestions(): RebalanceSuggestion[] {
  return activeSuggestions.filter(s => s.expiresAt > Date.now());
}

export function getRebalanceSuggestionsByPriority(priority?: SuggestionPriority): RebalanceSuggestion[] {
  const suggestions = getRebalanceSuggestions();
  if (!priority) return suggestions;
  return suggestions.filter(s => s.priority === priority);
}

export function dismissSuggestion(id: string): boolean {
  const idx = activeSuggestions.findIndex(s => s.id === id);
  if (idx >= 0) {
    activeSuggestions.splice(idx, 1);
    return true;
  }
  return false;
}

export function getRebalanceStatus() {
  return {
    name: "Portfolio Rebalancer",
    description: "Monitors Alpha Score shifts and generates rebalancing suggestions",
    status: rebalanceInterval ? ("running" as const) : ("stopped" as const),
    activeSuggestions: activeSuggestions.length,
    holdingsTracked: holdingsCache.size,
    lastCheck: lastCheckTime || null,
    checkCount,
  };
}

// ============================================================================
// Background Runner
// ============================================================================

async function runCheck(): Promise<void> {
  try {
    await refreshHoldings();
    generateSuggestions();
    lastCheckTime = Date.now();
    checkCount++;
    console.log(
      `[Rebalance] Generated ${activeSuggestions.length} suggestions for ${holdingsCache.size} holdings`
    );
  } catch (err) {
    console.error("[Rebalance] Check error:", err);
  }
}

/**
 * Start the rebalancing engine.
 * Runs every 3 minutes.
 */
export function startRebalanceEngine(): void {
  if (rebalanceInterval) return;
  console.log("[Rebalance] Starting portfolio rebalancing engine...");

  // Initial run after alpha + MTF engines have populated
  setTimeout(() => runCheck(), 30000);

  // Run every 3 minutes
  rebalanceInterval = setInterval(() => runCheck(), 3 * 60 * 1000);
}

export function stopRebalanceEngine(): void {
  if (rebalanceInterval) {
    clearInterval(rebalanceInterval);
    rebalanceInterval = null;
  }
}
