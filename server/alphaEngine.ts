/**
 * Alpha Engine — Composite Alpha Score + Arbitrage Signal Detection
 * 
 * Alpha Score (0-100) per ticker combines:
 *   - AI prediction confidence (30% weight)
 *   - Prediction market probability divergence (20% weight)
 *   - VIP account sentiment (20% weight)
 *   - Narrative velocity (15% weight)
 *   - Anomaly flags (15% weight)
 * 
 * Arbitrage Signals:
 *   When prediction market probability diverges significantly from
 *   MarketMind's AI prediction, flag as an arbitrage opportunity.
 */

import { getDb } from "./db";
import {
  predictionMarkets,
  vipTweets,
  trendingTopics,
} from "../drizzle/schema";
import { desc, eq, sql, gte, and } from "drizzle-orm";
import { getActiveAnomalies } from "./anomalyDetection";

// ============================================================================
// Types
// ============================================================================

export interface AlphaScore {
  ticker: string;
  score: number; // 0-100
  components: {
    aiConfidence: number;       // 0-100 — from AI predictions
    marketDivergence: number;   // 0-100 — prediction market divergence
    vipSentiment: number;       // 0-100 — VIP account sentiment strength
    narrativeVelocity: number;  // 0-100 — narrative momentum
    anomalyFlags: number;       // 0-100 — anomaly detection signals
  };
  direction: "bullish" | "bearish" | "neutral";
  reasoning: string;
  updatedAt: number;
}

export interface ArbitrageSignal {
  id: string;
  ticker: string;
  title: string;
  description: string;
  /** AI prediction direction */
  aiDirection: "bullish" | "bearish" | "neutral";
  aiConfidence: number;
  /** Prediction market direction */
  marketDirection: "bullish" | "bearish" | "neutral";
  marketProbability: number;
  /** Divergence magnitude (0-100) */
  divergence: number;
  /** Suggested action */
  suggestedAction: string;
  /** Source platform */
  platform: string;
  marketTitle: string;
  relatedTickers: string[];
  /** Strength: low / medium / high / extreme */
  strength: "low" | "medium" | "high" | "extreme";
  detectedAt: number;
  alphaScore: number;
}

// ============================================================================
// Weights
// ============================================================================

const ALPHA_WEIGHTS = {
  aiConfidence: 0.30,
  marketDivergence: 0.20,
  vipSentiment: 0.20,
  narrativeVelocity: 0.15,
  anomalyFlags: 0.15,
};

// ============================================================================
// In-memory cache
// ============================================================================

let alphaScoreCache: Map<string, AlphaScore> = new Map();
let arbitrageSignalCache: ArbitrageSignal[] = [];
let lastComputeAt: Date | null = null;
let computeCount = 0;
let alphaInterval: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// Alpha Score Computation
// ============================================================================

/**
 * Compute AI confidence component for a ticker
 */
function computeAiConfidence(predictions: any[], ticker: string): { score: number; direction: "bullish" | "bearish" | "neutral" } {
  const tickerPreds = predictions.filter(
    (p: any) => p.ticker === ticker || (p.relatedTickers && p.relatedTickers.includes(ticker))
  );
  
  if (tickerPreds.length === 0) {
    return { score: 20, direction: "neutral" }; // baseline
  }

  let totalConfidence = 0;
  let bullishWeight = 0;
  let bearishWeight = 0;

  for (const pred of tickerPreds) {
    const conf = pred.confidence || 0.5;
    totalConfidence += conf;
    if (pred.direction === "up") bullishWeight += conf;
    else if (pred.direction === "down") bearishWeight += conf;
  }

  const avgConfidence = totalConfidence / tickerPreds.length;
  const direction = bullishWeight > bearishWeight ? "bullish" : bearishWeight > bullishWeight ? "bearish" : "neutral";
  
  // Scale to 0-100
  return {
    score: Math.min(100, Math.round(avgConfidence * 100)),
    direction,
  };
}

/**
 * Compute prediction market divergence for a ticker
 */
function computeMarketDivergence(
  markets: any[],
  ticker: string,
  aiDirection: "bullish" | "bearish" | "neutral"
): { score: number; divergence: number; marketDirection: "bullish" | "bearish" | "neutral"; bestMarket: any | null } {
  const tickerMarkets = markets.filter((m: any) => {
    const related = m.relatedTickers ? JSON.parse(m.relatedTickers) : [];
    return related.includes(ticker);
  });

  if (tickerMarkets.length === 0) {
    return { score: 30, divergence: 0, marketDirection: "neutral", bestMarket: null };
  }

  // Find the most relevant market
  const bestMarket = tickerMarkets.sort((a: any, b: any) => (b.volume24h || 0) - (a.volume24h || 0))[0];
  const marketProb = bestMarket.yesProbability || 50;
  const marketDirection: "bullish" | "bearish" | "neutral" = 
    marketProb > 60 ? "bullish" : marketProb < 40 ? "bearish" : "neutral";

  // Calculate divergence: how much AI and market disagree
  let divergence = 0;
  if (aiDirection === "bullish" && marketDirection === "bearish") {
    divergence = Math.abs(marketProb - 50) + 30; // Strong divergence
  } else if (aiDirection === "bearish" && marketDirection === "bullish") {
    divergence = Math.abs(marketProb - 50) + 30;
  } else if (aiDirection !== marketDirection) {
    divergence = Math.abs(marketProb - 50) + 10; // Mild divergence
  } else {
    divergence = Math.max(0, 50 - Math.abs(marketProb - 50)); // Agreement = lower divergence score
  }

  return {
    score: Math.min(100, Math.round(divergence)),
    divergence: Math.min(100, Math.round(divergence)),
    marketDirection,
    bestMarket,
  };
}

/**
 * Compute VIP sentiment component for a ticker
 */
async function computeVipSentiment(ticker: string): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 25;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const tweets = await db
      .select()
      .from(vipTweets)
      .where(
        and(
          gte(vipTweets.tweetedAt, oneDayAgo),
          sql`JSON_CONTAINS(${vipTweets.tickers}, ${JSON.stringify(ticker)}) OR ${vipTweets.content} LIKE ${`%${ticker}%`}`
        )
      )
      .limit(20);

    if (tweets.length === 0) return 25; // baseline

    let sentimentSum = 0;
    let weightSum = 0;
    for (const tweet of tweets) {
      const score = tweet.sentimentScore || 0;
      const weight = tweet.relevanceScore ? tweet.relevanceScore / 100 : 0.5;
      sentimentSum += score * weight;
      weightSum += weight;
    }

    const avgSentiment = weightSum > 0 ? sentimentSum / weightSum : 0;
    // Map -100..100 to 0..100
    return Math.min(100, Math.max(0, Math.round((avgSentiment + 100) / 2)));
  } catch {
    return 25;
  }
}

/**
 * Compute narrative velocity component for a ticker
 */
function computeNarrativeVelocity(narratives: any[], ticker: string): number {
  const tickerNarratives = narratives.filter(
    (n: any) => n.relatedTickers && n.relatedTickers.includes(ticker)
  );

  if (tickerNarratives.length === 0) return 15;

  // More narratives = higher velocity
  const count = tickerNarratives.length;
  const avgConfidence = tickerNarratives.reduce((sum: number, n: any) => sum + (n.confidence || 0.5), 0) / count;
  
  // Check for high-confidence narratives
  const highConfCount = tickerNarratives.filter((n: any) => (n.confidence || 0) > 0.7).length;
  
  return Math.min(100, Math.round(
    (count * 12) + (avgConfidence * 40) + (highConfCount * 15)
  ));
}

/**
 * Compute anomaly flags component for a ticker
 */
function computeAnomalyFlags(ticker: string): number {
  try {
    const anomalies = getActiveAnomalies();
    const tickerAnomalies = anomalies.filter(
      (a: any) => a.ticker === ticker || (a.affectedTickers && a.affectedTickers.includes(ticker))
    );

    if (tickerAnomalies.length === 0) return 10;

    let score = 0;
    for (const anomaly of tickerAnomalies) {
      const severity = anomaly.severity || "low";
      if (severity === "critical") score += 40;
      else if (severity === "high") score += 25;
      else if (severity === "medium") score += 15;
      else score += 8;
    }

    return Math.min(100, score);
  } catch {
    return 10;
  }
}

/**
 * Generate reasoning text for an alpha score
 */
function generateReasoning(ticker: string, components: AlphaScore["components"], direction: string): string {
  const parts: string[] = [];
  
  if (components.aiConfidence > 70) {
    parts.push(`Strong AI conviction (${components.aiConfidence}%) ${direction}`);
  } else if (components.aiConfidence > 50) {
    parts.push(`Moderate AI signal (${components.aiConfidence}%)`);
  }

  if (components.marketDivergence > 60) {
    parts.push(`High prediction market divergence — potential arbitrage`);
  } else if (components.marketDivergence > 40) {
    parts.push(`Notable market divergence detected`);
  }

  if (components.vipSentiment > 70) {
    parts.push(`Strong VIP account sentiment alignment`);
  } else if (components.vipSentiment < 30) {
    parts.push(`VIP accounts signaling caution`);
  }

  if (components.narrativeVelocity > 60) {
    parts.push(`Narrative momentum accelerating`);
  }

  if (components.anomalyFlags > 50) {
    parts.push(`Active anomaly flags detected`);
  }

  if (parts.length === 0) {
    parts.push(`Baseline signal — monitoring for changes`);
  }

  return parts.join(". ") + ".";
}

// ============================================================================
// Main Computation
// ============================================================================

/**
 * Compute alpha scores for all tracked tickers
 */
export async function computeAlphaScores(
  predictions: any[],
  narratives: any[],
  markets: any[]
): Promise<Map<string, AlphaScore>> {
  const scores = new Map<string, AlphaScore>();
  
  // Collect all tickers from predictions
  const tickers = new Set<string>();
  for (const p of predictions) {
    if (p.ticker) tickers.add(p.ticker);
  }
  // Add tickers from narratives
  for (const n of narratives) {
    if (n.relatedTickers) {
      const related = Array.isArray(n.relatedTickers) ? n.relatedTickers : [];
      for (const t of related) tickers.add(t);
    }
  }

  // Compute for each ticker
  for (const ticker of Array.from(tickers)) {
    const aiResult = computeAiConfidence(predictions, ticker);
    const marketResult = computeMarketDivergence(markets, ticker, aiResult.direction);
    const vipScore = await computeVipSentiment(ticker);
    const narrativeScore = computeNarrativeVelocity(narratives, ticker);
    const anomalyScore = computeAnomalyFlags(ticker);

    const components = {
      aiConfidence: aiResult.score,
      marketDivergence: marketResult.score,
      vipSentiment: vipScore,
      narrativeVelocity: narrativeScore,
      anomalyFlags: anomalyScore,
    };

    const compositeScore = Math.round(
      components.aiConfidence * ALPHA_WEIGHTS.aiConfidence +
      components.marketDivergence * ALPHA_WEIGHTS.marketDivergence +
      components.vipSentiment * ALPHA_WEIGHTS.vipSentiment +
      components.narrativeVelocity * ALPHA_WEIGHTS.narrativeVelocity +
      components.anomalyFlags * ALPHA_WEIGHTS.anomalyFlags
    );

    scores.set(ticker, {
      ticker,
      score: Math.min(100, Math.max(0, compositeScore)),
      components,
      direction: aiResult.direction,
      reasoning: generateReasoning(ticker, components, aiResult.direction),
      updatedAt: Date.now(),
    });
  }

  return scores;
}

// ============================================================================
// Arbitrage Signal Detection
// ============================================================================

/**
 * Detect arbitrage opportunities between AI predictions and prediction markets
 */
export function detectArbitrageSignals(
  predictions: any[],
  markets: any[]
): ArbitrageSignal[] {
  const signals: ArbitrageSignal[] = [];
  let idCounter = 0;

  for (const market of markets) {
    if (!market.relatedTickers) continue;
    
    const relatedTickers: string[] = (() => {
      try { return JSON.parse(market.relatedTickers); }
      catch { return []; }
    })();

    if (relatedTickers.length === 0) continue;

    const marketProb = market.yesProbability || 50;
    const marketDirection: "bullish" | "bearish" | "neutral" =
      marketProb > 60 ? "bullish" : marketProb < 40 ? "bearish" : "neutral";

    for (const ticker of relatedTickers) {
      const tickerPreds = predictions.filter((p: any) => p.ticker === ticker);
      if (tickerPreds.length === 0) continue;

      // Get the strongest AI prediction for this ticker
      const strongestPred = tickerPreds.sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))[0];
      const aiDirection: "bullish" | "bearish" | "neutral" =
        strongestPred.direction === "up" ? "bullish" : strongestPred.direction === "down" ? "bearish" : "neutral";
      const aiConfidence = Math.round((strongestPred.confidence || 0.5) * 100);

      // Check for divergence
      const isDiverging = (
        (aiDirection === "bullish" && marketDirection === "bearish") ||
        (aiDirection === "bearish" && marketDirection === "bullish")
      );

      if (!isDiverging) continue;

      // Calculate divergence magnitude
      const divergence = Math.min(100, Math.abs(marketProb - 50) + aiConfidence - 30);
      
      if (divergence < 20) continue; // Too weak

      const strength: ArbitrageSignal["strength"] =
        divergence > 75 ? "extreme" :
        divergence > 55 ? "high" :
        divergence > 35 ? "medium" : "low";

      // Generate suggested action
      let suggestedAction = "";
      if (aiDirection === "bullish" && marketDirection === "bearish") {
        suggestedAction = `AI is bullish on ${ticker} (${aiConfidence}% confidence) but ${market.platform} prices ${ticker}-related outcome at only ${marketProb}% YES. Consider: the market may be underpricing upside.`;
      } else {
        suggestedAction = `AI is bearish on ${ticker} (${aiConfidence}% confidence) but ${market.platform} prices ${ticker}-related outcome at ${marketProb}% YES. Consider: the market may be overpricing this outcome.`;
      }

      const alphaScore = alphaScoreCache.get(ticker)?.score || 50;

      signals.push({
        id: `arb-${Date.now()}-${idCounter++}`,
        ticker,
        title: `${ticker}: AI vs ${market.platform} Divergence`,
        description: `MarketMind AI is ${aiDirection} on ${ticker} but ${market.platform} suggests ${marketDirection} outcome. Divergence: ${divergence}%.`,
        aiDirection,
        aiConfidence,
        marketDirection,
        marketProbability: marketProb,
        divergence,
        suggestedAction,
        platform: market.platform,
        marketTitle: market.title,
        relatedTickers,
        strength,
        detectedAt: Date.now(),
        alphaScore,
      });
    }
  }

  // Sort by divergence (strongest first)
  return signals.sort((a, b) => b.divergence - a.divergence);
}

// ============================================================================
// Public API
// ============================================================================

export function getAlphaScores(): AlphaScore[] {
  return Array.from(alphaScoreCache.values())
    .sort((a, b) => b.score - a.score);
}

export function getAlphaScoreForTicker(ticker: string): AlphaScore | null {
  return alphaScoreCache.get(ticker) || null;
}

export function getArbitrageSignals(): ArbitrageSignal[] {
  return arbitrageSignalCache;
}

export function getTopArbitrageSignals(limit = 5): ArbitrageSignal[] {
  return arbitrageSignalCache.slice(0, limit);
}

export function getAlphaEngineStatus() {
  return {
    name: "Alpha Engine",
    description: "Composite alpha scoring + arbitrage signal detection",
    status: alphaInterval ? "running" as const : "stopped" as const,
    tickersScored: alphaScoreCache.size,
    arbitrageSignals: arbitrageSignalCache.length,
    lastCompute: lastComputeAt,
    computeCount,
  };
}

// ============================================================================
// Background Runner
// ============================================================================

/**
 * Run one computation cycle
 */
export async function runAlphaComputation(
  predictions: any[],
  narratives: any[],
  markets: any[]
): Promise<void> {
  try {
    // Compute alpha scores
    const scores = await computeAlphaScores(predictions, narratives, markets);
    alphaScoreCache = scores;

    // Detect arbitrage signals
    const signals = detectArbitrageSignals(predictions, markets);
    arbitrageSignalCache = signals;

    lastComputeAt = new Date();
    computeCount++;

    console.log(
      `[Alpha] Computed ${scores.size} alpha scores, detected ${signals.length} arbitrage signals`
    );
  } catch (err) {
    console.error("[Alpha] Computation error:", err);
  }
}

/**
 * Start the alpha engine background loop
 * Runs every 2 minutes to keep scores fresh
 */
export function startAlphaEngine(
  getPredictions: () => any[],
  getNarratives: () => any[],
  getMarkets: () => Promise<any[]>
): void {
  if (alphaInterval) return;

  console.log("[Alpha] Starting alpha engine...");

  // Initial run after a short delay
  setTimeout(async () => {
    const markets = await getMarkets();
    await runAlphaComputation(getPredictions(), getNarratives(), markets);
  }, 15000);

  // Run every 2 minutes
  alphaInterval = setInterval(async () => {
    try {
      const markets = await getMarkets();
      await runAlphaComputation(getPredictions(), getNarratives(), markets);
    } catch (err) {
      console.error("[Alpha] Cycle error:", err);
    }
  }, 2 * 60 * 1000);
}

export function stopAlphaEngine(): void {
  if (alphaInterval) {
    clearInterval(alphaInterval);
    alphaInterval = null;
  }
}
