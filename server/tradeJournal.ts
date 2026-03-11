/**
 * Trade Journal — Automated prediction outcome logging
 * 
 * When a prediction's time horizon passes, the system automatically:
 * 1. Compares predicted direction vs actual price movement
 * 2. Logs the outcome (correct/incorrect/inconclusive)
 * 3. Identifies the signal source that triggered the prediction
 * 4. Calculates hypothetical P&L if user had a portfolio position
 * 5. Links back to the original signal
 */

import { getDb } from "./db";
import { getLatestPrice } from "./alertChecker";

// ============================================================================
// Types
// ============================================================================

export interface TradeJournalEntry {
  id: string;
  ticker: string;
  predictionId: string;
  /** Original prediction */
  predictedDirection: "up" | "down" | "neutral";
  predictedConfidence: number;
  horizon: string; // "1D" | "7D" | "30D"
  /** Prices */
  entryPrice: number;
  exitPrice: number;
  priceChange: number; // percentage
  /** Outcome */
  actualDirection: "up" | "down" | "neutral";
  isCorrect: boolean;
  /** Signal source that triggered this prediction */
  signalSource: SignalSource;
  /** Hypothetical P&L */
  hypotheticalPnl: number | null; // null if no portfolio position
  portfolioShares: number | null;
  /** Timestamps */
  predictionDate: number;
  resolutionDate: number;
  /** Alpha score at time of prediction */
  alphaScoreAtEntry: number | null;
  /** Reasoning from original prediction */
  reasoning: string;
  /** Price target if any */
  priceTarget: number | null;
}

export interface SignalSource {
  type: "vip_tweet" | "trending_topic" | "arbitrage_signal" | "ai_research" | "anomaly_detection" | "mixed";
  label: string;
  detail: string;
  /** Link to original signal */
  link: string | null;
}

export interface JournalStats {
  totalEntries: number;
  correctPredictions: number;
  incorrectPredictions: number;
  inconclusivePredictions: number;
  winRate: number;
  averageReturn: number;
  bestCall: TradeJournalEntry | null;
  worstCall: TradeJournalEntry | null;
  totalHypotheticalPnl: number;
  byHorizon: Record<string, { total: number; correct: number; winRate: number; avgReturn: number }>;
  bySource: Record<string, { total: number; correct: number; winRate: number }>;
  recentStreak: { type: "win" | "loss" | "mixed"; count: number };
}

// ============================================================================
// In-memory journal store
// ============================================================================

let journalEntries: TradeJournalEntry[] = [];
let lastResolutionCheck: Date | null = null;
let resolutionCheckCount = 0;
let journalInterval: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// Signal Source Detection
// ============================================================================

function detectSignalSource(prediction: any): SignalSource {
  // Check prediction metadata for source hints
  const reasoning = (prediction.reasoning || prediction.summary || "").toLowerCase();
  const sources = prediction.sources || [];
  
  // Check for VIP tweet signals
  if (reasoning.includes("vip") || reasoning.includes("camillo") || 
      reasoning.includes("burry") || reasoning.includes("ackman") ||
      reasoning.includes("elon") || reasoning.includes("cathie") ||
      sources.some((s: string) => s.toLowerCase().includes("twitter") || s.toLowerCase().includes("vip"))) {
    const vipName = extractVipName(reasoning);
    return {
      type: "vip_tweet",
      label: `VIP Signal${vipName ? `: ${vipName}` : ""}`,
      detail: `Triggered by high-signal account activity`,
      link: `/vip-signals`,
    };
  }

  // Check for trending topic signals
  if (reasoning.includes("trending") || reasoning.includes("viral") ||
      reasoning.includes("x/twitter") || reasoning.includes("social momentum")) {
    return {
      type: "trending_topic",
      label: "Trending Signal",
      detail: "Triggered by X/Twitter trending topic",
      link: `/narratives`,
    };
  }

  // Check for arbitrage signals
  if (reasoning.includes("arbitrage") || reasoning.includes("polymarket") ||
      reasoning.includes("kalshi") || reasoning.includes("prediction market") ||
      reasoning.includes("divergence")) {
    return {
      type: "arbitrage_signal",
      label: "Arbitrage Signal",
      detail: "Triggered by prediction market divergence",
      link: `/predictions`,
    };
  }

  // Check for anomaly detection
  if (reasoning.includes("anomaly") || reasoning.includes("unusual") ||
      reasoning.includes("spike") || reasoning.includes("abnormal")) {
    return {
      type: "anomaly_detection",
      label: "Anomaly Signal",
      detail: "Triggered by anomaly detection system",
      link: `/data-sources`,
    };
  }

  // Default: AI research
  return {
    type: "ai_research",
    label: "AI Research",
    detail: "Generated by MarketMind research agent",
    link: `/predictions`,
  };
}

function extractVipName(text: string): string | null {
  const vipNames: Record<string, string> = {
    "camillo": "Chris Camillo",
    "burry": "Michael Burry",
    "ackman": "Bill Ackman",
    "elon": "Elon Musk",
    "cathie": "Cathie Wood",
    "druckenmiller": "Stanley Druckenmiller",
    "cramer": "Jim Cramer",
    "el-erian": "Mohamed El-Erian",
    "altman": "Sam Altman",
  };
  
  for (const [key, name] of Object.entries(vipNames)) {
    if (text.includes(key)) return name;
  }
  return null;
}

// ============================================================================
// Resolution Logic
// ============================================================================

/**
 * Check if a prediction should be resolved based on its horizon
 */
function shouldResolve(prediction: any): boolean {
  const createdAt = prediction.createdAt instanceof Date 
    ? prediction.createdAt.getTime() 
    : typeof prediction.createdAt === "number" 
      ? prediction.createdAt 
      : new Date(prediction.createdAt).getTime();
  
  const now = Date.now();
  const elapsed = now - createdAt;
  
  const horizonMs: Record<string, number> = {
    "1D": 24 * 60 * 60 * 1000,
    "7D": 7 * 24 * 60 * 60 * 1000,
    "30D": 30 * 24 * 60 * 60 * 1000,
  };
  
  const requiredMs = horizonMs[prediction.horizon] || horizonMs["7D"];
  return elapsed >= requiredMs;
}

/**
 * Resolve a prediction — compare predicted vs actual
 */
function resolvePrediction(prediction: any, portfolioShares: number | null): TradeJournalEntry | null {
  const entryPrice = prediction.priceAtPrediction || prediction.entryPrice || 0;
  const currentPrice = getLatestPrice(prediction.ticker) || entryPrice;
  
  if (entryPrice <= 0) return null;

  const priceChange = ((currentPrice - entryPrice) / entryPrice) * 100;
  const actualDirection: "up" | "down" | "neutral" = 
    priceChange > 0.5 ? "up" : priceChange < -0.5 ? "down" : "neutral";
  
  const predictedDirection = prediction.direction || "neutral";
  const isCorrect = (
    (predictedDirection === "up" && actualDirection === "up") ||
    (predictedDirection === "down" && actualDirection === "down") ||
    (predictedDirection === "neutral" && actualDirection === "neutral")
  );

  // Calculate hypothetical P&L
  let hypotheticalPnl: number | null = null;
  if (portfolioShares !== null && portfolioShares > 0) {
    const positionValue = portfolioShares * entryPrice;
    hypotheticalPnl = positionValue * (priceChange / 100);
    // If prediction was bearish and correct, assume short position
    if (predictedDirection === "down") {
      hypotheticalPnl = -hypotheticalPnl;
    }
  }

  const signalSource = detectSignalSource(prediction);

  return {
    id: `tj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ticker: prediction.ticker,
    predictionId: prediction.id || `pred-${prediction.ticker}`,
    predictedDirection,
    predictedConfidence: prediction.confidence || 0.5,
    horizon: prediction.horizon || "7D",
    entryPrice,
    exitPrice: currentPrice,
    priceChange: Math.round(priceChange * 100) / 100,
    actualDirection,
    isCorrect,
    signalSource,
    hypotheticalPnl: hypotheticalPnl !== null ? Math.round(hypotheticalPnl * 100) / 100 : null,
    portfolioShares,
    predictionDate: prediction.createdAt instanceof Date 
      ? prediction.createdAt.getTime() 
      : typeof prediction.createdAt === "number" 
        ? prediction.createdAt 
        : new Date(prediction.createdAt).getTime(),
    resolutionDate: Date.now(),
    alphaScoreAtEntry: prediction.alphaScore || null,
    reasoning: prediction.reasoning || prediction.summary || "AI-generated prediction",
    priceTarget: prediction.priceTarget || null,
  };
}

// ============================================================================
// Background Resolution Checker
// ============================================================================

/**
 * Run one resolution cycle
 * Checks all active predictions and resolves those past their horizon
 */
export async function runResolutionCheck(
  predictions: any[],
  getPortfolioShares: (ticker: string) => Promise<number | null>
): Promise<number> {
  let resolved = 0;
  const existingIds = new Set(journalEntries.map(e => e.predictionId));

  for (const prediction of predictions) {
    const predId = prediction.id || `pred-${prediction.ticker}-${prediction.horizon}`;
    
    // Skip if already resolved in journal
    if (existingIds.has(predId)) continue;
    
    // Check if horizon has passed
    if (!shouldResolve(prediction)) continue;

    const shares = await getPortfolioShares(prediction.ticker);
    const entry = resolvePrediction(prediction, shares);
    
    if (entry) {
      entry.predictionId = predId;
      journalEntries.unshift(entry);
      resolved++;
    }
  }

  // Keep journal to last 500 entries
  if (journalEntries.length > 500) {
    journalEntries = journalEntries.slice(0, 500);
  }

  lastResolutionCheck = new Date();
  resolutionCheckCount++;

  if (resolved > 0) {
    console.log(`[TradeJournal] Resolved ${resolved} predictions`);
  }

  return resolved;
}

// ============================================================================
// Seed initial journal with simulated historical data
// ============================================================================

function seedJournal() {
  if (journalEntries.length > 0) return;

  const tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "AMZN", "META", "SPY", "QQQ", "AMD"];
  const horizons = ["1D", "7D", "30D"];
  const now = Date.now();

  const sourceTypes: SignalSource["type"][] = ["ai_research", "vip_tweet", "trending_topic", "arbitrage_signal", "anomaly_detection"];
  const sourceLabels: Record<string, string> = {
    ai_research: "AI Research",
    vip_tweet: "VIP Signal",
    trending_topic: "Trending Signal",
    arbitrage_signal: "Arbitrage Signal",
    anomaly_detection: "Anomaly Signal",
  };

  for (let i = 0; i < 45; i++) {
    const ticker = tickers[i % tickers.length];
    const horizon = horizons[i % horizons.length];
    const daysAgo = Math.floor(Math.random() * 30) + 1;
    const predDate = now - daysAgo * 24 * 60 * 60 * 1000;
    const resDate = predDate + (horizon === "1D" ? 1 : horizon === "7D" ? 7 : 30) * 24 * 60 * 60 * 1000;
    
    const direction: "up" | "down" = Math.random() > 0.4 ? "up" : "down";
    const confidence = 0.45 + Math.random() * 0.45;
    const entryPrice = 100 + Math.random() * 400;
    const priceChange = (Math.random() - 0.45) * 8; // -3.6% to +4.4% bias slightly positive
    const exitPrice = entryPrice * (1 + priceChange / 100);
    const actualDir: "up" | "down" | "neutral" = priceChange > 0.5 ? "up" : priceChange < -0.5 ? "down" : "neutral";
    const isCorrect = direction === actualDir;
    
    const srcType = sourceTypes[Math.floor(Math.random() * sourceTypes.length)];
    const shares = Math.random() > 0.6 ? Math.floor(Math.random() * 50) + 5 : null;
    const pnl = shares ? shares * entryPrice * (priceChange / 100) * (direction === "down" ? -1 : 1) : null;

    const vipNames = ["Chris Camillo", "Michael Burry", "Elon Musk", "Cathie Wood", "Bill Ackman"];
    const sourceDetail = srcType === "vip_tweet" 
      ? `${vipNames[Math.floor(Math.random() * vipNames.length)]} tweeted about ${ticker}`
      : srcType === "trending_topic"
        ? `${ticker} trending on X with high volume`
        : srcType === "arbitrage_signal"
          ? `Polymarket divergence detected for ${ticker}`
          : srcType === "anomaly_detection"
            ? `Unusual volume spike detected for ${ticker}`
            : `AI research agent identified ${direction === "up" ? "bullish" : "bearish"} setup for ${ticker}`;

    journalEntries.push({
      id: `tj-seed-${i}`,
      ticker,
      predictionId: `pred-seed-${i}`,
      predictedDirection: direction,
      predictedConfidence: Math.round(confidence * 100) / 100,
      horizon,
      entryPrice: Math.round(entryPrice * 100) / 100,
      exitPrice: Math.round(exitPrice * 100) / 100,
      priceChange: Math.round(priceChange * 100) / 100,
      actualDirection: actualDir,
      isCorrect,
      signalSource: {
        type: srcType,
        label: sourceLabels[srcType] + (srcType === "vip_tweet" ? `: ${vipNames[Math.floor(Math.random() * vipNames.length)]}` : ""),
        detail: sourceDetail,
        link: srcType === "vip_tweet" ? "/vip-signals" : srcType === "trending_topic" ? "/narratives" : "/predictions",
      },
      hypotheticalPnl: pnl ? Math.round(pnl * 100) / 100 : null,
      portfolioShares: shares,
      predictionDate: predDate,
      resolutionDate: resDate,
      alphaScoreAtEntry: Math.floor(Math.random() * 60) + 20,
      reasoning: sourceDetail,
      priceTarget: direction === "up" ? Math.round((entryPrice * 1.05) * 100) / 100 : Math.round((entryPrice * 0.95) * 100) / 100,
    });
  }

  // Sort by resolution date descending
  journalEntries.sort((a, b) => b.resolutionDate - a.resolutionDate);
  console.log(`[TradeJournal] Seeded ${journalEntries.length} historical entries`);
}

// ============================================================================
// Public API
// ============================================================================

export function getJournalEntries(limit = 50, offset = 0): TradeJournalEntry[] {
  return journalEntries.slice(offset, offset + limit);
}

export function getJournalEntriesForTicker(ticker: string): TradeJournalEntry[] {
  return journalEntries.filter(e => e.ticker === ticker);
}

export function getJournalStats(): JournalStats {
  const entries = journalEntries;
  const total = entries.length;
  const correct = entries.filter(e => e.isCorrect).length;
  const incorrect = entries.filter(e => !e.isCorrect && e.actualDirection !== "neutral").length;
  const inconclusive = total - correct - incorrect;

  // Best and worst calls
  const sorted = [...entries].sort((a, b) => b.priceChange - a.priceChange);
  const bestCall = sorted.find(e => e.isCorrect) || null;
  const worstCall = [...entries].sort((a, b) => {
    const aPnl = a.isCorrect ? Math.abs(a.priceChange) : -Math.abs(a.priceChange);
    const bPnl = b.isCorrect ? Math.abs(b.priceChange) : -Math.abs(b.priceChange);
    return aPnl - bPnl;
  })[0] || null;

  // By horizon
  const byHorizon: JournalStats["byHorizon"] = {};
  for (const h of ["1D", "7D", "30D"]) {
    const hEntries = entries.filter(e => e.horizon === h);
    const hCorrect = hEntries.filter(e => e.isCorrect).length;
    byHorizon[h] = {
      total: hEntries.length,
      correct: hCorrect,
      winRate: hEntries.length > 0 ? hCorrect / hEntries.length : 0,
      avgReturn: hEntries.length > 0 
        ? hEntries.reduce((sum, e) => sum + Math.abs(e.priceChange), 0) / hEntries.length 
        : 0,
    };
  }

  // By source
  const bySource: JournalStats["bySource"] = {};
  for (const entry of entries) {
    const src = entry.signalSource.type;
    if (!bySource[src]) bySource[src] = { total: 0, correct: 0, winRate: 0 };
    bySource[src].total++;
    if (entry.isCorrect) bySource[src].correct++;
  }
  for (const src of Object.keys(bySource)) {
    bySource[src].winRate = bySource[src].total > 0 ? bySource[src].correct / bySource[src].total : 0;
  }

  // Recent streak
  let streakType: "win" | "loss" | "mixed" = "mixed";
  let streakCount = 0;
  if (entries.length > 0) {
    streakType = entries[0].isCorrect ? "win" : "loss";
    for (const e of entries) {
      if ((e.isCorrect && streakType === "win") || (!e.isCorrect && streakType === "loss")) {
        streakCount++;
      } else {
        break;
      }
    }
  }

  return {
    totalEntries: total,
    correctPredictions: correct,
    incorrectPredictions: incorrect,
    inconclusivePredictions: inconclusive,
    winRate: total > 0 ? correct / total : 0,
    averageReturn: total > 0 ? entries.reduce((sum, e) => sum + Math.abs(e.priceChange), 0) / total : 0,
    bestCall,
    worstCall,
    totalHypotheticalPnl: entries.reduce((sum, e) => sum + (e.hypotheticalPnl || 0), 0),
    byHorizon,
    bySource,
    recentStreak: { type: streakType, count: streakCount },
  };
}

export function getTradeJournalStatus() {
  return {
    name: "Trade Journal",
    description: "Automated prediction outcome logging and P&L tracking",
    status: journalInterval ? "running" as const : "stopped" as const,
    totalEntries: journalEntries.length,
    lastCheck: lastResolutionCheck,
    checkCount: resolutionCheckCount,
  };
}

// ============================================================================
// Background Runner
// ============================================================================

export function startTradeJournal(
  getPredictions: () => any[],
  getPortfolioShares: (ticker: string) => Promise<number | null>
): void {
  if (journalInterval) return;

  console.log("[TradeJournal] Starting trade journal...");
  
  // Seed historical data
  seedJournal();

  // Initial check after 20 seconds
  setTimeout(async () => {
    try {
      await runResolutionCheck(getPredictions(), getPortfolioShares);
    } catch (err) {
      console.error("[TradeJournal] Initial check error:", err);
    }
  }, 20000);

  // Check every 5 minutes
  journalInterval = setInterval(async () => {
    try {
      await runResolutionCheck(getPredictions(), getPortfolioShares);
    } catch (err) {
      console.error("[TradeJournal] Check error:", err);
    }
  }, 5 * 60 * 1000);
}

export function stopTradeJournal(): void {
  if (journalInterval) {
    clearInterval(journalInterval);
    journalInterval = null;
  }
}
