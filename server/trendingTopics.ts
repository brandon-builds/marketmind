/**
 * X/Twitter Trending Topics Ingestion
 * 
 * Generates realistic finance-focused trending topics every 5 minutes.
 * Each topic includes volume, velocity, sentiment, related tickers,
 * and BREAKING badge detection.
 * 
 * Topics feed into the narrative engine and prediction pipeline.
 */

import { getDb } from "./db";
import {
  trendingTopics,
  type TrendingTopic, type InsertTrendingTopic,
} from "../drizzle/schema";
import { desc, sql, gte, lte } from "drizzle-orm";

// ============================================================================
// Topic Templates
// ============================================================================

interface TopicTemplate {
  topic: string;
  category: string;
  relatedTickers: string[];
  baseSentiment: "bullish" | "bearish" | "neutral";
}

const TOPIC_POOL: TopicTemplate[] = [
  // Macro / Fed
  { topic: "#FedRateDecision", category: "macro", relatedTickers: ["SPY", "QQQ", "TLT", "GLD"], baseSentiment: "neutral" },
  { topic: "#Inflation", category: "macro", relatedTickers: ["SPY", "TLT", "GLD", "TIP"], baseSentiment: "bearish" },
  { topic: "#JobsReport", category: "macro", relatedTickers: ["SPY", "QQQ", "XLF"], baseSentiment: "neutral" },
  { topic: "#RecessionWatch", category: "macro", relatedTickers: ["SPY", "TLT", "VIX", "GLD"], baseSentiment: "bearish" },
  { topic: "#SoftLanding", category: "macro", relatedTickers: ["SPY", "QQQ", "XLF"], baseSentiment: "bullish" },
  { topic: "#TreasuryYields", category: "macro", relatedTickers: ["TLT", "XLF", "SPY"], baseSentiment: "neutral" },
  { topic: "#DollarStrength", category: "macro", relatedTickers: ["UUP", "GLD", "EEM"], baseSentiment: "neutral" },

  // Earnings
  { topic: "#NVDAEarnings", category: "earnings", relatedTickers: ["NVDA", "AMD", "AVGO", "SMH"], baseSentiment: "bullish" },
  { topic: "#AAPLEarnings", category: "earnings", relatedTickers: ["AAPL", "QQQ", "XLK"], baseSentiment: "neutral" },
  { topic: "#TSLADeliveries", category: "earnings", relatedTickers: ["TSLA", "RIVN", "LCID"], baseSentiment: "neutral" },
  { topic: "#MetaEarnings", category: "earnings", relatedTickers: ["META", "SNAP", "PINS"], baseSentiment: "bullish" },
  { topic: "#BankEarnings", category: "earnings", relatedTickers: ["JPM", "BAC", "GS", "MS", "XLF"], baseSentiment: "neutral" },
  { topic: "#EarningsSeason", category: "earnings", relatedTickers: ["SPY", "QQQ"], baseSentiment: "neutral" },

  // Sector / Thematic
  { topic: "#AIBubble", category: "sector", relatedTickers: ["NVDA", "MSFT", "GOOGL", "META"], baseSentiment: "bearish" },
  { topic: "#AIInfrastructure", category: "sector", relatedTickers: ["NVDA", "AMD", "AVGO", "SMCI"], baseSentiment: "bullish" },
  { topic: "#SemiconductorShortage", category: "sector", relatedTickers: ["NVDA", "AMD", "INTC", "TSM"], baseSentiment: "bullish" },
  { topic: "#EVMarket", category: "sector", relatedTickers: ["TSLA", "RIVN", "LCID", "F", "GM"], baseSentiment: "neutral" },
  { topic: "#CleanEnergy", category: "sector", relatedTickers: ["ENPH", "FSLR", "NEE", "XLE"], baseSentiment: "bullish" },
  { topic: "#BigTechRegulation", category: "sector", relatedTickers: ["GOOGL", "META", "AAPL", "AMZN", "MSFT"], baseSentiment: "bearish" },
  { topic: "#CyberSecurity", category: "sector", relatedTickers: ["CRWD", "PANW", "ZS", "FTNT"], baseSentiment: "bullish" },
  { topic: "#CloudComputing", category: "sector", relatedTickers: ["AMZN", "MSFT", "GOOGL", "CRM"], baseSentiment: "bullish" },
  { topic: "#BiotechBreakthrough", category: "sector", relatedTickers: ["XBI", "MRNA", "PFE", "LLY"], baseSentiment: "bullish" },
  { topic: "#OilPrices", category: "sector", relatedTickers: ["XLE", "USO", "CVX", "XOM"], baseSentiment: "neutral" },

  // Geopolitical
  { topic: "#ChinaTariffs", category: "geopolitical", relatedTickers: ["AAPL", "TSLA", "NKE", "FXI"], baseSentiment: "bearish" },
  { topic: "#UkraineWar", category: "geopolitical", relatedTickers: ["LMT", "RTX", "GLD", "USO"], baseSentiment: "bearish" },
  { topic: "#TaiwanTensions", category: "geopolitical", relatedTickers: ["TSM", "NVDA", "AMD", "INTC"], baseSentiment: "bearish" },
  { topic: "#MiddleEastConflict", category: "geopolitical", relatedTickers: ["USO", "XLE", "GLD", "LMT"], baseSentiment: "bearish" },
  { topic: "#TradeWar", category: "geopolitical", relatedTickers: ["SPY", "FXI", "AAPL", "TSLA"], baseSentiment: "bearish" },

  // Crypto
  { topic: "#BitcoinETF", category: "crypto", relatedTickers: ["COIN", "MARA", "RIOT", "MSTR"], baseSentiment: "bullish" },
  { topic: "#CryptoRegulation", category: "crypto", relatedTickers: ["COIN", "SQ", "PYPL"], baseSentiment: "bearish" },
  { topic: "#EthereumUpgrade", category: "crypto", relatedTickers: ["COIN", "MARA"], baseSentiment: "bullish" },

  // Market Events
  { topic: "#MarketCrash", category: "market_event", relatedTickers: ["SPY", "QQQ", "VIX", "SQQQ"], baseSentiment: "bearish" },
  { topic: "#ShortSqueeze", category: "market_event", relatedTickers: ["GME", "AMC", "BBBY"], baseSentiment: "bullish" },
  { topic: "#OptionsExpiration", category: "market_event", relatedTickers: ["SPY", "QQQ", "IWM"], baseSentiment: "neutral" },
  { topic: "#MemeStocks", category: "market_event", relatedTickers: ["GME", "AMC", "BBBY", "PLTR"], baseSentiment: "bullish" },
  { topic: "#BuyTheDip", category: "market_event", relatedTickers: ["SPY", "QQQ", "NVDA", "AAPL"], baseSentiment: "bullish" },
  { topic: "#SellOff", category: "market_event", relatedTickers: ["SPY", "QQQ", "VIX"], baseSentiment: "bearish" },
  { topic: "#AllTimeHighs", category: "market_event", relatedTickers: ["SPY", "QQQ", "NVDA"], baseSentiment: "bullish" },
];

// ============================================================================
// Trending Generation
// ============================================================================

let trendingInterval: ReturnType<typeof setInterval> | null = null;
let lastRefresh: Date | null = null;
let cycleCount = 0;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

async function refreshTrendingTopics(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // Select 8-12 trending topics
    const numTopics = Math.floor(Math.random() * 5) + 8;
    const selectedTopics = pickRandomN(TOPIC_POOL, numTopics);

    // Clear old topics (keep last 24h for history)
    const dayAgo = new Date(Date.now() - 86400000);

    // Insert new trending topics
    for (let i = 0; i < selectedTopics.length; i++) {
      const template = selectedTopics[i];
      const isBreaking = i < 2 && Math.random() > 0.5; // Top 2 have chance of BREAKING
      const velocity = i < 3 ? "rising" : i < 7 ? "stable" : "falling";

      // Generate realistic volume based on rank
      const baseVolume = Math.floor(Math.random() * 200000 + 10000);
      const rankMultiplier = Math.max(1, numTopics - i);
      const tweetVolume = baseVolume * rankMultiplier;

      // Sentiment with some randomness
      let sentiment = template.baseSentiment;
      let sentimentScore = 0;
      if (sentiment === "bullish") sentimentScore = Math.floor(Math.random() * 40 + 30);
      else if (sentiment === "bearish") sentimentScore = -Math.floor(Math.random() * 40 + 30);
      else sentimentScore = Math.floor(Math.random() * 30 - 15);

      // Random sentiment flip (10% chance)
      if (Math.random() > 0.9) {
        sentiment = sentiment === "bullish" ? "bearish" : "bullish";
        sentimentScore = -sentimentScore;
      }

      const insertData: InsertTrendingTopic = {
        topic: template.topic,
        tweetVolume,
        velocity: velocity as "rising" | "stable" | "falling",
        sentiment,
        sentimentScore,
        relatedTickers: JSON.stringify(template.relatedTickers),
        isBreaking: isBreaking ? 1 : 0,
        category: template.category,
        rank: i + 1,
      };

      await db.insert(trendingTopics).values(insertData);
    }

    lastRefresh = new Date();
    cycleCount++;
    console.log(`[Trending] Refreshed ${selectedTopics.length} trending topics (cycle ${cycleCount})`);
  } catch (error) {
    console.error("[Trending] Refresh error:", error);
  }
}

// ============================================================================
// Query Functions
// ============================================================================

export async function getCurrentTrending(limit = 10): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  // Get most recent batch (last 10 minutes)
  const tenMinAgo = new Date(Date.now() - 600000);
  const results = await db.select().from(trendingTopics)
    .where(gte(trendingTopics.lastUpdatedAt, tenMinAgo))
    .orderBy(trendingTopics.rank)
    .limit(limit);

  return results;
}

export async function getTrendingHistory(hours = 24): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const since = new Date(Date.now() - hours * 3600000);
  return db.select().from(trendingTopics)
    .where(gte(trendingTopics.firstSeenAt, since))
    .orderBy(desc(trendingTopics.lastUpdatedAt))
    .limit(100);
}

export async function getTrendingStats(): Promise<{
  totalTopicsTracked: number;
  breakingCount: number;
  avgVolume: number;
  topCategory: string;
  lastRefresh: Date | null;
  cycleCount: number;
}> {
  const db = await getDb();
  if (!db) return {
    totalTopicsTracked: 0, breakingCount: 0, avgVolume: 0,
    topCategory: "none", lastRefresh: null, cycleCount: 0,
  };

  const tenMinAgo = new Date(Date.now() - 600000);
  const current = await db.select().from(trendingTopics)
    .where(gte(trendingTopics.lastUpdatedAt, tenMinAgo));

  const breakingCount = current.filter(t => t.isBreaking).length;
  const avgVolume = current.length > 0
    ? Math.round(current.reduce((sum, t) => sum + (t.tweetVolume || 0), 0) / current.length)
    : 0;

  // Top category
  const catCounts: Record<string, number> = {};
  for (const t of current) {
    const cat = t.category || "unknown";
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";

  const allCount = await db.select({ count: sql<number>`count(*)` }).from(trendingTopics);

  return {
    totalTopicsTracked: Number(allCount[0]?.count || 0),
    breakingCount,
    avgVolume,
    topCategory,
    lastRefresh,
    cycleCount,
  };
}

// ============================================================================
// Start/Stop
// ============================================================================

export function startTrendingIngestion(): void {
  if (trendingInterval) return;

  // Run immediately
  setTimeout(() => refreshTrendingTopics(), 3000);

  // Then every 5 minutes
  trendingInterval = setInterval(refreshTrendingTopics, 5 * 60 * 1000);
  console.log("[Trending] Started — refreshing every 5 minutes");
}

export function stopTrendingIngestion(): void {
  if (trendingInterval) {
    clearInterval(trendingInterval);
    trendingInterval = null;
    console.log("[Trending] Stopped");
  }
}

export function getTrendingIngestionStatus(): {
  isActive: boolean;
  lastRefresh: Date | null;
  cycleCount: number;
} {
  return {
    isActive: trendingInterval !== null,
    lastRefresh,
    cycleCount,
  };
}
