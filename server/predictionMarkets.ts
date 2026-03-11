/**
 * Prediction Markets Ingestion — Polymarket & Kalshi
 * 
 * Pulls real prediction market data from public APIs:
 * - Polymarket: https://gamma-api.polymarket.com
 * - Kalshi: https://trading-api.kalshi.com/trade-api/v2
 * 
 * Falls back to realistic simulation when APIs are unavailable.
 * Markets are linked to tickers for signal confidence scoring.
 */

import { getDb } from "./db";
import {
  predictionMarkets,
  type PredictionMarket, type InsertPredictionMarket,
} from "../drizzle/schema";
import { desc, eq, sql, gte, and } from "drizzle-orm";

// ============================================================================
// Configuration
// ============================================================================

const POLYMARKET_API = "https://gamma-api.polymarket.com";
const KALSHI_API = "https://trading-api.kalshi.com/trade-api/v2";

// Finance/economics related keywords for filtering
const FINANCE_KEYWORDS = [
  "fed", "rate", "inflation", "gdp", "recession", "stock", "market",
  "bitcoin", "crypto", "oil", "gold", "unemployment", "tariff", "trade",
  "earnings", "ipo", "s&p", "nasdaq", "dow", "treasury", "bond",
  "interest rate", "cpi", "ppi", "nonfarm", "payroll", "housing",
  "debt ceiling", "default", "bank", "financial", "economy", "economic",
];

// Ticker mapping for prediction market questions
const MARKET_TICKER_MAP: Record<string, string[]> = {
  "fed": ["SPY", "QQQ", "TLT", "GLD"],
  "rate": ["SPY", "TLT", "XLF"],
  "inflation": ["SPY", "TLT", "GLD", "TIP"],
  "recession": ["SPY", "QQQ", "VIX", "TLT"],
  "bitcoin": ["COIN", "MARA", "MSTR"],
  "crypto": ["COIN", "MARA", "RIOT"],
  "oil": ["XLE", "USO", "CVX", "XOM"],
  "gold": ["GLD", "GDX", "NEM"],
  "stock market": ["SPY", "QQQ"],
  "nasdaq": ["QQQ", "NVDA", "AAPL"],
  "s&p": ["SPY"],
  "tariff": ["AAPL", "TSLA", "NKE", "FXI"],
  "tesla": ["TSLA"],
  "nvidia": ["NVDA"],
  "apple": ["AAPL"],
  "microsoft": ["MSFT"],
  "google": ["GOOGL"],
  "amazon": ["AMZN"],
  "meta": ["META"],
  "bank": ["XLF", "JPM", "BAC", "GS"],
  "housing": ["XHB", "ITB", "LEN"],
  "unemployment": ["SPY", "XLF"],
};

// ============================================================================
// Simulated Market Templates (fallback when APIs unavailable)
// ============================================================================

interface MarketTemplate {
  title: string;
  category: string;
  relatedTickers: string[];
  baseProb: number; // 0-100
}

const SIMULATED_MARKETS: MarketTemplate[] = [
  // Fed / Macro
  { title: "Fed to cut rates by 25bps at March 2026 meeting?", category: "fed", relatedTickers: ["SPY", "QQQ", "TLT"], baseProb: 62 },
  { title: "US enters recession by Q4 2026?", category: "macro", relatedTickers: ["SPY", "VIX", "TLT", "GLD"], baseProb: 18 },
  { title: "CPI above 3% for March 2026?", category: "macro", relatedTickers: ["SPY", "TLT", "GLD"], baseProb: 35 },
  { title: "10-year Treasury yield above 4.5% by June 2026?", category: "macro", relatedTickers: ["TLT", "XLF", "SPY"], baseProb: 44 },
  { title: "US unemployment rate above 4.5% by June 2026?", category: "macro", relatedTickers: ["SPY", "XLF"], baseProb: 22 },
  { title: "S&P 500 above 6000 by end of 2026?", category: "market", relatedTickers: ["SPY", "QQQ"], baseProb: 55 },
  { title: "Nasdaq 100 new all-time high in Q2 2026?", category: "market", relatedTickers: ["QQQ", "NVDA", "AAPL"], baseProb: 68 },

  // Tech / Earnings
  { title: "NVDA market cap exceeds $4T by end of 2026?", category: "earnings", relatedTickers: ["NVDA", "AMD", "AVGO"], baseProb: 42 },
  { title: "TSLA delivers 2M+ vehicles in 2026?", category: "earnings", relatedTickers: ["TSLA", "RIVN"], baseProb: 38 },
  { title: "AAPL launches AI-powered Siri upgrade in 2026?", category: "earnings", relatedTickers: ["AAPL", "MSFT", "GOOGL"], baseProb: 75 },
  { title: "Meta Reality Labs profitable by Q4 2026?", category: "earnings", relatedTickers: ["META"], baseProb: 12 },

  // Geopolitical
  { title: "New US-China tariffs announced by June 2026?", category: "geopolitical", relatedTickers: ["AAPL", "TSLA", "NKE", "FXI"], baseProb: 48 },
  { title: "Ukraine ceasefire agreement by end of 2026?", category: "geopolitical", relatedTickers: ["USO", "GLD", "LMT"], baseProb: 25 },
  { title: "US debt ceiling crisis in 2026?", category: "geopolitical", relatedTickers: ["SPY", "TLT", "VIX"], baseProb: 30 },

  // Crypto
  { title: "Bitcoin above $100K by end of 2026?", category: "crypto", relatedTickers: ["COIN", "MARA", "MSTR"], baseProb: 52 },
  { title: "Ethereum ETF approved in 2026?", category: "crypto", relatedTickers: ["COIN", "MARA"], baseProb: 70 },

  // Sector
  { title: "Oil above $90/barrel by Q3 2026?", category: "sector", relatedTickers: ["XLE", "USO", "CVX", "XOM"], baseProb: 28 },
  { title: "Gold above $2500/oz by end of 2026?", category: "sector", relatedTickers: ["GLD", "GDX", "NEM"], baseProb: 60 },
  { title: "Major US bank failure in 2026?", category: "sector", relatedTickers: ["XLF", "JPM", "BAC"], baseProb: 8 },
  { title: "AI chip shortage worsens in H2 2026?", category: "sector", relatedTickers: ["NVDA", "AMD", "AVGO", "SMCI"], baseProb: 45 },
];

// ============================================================================
// Real API Fetchers
// ============================================================================

async function fetchPolymarketData(): Promise<InsertPredictionMarket[]> {
  const markets: InsertPredictionMarket[] = [];

  try {
    // Polymarket CLOB API for active markets
    const response = await fetch(`${POLYMARKET_API}/markets?closed=false&limit=50`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[PredictionMarkets] Polymarket API returned ${response.status}`);
      return markets;
    }

    const data = await response.json();
    const marketList = Array.isArray(data) ? data : (data.data || data.markets || []);

    for (const m of marketList) {
      const title = (m.question || m.title || "").toLowerCase();
      const isFinance = FINANCE_KEYWORDS.some(kw => title.includes(kw));
      if (!isFinance) continue;

      // Extract related tickers
      const relatedTickers: string[] = [];
      for (const [keyword, tickers] of Object.entries(MARKET_TICKER_MAP)) {
        if (title.includes(keyword)) {
          relatedTickers.push(...tickers);
        }
      }
      const uniqueTickers = Array.from(new Set(relatedTickers)).slice(0, 5);

      const prob = Math.round((m.outcomePrices?.[0] || m.bestBid || m.lastTradePrice || 0.5) * 100);

      markets.push({
        platform: "polymarket",
        externalId: String(m.id || m.conditionId || m.slug),
        title: m.question || m.title || "Unknown Market",
        yesProbability: Math.max(1, Math.min(99, prob)),
        previousProbability: null,
        probabilityChange24h: 0,
        volume: Math.round((m.volume || m.volumeNum || 0)),
        volume24h: Math.round((m.volume24hr || 0)),
        liquidity: Math.round((m.liquidity || m.liquidityNum || 0)),
        relatedTickers: JSON.stringify(uniqueTickers),
        category: categorizeMarket(title),
        isHot: (m.volume24hr || 0) > 100000 ? 1 : 0,
        endDate: m.endDate ? new Date(m.endDate) : null,
        status: "active",
        resolution: null,
      });
    }

    console.log(`[PredictionMarkets] Fetched ${markets.length} finance markets from Polymarket`);
  } catch (error: any) {
    console.warn(`[PredictionMarkets] Polymarket fetch failed: ${error.message}`);
  }

  return markets;
}

async function fetchKalshiData(): Promise<InsertPredictionMarket[]> {
  const markets: InsertPredictionMarket[] = [];

  try {
    const response = await fetch(`${KALSHI_API}/markets?limit=50&status=open`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[PredictionMarkets] Kalshi API returned ${response.status}`);
      return markets;
    }

    const data = await response.json();
    const marketList = data.markets || data.data || [];

    for (const m of marketList) {
      const title = (m.title || m.subtitle || "").toLowerCase();
      const isFinance = FINANCE_KEYWORDS.some(kw => title.includes(kw));
      if (!isFinance) continue;

      const relatedTickers: string[] = [];
      for (const [keyword, tickers] of Object.entries(MARKET_TICKER_MAP)) {
        if (title.includes(keyword)) {
          relatedTickers.push(...tickers);
        }
      }
      const uniqueTickers = Array.from(new Set(relatedTickers)).slice(0, 5);

      const prob = Math.round((m.yes_bid || m.last_price || 0.5) * 100);

      markets.push({
        platform: "kalshi",
        externalId: m.ticker || m.id || "unknown",
        title: m.title || m.subtitle || "Unknown Market",
        yesProbability: Math.max(1, Math.min(99, prob)),
        previousProbability: null,
        probabilityChange24h: 0,
        volume: m.volume || 0,
        volume24h: m.volume_24h || 0,
        liquidity: m.open_interest || 0,
        relatedTickers: JSON.stringify(uniqueTickers),
        category: categorizeMarket(title),
        isHot: (m.volume_24h || 0) > 5000 ? 1 : 0,
        endDate: m.expiration_time ? new Date(m.expiration_time) : null,
        status: "active",
        resolution: null,
      });
    }

    console.log(`[PredictionMarkets] Fetched ${markets.length} finance markets from Kalshi`);
  } catch (error: any) {
    console.warn(`[PredictionMarkets] Kalshi fetch failed: ${error.message}`);
  }

  return markets;
}

function categorizeMarket(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("fed") || lower.includes("rate") || lower.includes("inflation") || lower.includes("cpi")) return "fed";
  if (lower.includes("recession") || lower.includes("gdp") || lower.includes("unemployment")) return "macro";
  if (lower.includes("bitcoin") || lower.includes("crypto") || lower.includes("ethereum")) return "crypto";
  if (lower.includes("oil") || lower.includes("gold") || lower.includes("commodity")) return "commodity";
  if (lower.includes("tariff") || lower.includes("war") || lower.includes("china")) return "geopolitical";
  if (lower.includes("earning") || lower.includes("revenue") || lower.includes("profit")) return "earnings";
  if (lower.includes("s&p") || lower.includes("nasdaq") || lower.includes("dow") || lower.includes("market")) return "market";
  return "other";
}

// ============================================================================
// Simulated Market Generation (fallback)
// ============================================================================

function generateSimulatedMarkets(): InsertPredictionMarket[] {
  return SIMULATED_MARKETS.map((template, i) => {
    // Add realistic variance
    const probVariance = Math.floor(Math.random() * 10 - 5);
    const prob = Math.max(2, Math.min(98, template.baseProb + probVariance));
    const prevProb = Math.max(2, Math.min(98, prob + Math.floor(Math.random() * 8 - 4)));
    const change24h = prob - prevProb;

    const volume = Math.floor(Math.random() * 5000000 + 100000);
    const volume24h = Math.floor(volume * (Math.random() * 0.15 + 0.02));
    const liquidity = Math.floor(Math.random() * 2000000 + 50000);

    return {
      platform: (i % 3 === 0 ? "kalshi" : "polymarket") as "polymarket" | "kalshi",
      externalId: `sim_${template.category}_${i}`,
      title: template.title,
      yesProbability: prob,
      previousProbability: prevProb,
      probabilityChange24h: change24h,
      volume,
      volume24h,
      liquidity,
      relatedTickers: JSON.stringify(template.relatedTickers),
      category: template.category,
      isHot: volume24h > 200000 ? 1 : 0,
      endDate: new Date(Date.now() + Math.floor(Math.random() * 180 + 30) * 86400000),
      status: "active" as const,
      resolution: null,
    };
  });
}

// ============================================================================
// Ingestion Cycle
// ============================================================================

let marketInterval: ReturnType<typeof setInterval> | null = null;
let lastFetch: Date | null = null;
let fetchCycleCount = 0;
let realDataAvailable = false;

async function runMarketIngestion(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    let allMarkets: InsertPredictionMarket[] = [];

    // Try real APIs first
    const [polymarkets, kalshiMarkets] = await Promise.allSettled([
      fetchPolymarketData(),
      fetchKalshiData(),
    ]);

    if (polymarkets.status === "fulfilled" && polymarkets.value.length > 0) {
      allMarkets.push(...polymarkets.value);
      realDataAvailable = true;
    }
    if (kalshiMarkets.status === "fulfilled" && kalshiMarkets.value.length > 0) {
      allMarkets.push(...kalshiMarkets.value);
      realDataAvailable = true;
    }

    // Fallback to simulation if no real data
    if (allMarkets.length === 0) {
      allMarkets = generateSimulatedMarkets();
      realDataAvailable = false;
      console.log("[PredictionMarkets] Using simulated data (APIs unavailable)");
    }

    // Upsert markets
    for (const market of allMarkets) {
      try {
        // Check if market already exists
        const existing = await db.select().from(predictionMarkets)
          .where(and(
            eq(predictionMarkets.platform, market.platform),
            eq(predictionMarkets.externalId, market.externalId),
          ))
          .limit(1);

        if (existing.length > 0) {
          // Update existing
          await db.update(predictionMarkets)
            .set({
              yesProbability: market.yesProbability,
              previousProbability: existing[0].yesProbability,
              probabilityChange24h: market.yesProbability - (existing[0].yesProbability || market.yesProbability),
              volume: market.volume,
              volume24h: market.volume24h,
              liquidity: market.liquidity,
              isHot: market.isHot,
              lastFetchedAt: new Date(),
            })
            .where(eq(predictionMarkets.id, existing[0].id));
        } else {
          // Insert new
          await db.insert(predictionMarkets).values(market);
        }
      } catch (err) {
        // Ignore individual market errors
      }
    }

    lastFetch = new Date();
    fetchCycleCount++;
    console.log(`[PredictionMarkets] Ingested ${allMarkets.length} markets (cycle ${fetchCycleCount}, real=${realDataAvailable})`);
  } catch (error) {
    console.error("[PredictionMarkets] Ingestion error:", error);
  }
}

// ============================================================================
// Query Functions
// ============================================================================

export async function getActiveMarkets(limit = 20): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(predictionMarkets)
    .where(eq(predictionMarkets.status, "active"))
    .orderBy(desc(predictionMarkets.volume24h))
    .limit(limit);
}

export async function getHotMarkets(limit = 5): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(predictionMarkets)
    .where(and(
      eq(predictionMarkets.status, "active"),
      eq(predictionMarkets.isHot, 1),
    ))
    .orderBy(desc(predictionMarkets.volume24h))
    .limit(limit);
}

export async function getMarketsForTicker(ticker: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  // Search for markets that have this ticker in relatedTickers JSON
  const allActive = await db.select().from(predictionMarkets)
    .where(eq(predictionMarkets.status, "active"));

  return allActive.filter(m => {
    try {
      const tickers = JSON.parse(m.relatedTickers || "[]");
      return tickers.includes(ticker);
    } catch {
      return false;
    }
  });
}

export async function getMarketStats(): Promise<{
  totalMarkets: number;
  polymarketCount: number;
  kalshiCount: number;
  hotCount: number;
  avgProbability: number;
  totalVolume: number;
  realDataAvailable: boolean;
  lastFetch: Date | null;
  fetchCycleCount: number;
}> {
  const db = await getDb();
  if (!db) return {
    totalMarkets: 0, polymarketCount: 0, kalshiCount: 0,
    hotCount: 0, avgProbability: 50, totalVolume: 0,
    realDataAvailable: false, lastFetch: null, fetchCycleCount: 0,
  };

  const active = await db.select().from(predictionMarkets)
    .where(eq(predictionMarkets.status, "active"));

  const polymarketCount = active.filter(m => m.platform === "polymarket").length;
  const kalshiCount = active.filter(m => m.platform === "kalshi").length;
  const hotCount = active.filter(m => m.isHot).length;
  const avgProbability = active.length > 0
    ? Math.round(active.reduce((sum, m) => sum + m.yesProbability, 0) / active.length)
    : 50;
  const totalVolume = active.reduce((sum, m) => sum + (m.volume || 0), 0);

  return {
    totalMarkets: active.length,
    polymarketCount,
    kalshiCount,
    hotCount,
    avgProbability,
    totalVolume,
    realDataAvailable,
    lastFetch,
    fetchCycleCount,
  };
}

// ============================================================================
// Start/Stop
// ============================================================================

export function startPredictionMarketIngestion(): void {
  if (marketInterval) return;

  // Run immediately
  setTimeout(() => runMarketIngestion(), 5000);

  // Then every 10 minutes
  marketInterval = setInterval(runMarketIngestion, 10 * 60 * 1000);
  console.log("[PredictionMarkets] Started — fetching every 10 minutes");
}

export function stopPredictionMarketIngestion(): void {
  if (marketInterval) {
    clearInterval(marketInterval);
    marketInterval = null;
    console.log("[PredictionMarkets] Stopped");
  }
}

export function getPredictionMarketIngestionStatus(): {
  isActive: boolean;
  lastFetch: Date | null;
  fetchCycleCount: number;
  realDataAvailable: boolean;
} {
  return {
    isActive: marketInterval !== null,
    lastFetch,
    fetchCycleCount,
    realDataAvailable,
  };
}
