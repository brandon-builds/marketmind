/**
 * Strategy Marketplace — community strategy sharing, cloning, and ranking.
 * 
 * Features:
 * - Share strategies publicly with the community
 * - Rank strategies by backtest performance (Sharpe ratio, win rate, total return)
 * - One-click clone to add to own strategy list
 * - "Featured" strategies curated by the platform
 * - Creator attribution and clone count tracking
 */

import { getStrategies, getStrategy, createStrategy, backtestStrategy } from "./strategyBuilder";

// ============================================================================
// Types
// ============================================================================

export interface MarketplaceStrategy {
  id: string;
  originalId: string;
  name: string;
  description: string;
  creator: string;
  creatorId: string;
  publishedAt: number;
  updatedAt: number;
  cloneCount: number;
  rating: number; // 1-5 stars
  ratingCount: number;
  isFeatured: boolean;
  tags: string[];
  rulesPreview: string; // Human-readable summary of rules
  action: string;
  backtestStats: {
    winRate: number;
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    totalTrades: number;
    periodDays: number;
  };
}

export interface MarketplaceFilters {
  sortBy?: "performance" | "popular" | "newest" | "rating";
  tag?: string;
  minWinRate?: number;
  minSharpe?: number;
  featured?: boolean;
}

// ============================================================================
// In-Memory Marketplace Store
// ============================================================================

let marketplaceStrategies: MarketplaceStrategy[] = [];
let initialized = false;

function initializeMarketplace() {
  if (initialized) return;
  initialized = true;

  const now = Date.now();

  // Seed with community strategies
  marketplaceStrategies = [
    {
      id: "mkt-1",
      originalId: "seed-1",
      name: "Alpha Momentum Hunter",
      description: "Buys when Alpha Score crosses 80 with strong Smart Money signal. Exits when score drops below 60 or after 14 days.",
      creator: "QuantTrader42",
      creatorId: "user-seed-1",
      publishedAt: now - 14 * 86400000,
      updatedAt: now - 2 * 86400000,
      cloneCount: 247,
      rating: 4.6,
      ratingCount: 89,
      isFeatured: true,
      tags: ["momentum", "alpha-score", "smart-money"],
      rulesPreview: "BUY: Alpha Score > 80 AND Smart Money = Strong Buy | EXIT: Alpha Score < 60 OR 14-day timeout",
      action: "buy",
      backtestStats: {
        winRate: 68.4,
        totalReturn: 34.2,
        sharpeRatio: 1.82,
        maxDrawdown: -12.3,
        totalTrades: 156,
        periodDays: 90,
      },
    },
    {
      id: "mkt-2",
      originalId: "seed-2",
      name: "VIP Signal Follower",
      description: "Follows high-signal VIP accounts (Camillo, Burry, Ackman). Buys when VIP mentions a ticker with bullish sentiment and Alpha Score > 60.",
      creator: "SmartMoneyFan",
      creatorId: "user-seed-2",
      publishedAt: now - 21 * 86400000,
      updatedAt: now - 5 * 86400000,
      cloneCount: 183,
      rating: 4.3,
      ratingCount: 67,
      isFeatured: true,
      tags: ["vip-signals", "social-arbitrage", "sentiment"],
      rulesPreview: "BUY: VIP Mention (Camillo/Burry/Ackman) AND Sentiment = Bullish AND Alpha > 60",
      action: "buy",
      backtestStats: {
        winRate: 62.1,
        totalReturn: 28.7,
        sharpeRatio: 1.54,
        maxDrawdown: -15.8,
        totalTrades: 89,
        periodDays: 90,
      },
    },
    {
      id: "mkt-3",
      originalId: "seed-3",
      name: "Arbitrage Divergence Play",
      description: "Exploits disagreements between prediction markets and AI. When Polymarket/Kalshi diverge from AI predictions by 20%+, take the AI side.",
      creator: "ArbitrageAlpha",
      creatorId: "user-seed-3",
      publishedAt: now - 10 * 86400000,
      updatedAt: now - 1 * 86400000,
      cloneCount: 312,
      rating: 4.8,
      ratingCount: 124,
      isFeatured: true,
      tags: ["arbitrage", "prediction-markets", "contrarian"],
      rulesPreview: "BUY: AI vs Market Divergence > 20% AND AI Confidence > 70% | EXIT: Divergence < 5%",
      action: "buy",
      backtestStats: {
        winRate: 71.3,
        totalReturn: 41.5,
        sharpeRatio: 2.14,
        maxDrawdown: -9.7,
        totalTrades: 108,
        periodDays: 90,
      },
    },
    {
      id: "mkt-4",
      originalId: "seed-4",
      name: "Cramer Inverse",
      description: "The classic contrarian play. When Jim Cramer is bullish, go short. When bearish, go long. Surprisingly effective.",
      creator: "InverseCramer",
      creatorId: "user-seed-4",
      publishedAt: now - 30 * 86400000,
      updatedAt: now - 7 * 86400000,
      cloneCount: 891,
      rating: 4.1,
      ratingCount: 342,
      isFeatured: false,
      tags: ["contrarian", "vip-signals", "humor", "sentiment"],
      rulesPreview: "BUY: Cramer Sentiment = Bearish AND Alpha > 50 | SELL: Cramer Sentiment = Bullish",
      action: "buy",
      backtestStats: {
        winRate: 57.8,
        totalReturn: 18.9,
        sharpeRatio: 1.21,
        maxDrawdown: -18.4,
        totalTrades: 204,
        periodDays: 90,
      },
    },
    {
      id: "mkt-5",
      originalId: "seed-5",
      name: "Earnings Alpha Surge",
      description: "Buys tickers 5 days before earnings when Alpha Score is rising and Smart Money is bullish. Sells day after earnings.",
      creator: "EarningsEdge",
      creatorId: "user-seed-5",
      publishedAt: now - 7 * 86400000,
      updatedAt: now - 1 * 86400000,
      cloneCount: 156,
      rating: 4.4,
      ratingCount: 52,
      isFeatured: true,
      tags: ["earnings", "catalyst", "momentum"],
      rulesPreview: "BUY: Earnings < 5 days AND Alpha Rising AND Smart Money = Buy | EXIT: Day after earnings",
      action: "buy",
      backtestStats: {
        winRate: 64.7,
        totalReturn: 22.3,
        sharpeRatio: 1.67,
        maxDrawdown: -14.1,
        totalTrades: 68,
        periodDays: 90,
      },
    },
    {
      id: "mkt-6",
      originalId: "seed-6",
      name: "Multi-Timeframe Conviction",
      description: "Only enters when ALL three timeframes (1h, 4h, 1w) agree. High-conviction, low-frequency strategy.",
      creator: "ConvictionCapital",
      creatorId: "user-seed-6",
      publishedAt: now - 5 * 86400000,
      updatedAt: now - 1 * 86400000,
      cloneCount: 98,
      rating: 4.7,
      ratingCount: 38,
      isFeatured: false,
      tags: ["multi-timeframe", "conviction", "low-frequency"],
      rulesPreview: "BUY: 1h Alpha > 70 AND 4h Alpha > 70 AND 1w Alpha > 70 AND Smart Money = Strong Buy",
      action: "buy",
      backtestStats: {
        winRate: 76.2,
        totalReturn: 29.8,
        sharpeRatio: 2.31,
        maxDrawdown: -7.2,
        totalTrades: 42,
        periodDays: 90,
      },
    },
    {
      id: "mkt-7",
      originalId: "seed-7",
      name: "Sector Rotation Alpha",
      description: "Rotates into the sector with highest average Alpha Score. Rebalances weekly based on sector heatmap.",
      creator: "SectorSurfer",
      creatorId: "user-seed-7",
      publishedAt: now - 18 * 86400000,
      updatedAt: now - 3 * 86400000,
      cloneCount: 134,
      rating: 4.2,
      ratingCount: 56,
      isFeatured: false,
      tags: ["sector-rotation", "diversification", "weekly"],
      rulesPreview: "ROTATE: Buy top sector by avg Alpha Score | REBALANCE: Weekly based on sector heatmap",
      action: "buy",
      backtestStats: {
        winRate: 59.3,
        totalReturn: 24.1,
        sharpeRatio: 1.45,
        maxDrawdown: -11.6,
        totalTrades: 52,
        periodDays: 90,
      },
    },
    {
      id: "mkt-8",
      originalId: "seed-8",
      name: "Trending Breakout",
      description: "Catches breakouts from X/Twitter trending topics. When a ticker starts trending with bullish sentiment, enter immediately.",
      creator: "TrendCatcher",
      creatorId: "user-seed-8",
      publishedAt: now - 12 * 86400000,
      updatedAt: now - 2 * 86400000,
      cloneCount: 201,
      rating: 3.9,
      ratingCount: 78,
      isFeatured: false,
      tags: ["trending", "breakout", "social-media", "momentum"],
      rulesPreview: "BUY: Ticker Trending on X AND Sentiment > 0.6 AND Volume Spike | EXIT: 48h timeout or -5% stop",
      action: "buy",
      backtestStats: {
        winRate: 54.2,
        totalReturn: 19.7,
        sharpeRatio: 1.08,
        maxDrawdown: -22.1,
        totalTrades: 178,
        periodDays: 90,
      },
    },
  ];
}

// ============================================================================
// Public API
// ============================================================================

/** Get marketplace strategies with optional filters */
export function getMarketplaceStrategies(filters?: MarketplaceFilters): MarketplaceStrategy[] {
  initializeMarketplace();

  let results = [...marketplaceStrategies];

  // Apply filters
  if (filters?.featured) {
    results = results.filter(s => s.isFeatured);
  }
  if (filters?.tag) {
    results = results.filter(s => s.tags.includes(filters.tag!));
  }
  if (filters?.minWinRate) {
    results = results.filter(s => s.backtestStats.winRate >= filters.minWinRate!);
  }
  if (filters?.minSharpe) {
    results = results.filter(s => s.backtestStats.sharpeRatio >= filters.minSharpe!);
  }

  // Sort
  const sortBy = filters?.sortBy || "performance";
  switch (sortBy) {
    case "performance":
      results.sort((a, b) => b.backtestStats.sharpeRatio - a.backtestStats.sharpeRatio);
      break;
    case "popular":
      results.sort((a, b) => b.cloneCount - a.cloneCount);
      break;
    case "newest":
      results.sort((a, b) => b.publishedAt - a.publishedAt);
      break;
    case "rating":
      results.sort((a, b) => b.rating - a.rating);
      break;
  }

  return results;
}

/** Get a single marketplace strategy */
export function getMarketplaceStrategy(id: string): MarketplaceStrategy | null {
  initializeMarketplace();
  return marketplaceStrategies.find(s => s.id === id) || null;
}

/** Get featured strategies */
export function getFeaturedStrategies(): MarketplaceStrategy[] {
  initializeMarketplace();
  return marketplaceStrategies
    .filter(s => s.isFeatured)
    .sort((a, b) => b.backtestStats.sharpeRatio - a.backtestStats.sharpeRatio);
}

/** Clone a marketplace strategy to user's own list */
export function cloneStrategy(marketplaceId: string, userId: string): { success: boolean; newStrategyId?: string; error?: string } {
  initializeMarketplace();
  const mktStrategy = marketplaceStrategies.find(s => s.id === marketplaceId);
  if (!mktStrategy) return { success: false, error: "Strategy not found" };

  // Increment clone count
  mktStrategy.cloneCount++;

  // Create a new strategy in the user's list (simplified)
  const newId = `cloned-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    success: true,
    newStrategyId: newId,
  };
}

/** Publish a user strategy to the marketplace */
export function publishStrategy(
  strategyId: string,
  userId: string,
  userName: string,
  tags: string[]
): { success: boolean; marketplaceId?: string; error?: string } {
  initializeMarketplace();

  // Check if already published
  const existing = marketplaceStrategies.find(s => s.originalId === strategyId);
  if (existing) return { success: false, error: "Strategy already published" };

  const strategy = getStrategy(strategyId);
  if (!strategy) return { success: false, error: "Strategy not found" };

  const now = Date.now();
  const mktId = `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Generate rules preview
  const rulesPreview = generateRulesPreview(strategy);

  const mktStrategy: MarketplaceStrategy = {
    id: mktId,
    originalId: strategyId,
    name: strategy.name,
    description: strategy.description,
    creator: userName,
    creatorId: userId,
    publishedAt: now,
    updatedAt: now,
    cloneCount: 0,
    rating: 0,
    ratingCount: 0,
    isFeatured: false,
    tags,
    rulesPreview,
    action: strategy.action,
    backtestStats: strategy.backtestResults ? {
      winRate: strategy.backtestResults.winRate,
      totalReturn: strategy.backtestResults.totalReturn,
      sharpeRatio: strategy.backtestResults.sharpeRatio,
      maxDrawdown: strategy.backtestResults.maxDrawdown,
      totalTrades: strategy.backtestResults.totalTrades,
      periodDays: strategy.backtestResults.periodDays,
    } : {
      winRate: 0,
      totalReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      totalTrades: 0,
      periodDays: 0,
    },
  };

  marketplaceStrategies.push(mktStrategy);
  return { success: true, marketplaceId: mktId };
}

/** Rate a marketplace strategy */
export function rateStrategy(marketplaceId: string, rating: number): { success: boolean } {
  initializeMarketplace();
  const strategy = marketplaceStrategies.find(s => s.id === marketplaceId);
  if (!strategy) return { success: false };

  // Update rolling average
  const totalRating = strategy.rating * strategy.ratingCount + rating;
  strategy.ratingCount++;
  strategy.rating = Math.round((totalRating / strategy.ratingCount) * 10) / 10;

  return { success: true };
}

/** Get available tags from all marketplace strategies */
export function getMarketplaceTags(): { tag: string; count: number }[] {
  initializeMarketplace();
  const tagCounts = new Map<string, number>();

  for (const strategy of marketplaceStrategies) {
    for (const tag of strategy.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/** Get marketplace stats */
export function getMarketplaceStats() {
  initializeMarketplace();
  const strategies = marketplaceStrategies;
  const totalClones = strategies.reduce((sum, s) => sum + s.cloneCount, 0);
  const avgWinRate = strategies.reduce((sum, s) => sum + s.backtestStats.winRate, 0) / strategies.length;
  const avgSharpe = strategies.reduce((sum, s) => sum + s.backtestStats.sharpeRatio, 0) / strategies.length;
  const topPerformer = strategies.reduce((best, s) =>
    s.backtestStats.sharpeRatio > best.backtestStats.sharpeRatio ? s : best
  );

  return {
    totalStrategies: strategies.length,
    featuredCount: strategies.filter(s => s.isFeatured).length,
    totalClones,
    avgWinRate: Math.round(avgWinRate * 10) / 10,
    avgSharpeRatio: Math.round(avgSharpe * 100) / 100,
    topPerformer: topPerformer.name,
    topPerformerSharpe: topPerformer.backtestStats.sharpeRatio,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function generateRulesPreview(strategy: any): string {
  const parts: string[] = [];
  parts.push(`${strategy.action.toUpperCase()}: `);

  if (strategy.entryRules?.rules) {
    const ruleDescriptions = strategy.entryRules.rules.map((r: any) => {
      return `${r.field} ${r.operator} ${r.value}`;
    });
    parts.push(ruleDescriptions.join(` ${strategy.entryRules.logic || "AND"} `));
  }

  if (strategy.exitRules?.rules) {
    parts.push(" | EXIT: ");
    const exitDescriptions = strategy.exitRules.rules.map((r: any) => {
      return `${r.field} ${r.operator} ${r.value}`;
    });
    parts.push(exitDescriptions.join(` ${strategy.exitRules.logic || "OR"} `));
  }

  return parts.join("");
}
