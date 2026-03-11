/**
 * Earnings Calendar — tracks upcoming and recent earnings dates for major tickers.
 * 
 * Features:
 * - Realistic earnings date simulation for tracked tickers (quarterly cycle)
 * - "EARNINGS IN X DAYS" badge data for Alpha Leaderboard
 * - Upcoming earnings widget data (next 7 days)
 * - Earnings proximity flagging for predictions (higher-risk/higher-reward)
 * - Trade journal earnings event marking
 * - Alpha Score behavior tracking 5 days before/after earnings
 */

// ============================================================================
// Types
// ============================================================================

export interface EarningsEvent {
  ticker: string;
  companyName: string;
  earningsDate: number; // Unix timestamp
  quarter: string; // e.g., "Q1 2026"
  fiscalYear: number;
  timeOfDay: "before_market" | "after_market" | "during_market";
  estimatedEPS: number;
  actualEPS: number | null; // null if not yet reported
  estimatedRevenue: number; // in millions
  actualRevenue: number | null;
  surprise: number | null; // % surprise vs estimate
  revenueGrowthYoY: number | null;
  status: "upcoming" | "reported" | "missed";
}

export interface EarningsBadge {
  ticker: string;
  daysUntilEarnings: number;
  earningsDate: number;
  quarter: string;
  timeOfDay: string;
  riskLevel: "extreme" | "high" | "moderate" | "low";
  label: string; // e.g., "EARNINGS IN 3 DAYS"
}

export interface EarningsAlphaPattern {
  ticker: string;
  quarter: string;
  preEarningsAlpha: number[]; // 5 days before
  postEarningsAlpha: number[]; // 5 days after
  avgPreEarningsChange: number;
  avgPostEarningsChange: number;
  preEarningsDrift: "up" | "down" | "flat";
  postEarningsReaction: "positive" | "negative" | "mixed";
  surprise: number | null;
}

export interface UpcomingEarningsItem {
  ticker: string;
  companyName: string;
  earningsDate: number;
  daysUntil: number;
  quarter: string;
  timeOfDay: string;
  estimatedEPS: number;
  estimatedRevenue: number;
  alphaScore: number | null;
  smartMoney: string | null;
  historicalSurprise: number; // average historical surprise %
}

// ============================================================================
// Company Data
// ============================================================================

const COMPANY_DATA: Record<string, { name: string; sector: string; avgEPS: number; avgRevenue: number }> = {
  AAPL: { name: "Apple Inc.", sector: "Technology", avgEPS: 1.58, avgRevenue: 94500 },
  MSFT: { name: "Microsoft Corp.", sector: "Technology", avgEPS: 2.94, avgRevenue: 62000 },
  NVDA: { name: "NVIDIA Corp.", sector: "Technology", avgEPS: 0.82, avgRevenue: 35100 },
  GOOGL: { name: "Alphabet Inc.", sector: "Technology", avgEPS: 1.89, avgRevenue: 86300 },
  AMZN: { name: "Amazon.com Inc.", sector: "Consumer", avgEPS: 1.43, avgRevenue: 158900 },
  META: { name: "Meta Platforms", sector: "Technology", avgEPS: 5.33, avgRevenue: 40100 },
  TSLA: { name: "Tesla Inc.", sector: "Consumer", avgEPS: 0.72, avgRevenue: 25200 },
  JPM: { name: "JPMorgan Chase", sector: "Finance", avgEPS: 4.44, avgRevenue: 42800 },
  V: { name: "Visa Inc.", sector: "Finance", avgEPS: 2.58, avgRevenue: 9200 },
  JNJ: { name: "Johnson & Johnson", sector: "Healthcare", avgEPS: 2.71, avgRevenue: 22300 },
  UNH: { name: "UnitedHealth Group", sector: "Healthcare", avgEPS: 6.91, avgRevenue: 100500 },
  XOM: { name: "Exxon Mobil", sector: "Energy", avgEPS: 2.38, avgRevenue: 90100 },
  WMT: { name: "Walmart Inc.", sector: "Consumer", avgEPS: 0.58, avgRevenue: 164000 },
  PG: { name: "Procter & Gamble", sector: "Consumer", avgEPS: 1.52, avgRevenue: 21400 },
  DIS: { name: "Walt Disney Co.", sector: "Consumer", avgEPS: 1.22, avgRevenue: 23200 },
  NFLX: { name: "Netflix Inc.", sector: "Technology", avgEPS: 5.12, avgRevenue: 10200 },
  AMD: { name: "AMD Inc.", sector: "Technology", avgEPS: 0.95, avgRevenue: 6800 },
  CRM: { name: "Salesforce Inc.", sector: "Technology", avgEPS: 2.56, avgRevenue: 9400 },
  BA: { name: "Boeing Co.", sector: "Industrials", avgEPS: -0.45, avgRevenue: 18600 },
  GS: { name: "Goldman Sachs", sector: "Finance", avgEPS: 8.22, avgRevenue: 12800 },
  COIN: { name: "Coinbase Global", sector: "Finance", avgEPS: 1.04, avgRevenue: 1400 },
  PLTR: { name: "Palantir Technologies", sector: "Technology", avgEPS: 0.09, avgRevenue: 680 },
  SOFI: { name: "SoFi Technologies", sector: "Finance", avgEPS: 0.02, avgRevenue: 580 },
  RIVN: { name: "Rivian Automotive", sector: "Consumer", avgEPS: -1.08, avgRevenue: 1300 },
  GME: { name: "GameStop Corp.", sector: "Consumer", avgEPS: -0.22, avgRevenue: 1200 },
};

// ============================================================================
// Earnings Date Generation (realistic quarterly cycle)
// ============================================================================

function generateEarningsSchedule(ticker: string): EarningsEvent[] {
  const company = COMPANY_DATA[ticker];
  if (!company) return [];

  const events: EarningsEvent[] = [];
  const now = Date.now();
  const seed = ticker.charCodeAt(0) + ticker.charCodeAt(ticker.length - 1);

  // Generate 8 quarters of earnings (2 years: 4 past + 4 future)
  for (let q = -4; q < 4; q++) {
    const quarterIndex = ((Math.floor((now / 86400000) / 90) + q) % 4 + 4) % 4;
    const quarterNames = ["Q1", "Q2", "Q3", "Q4"];
    const year = 2026 + Math.floor((q + 1) / 4);
    const quarter = `${quarterNames[quarterIndex]} ${year}`;

    // Stagger earnings dates by ticker (different companies report at different times)
    const baseOffset = q * 90; // ~90 days per quarter
    const tickerOffset = (seed % 20) - 10; // -10 to +10 days stagger
    const dayOffset = baseOffset + tickerOffset + 15; // Mid-quarter reporting

    const earningsDate = now + dayOffset * 86400000;
    const isPast = earningsDate < now;

    // Time of day varies by company
    const timeOptions: Array<"before_market" | "after_market" | "during_market"> = ["before_market", "after_market", "during_market"];
    const timeOfDay = timeOptions[(seed + q) % 3];

    // EPS with some variance
    const epsVariance = 1 + (Math.sin(seed * q * 0.7) * 0.15);
    const estimatedEPS = Math.round(company.avgEPS * epsVariance * 100) / 100;
    const actualEPS = isPast ? Math.round(estimatedEPS * (1 + (Math.sin(seed * q * 1.3) * 0.12)) * 100) / 100 : null;

    // Revenue with some variance
    const revVariance = 1 + (Math.cos(seed * q * 0.5) * 0.08);
    const estimatedRevenue = Math.round(company.avgRevenue * revVariance);
    const actualRevenue = isPast ? Math.round(estimatedRevenue * (1 + (Math.cos(seed * q * 0.9) * 0.06))) : null;

    const surprise = (actualEPS !== null && estimatedEPS !== 0)
      ? Math.round(((actualEPS - estimatedEPS) / Math.abs(estimatedEPS)) * 10000) / 100
      : null;

    const revenueGrowthYoY = isPast
      ? Math.round((Math.sin(seed + q) * 15 + 5) * 100) / 100
      : null;

    events.push({
      ticker,
      companyName: company.name,
      earningsDate,
      quarter,
      fiscalYear: year,
      timeOfDay,
      estimatedEPS,
      actualEPS,
      estimatedRevenue,
      actualRevenue,
      surprise,
      revenueGrowthYoY,
      status: isPast ? "reported" : "upcoming",
    });
  }

  return events;
}

// ============================================================================
// Cache
// ============================================================================

let earningsCache: Map<string, EarningsEvent[]> = new Map();
let lastCacheRefresh = 0;

function refreshCache() {
  const now = Date.now();
  if (now - lastCacheRefresh < 300000) return; // Refresh every 5 minutes
  
  earningsCache.clear();
  for (const ticker of Object.keys(COMPANY_DATA)) {
    earningsCache.set(ticker, generateEarningsSchedule(ticker));
  }
  lastCacheRefresh = now;
}

function getAllEvents(): EarningsEvent[] {
  refreshCache();
  const all: EarningsEvent[] = [];
  earningsCache.forEach((events) => all.push(...events));
  return all;
}

// ============================================================================
// Public API
// ============================================================================

/** Get upcoming earnings for the next N days */
export function getUpcomingEarnings(days: number = 7): UpcomingEarningsItem[] {
  const now = Date.now();
  const cutoff = now + days * 86400000;
  const events = getAllEvents()
    .filter(e => e.earningsDate > now && e.earningsDate <= cutoff)
    .sort((a, b) => a.earningsDate - b.earningsDate);

  return events.map(e => ({
    ticker: e.ticker,
    companyName: e.companyName,
    earningsDate: e.earningsDate,
    daysUntil: Math.ceil((e.earningsDate - now) / 86400000),
    quarter: e.quarter,
    timeOfDay: e.timeOfDay,
    estimatedEPS: e.estimatedEPS,
    estimatedRevenue: e.estimatedRevenue,
    alphaScore: null, // Filled by caller if needed
    smartMoney: null,
    historicalSurprise: getHistoricalAvgSurprise(e.ticker),
  }));
}

/** Get earnings badges for the Alpha Leaderboard */
export function getEarningsBadges(): EarningsBadge[] {
  const now = Date.now();
  const badges: EarningsBadge[] = [];

  for (const ticker of Object.keys(COMPANY_DATA)) {
    const events = earningsCache.get(ticker) || generateEarningsSchedule(ticker);
    const nextEarnings = events
      .filter(e => e.earningsDate > now)
      .sort((a, b) => a.earningsDate - b.earningsDate)[0];

    if (!nextEarnings) continue;

    const daysUntil = Math.ceil((nextEarnings.earningsDate - now) / 86400000);
    if (daysUntil > 14) continue; // Only show badges for earnings within 14 days

    let riskLevel: "extreme" | "high" | "moderate" | "low";
    let label: string;

    if (daysUntil <= 1) {
      riskLevel = "extreme";
      label = "EARNINGS TODAY";
    } else if (daysUntil <= 3) {
      riskLevel = "extreme";
      label = `EARNINGS IN ${daysUntil} DAYS`;
    } else if (daysUntil <= 7) {
      riskLevel = "high";
      label = `EARNINGS IN ${daysUntil} DAYS`;
    } else {
      riskLevel = "moderate";
      label = `EARNINGS IN ${daysUntil} DAYS`;
    }

    badges.push({
      ticker,
      daysUntilEarnings: daysUntil,
      earningsDate: nextEarnings.earningsDate,
      quarter: nextEarnings.quarter,
      timeOfDay: nextEarnings.timeOfDay,
      riskLevel,
      label,
    });
  }

  return badges.sort((a, b) => a.daysUntilEarnings - b.daysUntilEarnings);
}

/** Check if a prediction is near an earnings date */
export function isNearEarnings(ticker: string, predictionDate: number, windowDays: number = 5): {
  isNear: boolean;
  earningsEvent: EarningsEvent | null;
  daysToEarnings: number | null;
  riskMultiplier: number;
} {
  refreshCache();
  const events = earningsCache.get(ticker) || [];
  
  for (const event of events) {
    const daysDiff = Math.abs(event.earningsDate - predictionDate) / 86400000;
    if (daysDiff <= windowDays) {
      return {
        isNear: true,
        earningsEvent: event,
        daysToEarnings: Math.round((event.earningsDate - predictionDate) / 86400000),
        riskMultiplier: daysDiff <= 1 ? 2.5 : daysDiff <= 3 ? 2.0 : 1.5,
      };
    }
  }

  return { isNear: false, earningsEvent: null, daysToEarnings: null, riskMultiplier: 1.0 };
}

/** Get Alpha Score behavior around earnings (5 days before/after) */
export function getEarningsAlphaPatterns(ticker: string): EarningsAlphaPattern[] {
  refreshCache();
  const events = earningsCache.get(ticker) || [];
  const pastEvents = events.filter(e => e.status === "reported");
  const seed = ticker.charCodeAt(0) + ticker.charCodeAt(ticker.length - 1);

  return pastEvents.map((event, idx) => {
    // Simulate alpha score patterns around earnings
    const preAlpha: number[] = [];
    const postAlpha: number[] = [];

    for (let d = 5; d >= 1; d--) {
      // Pre-earnings: alpha tends to rise (anticipation)
      const base = 50 + Math.sin(seed + idx + d) * 20;
      const drift = (5 - d) * 3; // Increasing as earnings approach
      preAlpha.push(Math.round(Math.min(100, Math.max(0, base + drift))));
    }

    for (let d = 1; d <= 5; d++) {
      // Post-earnings: depends on surprise
      const base = 50 + Math.sin(seed + idx - d) * 25;
      const surpriseEffect = (event.surprise || 0) * 2;
      const decay = d * 2;
      postAlpha.push(Math.round(Math.min(100, Math.max(0, base + surpriseEffect - decay))));
    }

    const avgPre = preAlpha.reduce((a, b) => a + b, 0) / preAlpha.length;
    const avgPost = postAlpha.reduce((a, b) => a + b, 0) / postAlpha.length;
    const preChange = preAlpha[preAlpha.length - 1] - preAlpha[0];
    const postChange = postAlpha[postAlpha.length - 1] - postAlpha[0];

    return {
      ticker,
      quarter: event.quarter,
      preEarningsAlpha: preAlpha,
      postEarningsAlpha: postAlpha,
      avgPreEarningsChange: Math.round(preChange * 100) / 100,
      avgPostEarningsChange: Math.round(postChange * 100) / 100,
      preEarningsDrift: preChange > 3 ? "up" as const : preChange < -3 ? "down" as const : "flat" as const,
      postEarningsReaction: (event.surprise || 0) > 2 ? "positive" as const : (event.surprise || 0) < -2 ? "negative" as const : "mixed" as const,
      surprise: event.surprise,
    };
  });
}

/** Get recent earnings results */
export function getRecentEarnings(limit: number = 10): EarningsEvent[] {
  const now = Date.now();
  return getAllEvents()
    .filter(e => e.status === "reported" && e.earningsDate < now)
    .sort((a, b) => b.earningsDate - a.earningsDate)
    .slice(0, limit);
}

/** Get all earnings for a specific ticker */
export function getEarningsForTicker(ticker: string): EarningsEvent[] {
  refreshCache();
  return earningsCache.get(ticker) || [];
}

/** Get historical average surprise % for a ticker */
function getHistoricalAvgSurprise(ticker: string): number {
  refreshCache();
  const events = earningsCache.get(ticker) || [];
  const reported = events.filter(e => e.surprise !== null);
  if (reported.length === 0) return 0;
  return Math.round((reported.reduce((sum, e) => sum + (e.surprise || 0), 0) / reported.length) * 100) / 100;
}

/** Check if a trade was around an earnings event */
export function wasTradeAroundEarnings(ticker: string, tradeDate: number, windowDays: number = 5): {
  aroundEarnings: boolean;
  earningsEvent: EarningsEvent | null;
  daysDiff: number | null;
  position: "before" | "after" | null;
} {
  refreshCache();
  const events = earningsCache.get(ticker) || [];

  for (const event of events) {
    const daysDiff = (tradeDate - event.earningsDate) / 86400000;
    if (Math.abs(daysDiff) <= windowDays) {
      return {
        aroundEarnings: true,
        earningsEvent: event,
        daysDiff: Math.round(daysDiff),
        position: daysDiff < 0 ? "before" : "after",
      };
    }
  }

  return { aroundEarnings: false, earningsEvent: null, daysDiff: null, position: null };
}

/** Get earnings calendar status for agent dashboard */
export function getEarningsCalendarStatus() {
  refreshCache();
  const now = Date.now();
  const allEvents = getAllEvents();
  const upcoming = allEvents.filter(e => e.earningsDate > now && e.earningsDate <= now + 30 * 86400000);
  const badges = getEarningsBadges();

  return {
    name: "Earnings Calendar",
    description: "Tracks upcoming and recent earnings dates with Alpha Score pattern analysis",
    status: "ready" as const,
    tickersTracked: Object.keys(COMPANY_DATA).length,
    upcomingNext7Days: upcoming.filter(e => e.earningsDate <= now + 7 * 86400000).length,
    upcomingNext30Days: upcoming.length,
    activeBadges: badges.length,
    totalHistoricalEvents: allEvents.filter(e => e.status === "reported").length,
    lastRefresh: lastCacheRefresh,
  };
}
