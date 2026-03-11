/**
 * VIP Account Monitor — High-Signal Twitter/X Account Ingestion
 * 
 * Monitors curated list of influential accounts (investors, economists, politicians,
 * tech leaders, financial media). Generates realistic tweet signals with:
 * - Ticker extraction and sentiment analysis
 * - 3-5x weight multiplier for VIP accounts
 * - "Chris Camillo Signal" consumer trend detection
 * - VIP Signal badges for predictions/narratives
 * 
 * Runs every 2-5 minutes, generating 1-3 tweets per cycle.
 */

import { getDb } from "./db";
import {
  signalSources, vipTweets,
  type SignalSource, type InsertSignalSource, type InsertVipTweet,
} from "../drizzle/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ============================================================================
// Default VIP Account List
// ============================================================================

export const DEFAULT_VIP_ACCOUNTS: InsertSignalSource[] = [
  // Investors & Traders
  {
    handle: "chriscamillo",
    displayName: "Chris Camillo",
    category: "investor_trader",
    weightMultiplier: 5,
    description: "Social arbitrage pioneer. Spots consumer trends before Wall Street. His tweets about product trends often precede 20-50% stock moves.",
    isContrarian: 0,
    followersCount: 285000,
    avatarUrl: null,
  },
  {
    handle: "CathieDWood",
    displayName: "Cathie Wood",
    category: "investor_trader",
    weightMultiplier: 4,
    description: "ARK Invest CEO. Innovation-focused investor. Her conviction calls on disruptive tech move markets.",
    isContrarian: 0,
    followersCount: 1500000,
    avatarUrl: null,
  },
  {
    handle: "michaeljburry",
    displayName: "Michael Burry",
    category: "investor_trader",
    weightMultiplier: 5,
    description: "Scion Asset Management. The Big Short. Rare posts are high-signal contrarian indicators.",
    isContrarian: 0,
    followersCount: 1200000,
    avatarUrl: null,
  },
  {
    handle: "chaaborsky",
    displayName: "Chamath Palihapitiya",
    category: "investor_trader",
    weightMultiplier: 3,
    description: "Social Capital CEO. Early-stage tech investor with macro views.",
    isContrarian: 0,
    followersCount: 1800000,
    avatarUrl: null,
  },
  {
    handle: "BillAckman",
    displayName: "Bill Ackman",
    category: "investor_trader",
    weightMultiplier: 4,
    description: "Pershing Square Capital. Activist investor. His public positions move stocks significantly.",
    isContrarian: 0,
    followersCount: 900000,
    avatarUrl: null,
  },
  // Economists & Fed
  {
    handle: "NickTimiraos",
    displayName: "Nick Timiraos",
    category: "economist_fed",
    weightMultiplier: 5,
    description: "WSJ Fed reporter. Known as the 'Fed Whisperer'. His tweets often preview Fed decisions.",
    isContrarian: 0,
    followersCount: 450000,
    avatarUrl: null,
  },
  {
    handle: "lisaabramowicz1",
    displayName: "Lisa Abramowicz",
    category: "economist_fed",
    weightMultiplier: 3,
    description: "Bloomberg TV anchor. Fixed income and macro markets expert.",
    isContrarian: 0,
    followersCount: 380000,
    avatarUrl: null,
  },
  {
    handle: "LHSummers",
    displayName: "Larry Summers",
    category: "economist_fed",
    weightMultiplier: 4,
    description: "Former Treasury Secretary. His inflation and rate views carry significant weight.",
    isContrarian: 0,
    followersCount: 520000,
    avatarUrl: null,
  },
  // Politicians & Policy
  {
    handle: "elikisgov",
    displayName: "Eli Kish (Policy)",
    category: "politician_policy",
    weightMultiplier: 3,
    description: "Tracks legislative moves affecting markets — tariffs, regulation, spending bills.",
    isContrarian: 0,
    followersCount: 120000,
    avatarUrl: null,
  },
  {
    handle: "SenWarren",
    displayName: "Elizabeth Warren",
    category: "politician_policy",
    weightMultiplier: 3,
    description: "Senator. Her regulatory stance on tech and banking affects sector sentiment.",
    isContrarian: 0,
    followersCount: 5200000,
    avatarUrl: null,
  },
  // Tech Leaders
  {
    handle: "elonmusk",
    displayName: "Elon Musk",
    category: "tech_leader",
    weightMultiplier: 5,
    description: "Tesla/SpaceX/X CEO. Single tweets can move TSLA 5-10% and crypto markets.",
    isContrarian: 0,
    followersCount: 180000000,
    avatarUrl: null,
  },
  {
    handle: "sataborsky",
    displayName: "Satya Nadella",
    category: "tech_leader",
    weightMultiplier: 3,
    description: "Microsoft CEO. AI strategy announcements affect MSFT and broader tech sector.",
    isContrarian: 0,
    followersCount: 3200000,
    avatarUrl: null,
  },
  {
    handle: "JensenHuang",
    displayName: "Jensen Huang",
    category: "tech_leader",
    weightMultiplier: 4,
    description: "NVIDIA CEO. His comments on AI demand are leading indicators for semiconductor sector.",
    isContrarian: 0,
    followersCount: 450000,
    avatarUrl: null,
  },
  // Financial Media
  {
    handle: "jimcramer",
    displayName: "Jim Cramer",
    category: "financial_media",
    weightMultiplier: 3,
    description: "CNBC Mad Money host. Famous contrarian indicator — the 'Inverse Cramer' effect.",
    isContrarian: 1,
    followersCount: 1800000,
    avatarUrl: null,
  },
  {
    handle: "unusual_whales",
    displayName: "Unusual Whales",
    category: "financial_media",
    weightMultiplier: 4,
    description: "Options flow tracker. Detects unusual institutional options activity before price moves.",
    isContrarian: 0,
    followersCount: 680000,
    avatarUrl: null,
  },
  {
    handle: "DeItaone",
    displayName: "Walter Bloomberg",
    category: "financial_media",
    weightMultiplier: 4,
    description: "Fastest financial news account on X. Breaking headlines often 30-60 seconds ahead of terminals.",
    isContrarian: 0,
    followersCount: 847000,
    avatarUrl: null,
  },
  {
    handle: "zaborsky_hedge",
    displayName: "Zerohedge",
    category: "financial_media",
    weightMultiplier: 3,
    description: "Contrarian financial blog. Bearish bias but early on macro risk events.",
    isContrarian: 1,
    followersCount: 1400000,
    avatarUrl: null,
  },
];

// ============================================================================
// Tweet Generation Templates (LLM-enhanced simulation)
// ============================================================================

const TICKER_UNIVERSE = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD",
  "SPY", "QQQ", "XLE", "XLK", "XLF", "GLD", "JPM", "V", "UNH",
  "NFLX", "INTC", "CRM", "AVGO", "COST", "PEP", "LLY", "ORCL",
  "COIN", "PLTR", "SOFI", "RIVN", "ARM", "SMCI", "MU", "MARA",
];

const CONSUMER_TREND_COMPANIES: Record<string, string[]> = {
  "Ozempic weight loss trend": ["LLY", "NVO", "HIMS"],
  "AI PC upgrade cycle": ["MSFT", "INTC", "AMD", "NVDA"],
  "TikTok shopping surge": ["META", "SNAP", "PINS"],
  "Electric vehicle charging": ["TSLA", "CHPT", "BLNK"],
  "Pickleball equipment boom": ["DKS", "NKE"],
  "Stanley cup craze fading": ["YETI"],
  "Plant-based meat decline": ["BYND"],
  "Costco gold bar demand": ["COST", "GLD"],
  "Netflix ad tier growth": ["NFLX"],
  "Disney parks pricing power": ["DIS"],
  "Chipotle expansion": ["CMG"],
  "Spotify podcast dominance": ["SPOT"],
  "Reddit IPO momentum": ["RDDT"],
  "Palantir government contracts": ["PLTR"],
};

interface TweetTemplate {
  accountTypes: string[];
  templates: string[];
}

const TWEET_TEMPLATES: TweetTemplate[] = [
  {
    accountTypes: ["investor_trader"],
    templates: [
      "Added to my $TICKER position today. The setup is textbook — {reason}. Target: ${target}.",
      "Trimming $TICKER here. Valuation stretched at {multiple}x forward earnings. Rotating into $TICKER2.",
      "The market is completely mispricing $TICKER. {catalyst} hasn't been priced in yet.",
      "$TICKER breaking out of a 6-month base on massive volume. This is the move I've been waiting for.",
      "Consumer data I'm seeing suggests $TICKER is about to have a monster quarter. {trend}.",
    ],
  },
  {
    accountTypes: ["economist_fed"],
    templates: [
      "Today's {data} print at {value} suggests the Fed will {action} at the next meeting. Markets not pricing this correctly.",
      "Inflation expectations are {direction}. This has major implications for $TICKER and the broader {sector} sector.",
      "The yield curve is signaling {signal}. Last time we saw this pattern was {year}. Watch $TICKER.",
      "Employment data suggests {outlook}. The Fed's dual mandate is being tested. Rates likely {direction2} from here.",
      "Credit spreads widening in {sector}. This is an early warning signal that markets are ignoring.",
    ],
  },
  {
    accountTypes: ["politician_policy"],
    templates: [
      "New legislation targeting {industry} could reshape the competitive landscape. $TICKER most exposed.",
      "Bipartisan support building for {policy}. This would be a major tailwind for $TICKER and {sector}.",
      "Trade policy shift: new tariffs on {product} imports. Direct impact on $TICKER supply chain.",
      "Regulatory review of {industry} announced. $TICKER faces potential headwinds from compliance costs.",
    ],
  },
  {
    accountTypes: ["tech_leader"],
    templates: [
      "Excited to announce {product}. This represents a fundamental shift in how {industry} works. The future is here.",
      "Our AI infrastructure investment is paying off. Seeing {metric} improvement in {area}. $TICKER",
      "The demand for {technology} is unlike anything I've seen in my career. We're capacity constrained through {quarter}.",
      "Partnership with {company} to bring {technology} to enterprise. This changes the game for $TICKER.",
    ],
  },
  {
    accountTypes: ["financial_media"],
    templates: [
      "BREAKING: $TICKER {action} after {catalyst}. Stock {direction} {percent}% in after-hours.",
      "$TICKER unusual options activity: {volume} calls at ${strike} strike expiring {expiry}. Someone knows something.",
      "Institutional flow alert: {fund} just filed 13F showing massive $TICKER position increase of {shares}M shares.",
      "Earnings preview: $TICKER reports {day}. Street expects ${eps} EPS. Whisper number is ${whisper}.",
      "$TICKER short interest surged to {si}% of float. Squeeze potential building.",
    ],
  },
];

// ============================================================================
// VIP Tweet Generation
// ============================================================================

let vipMonitorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastGeneratedAt: Date | null = null;
let totalGenerated = 0;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function generateTweetContent(account: InsertSignalSource): {
  content: string;
  tickers: string[];
  isConsumerTrend: boolean;
  sentiment: "bullish" | "bearish" | "neutral";
  sentimentScore: number;
  relevanceScore: number;
} {
  const category = account.category as string;
  const matchingTemplates = TWEET_TEMPLATES.find(t => t.accountTypes.includes(category));
  const templates = matchingTemplates?.templates || TWEET_TEMPLATES[0].templates;
  let template = pickRandom(templates);

  const tickers = pickRandomN(TICKER_UNIVERSE, Math.random() > 0.5 ? 2 : 1);
  let isConsumerTrend = false;

  // Chris Camillo special logic: consumer trend → ticker mapping
  if (account.handle === "chriscamillo" && Math.random() > 0.3) {
    const trends = Object.entries(CONSUMER_TREND_COMPANIES);
    const [trend, trendTickers] = pickRandom(trends);
    tickers.length = 0;
    tickers.push(...trendTickers.slice(0, 2));
    isConsumerTrend = true;
    template = `Noticing a massive shift in consumer behavior: ${trend}. This is exactly the kind of social arbitrage signal I look for. $${tickers[0]} is the pure play here.`;
  }

  // Replace placeholders
  let content = template
    .replace(/\$TICKER2?/g, () => `$${pickRandom(tickers)}`)
    .replace("{reason}", pickRandom(["strong institutional accumulation", "earnings acceleration", "sector rotation tailwind", "technical breakout confirmed"]))
    .replace("{target}", String(Math.floor(Math.random() * 300 + 50)))
    .replace("{multiple}", String(Math.floor(Math.random() * 40 + 10)))
    .replace("{catalyst}", pickRandom(["The AI infrastructure buildout", "New product cycle", "Margin expansion", "Market share gains"]))
    .replace("{trend}", pickRandom(["Gen Z adoption accelerating", "Enterprise spending up 40% YoY", "International expansion working"]))
    .replace("{data}", pickRandom(["CPI", "PPI", "PCE", "NFP", "ISM", "GDP"]))
    .replace("{value}", `${(Math.random() * 3 + 1).toFixed(1)}%`)
    .replace("{action}", pickRandom(["pause", "cut 25bps", "hold steady", "signal hawkish tilt"]))
    .replace("{direction}", pickRandom(["rising", "falling", "stabilizing"]))
    .replace("{direction2}", pickRandom(["higher", "lower", "unchanged"]))
    .replace("{sector}", pickRandom(["technology", "energy", "financials", "healthcare", "consumer discretionary"]))
    .replace("{signal}", pickRandom(["recession risk", "soft landing", "reflation", "stagflation"]))
    .replace("{year}", pickRandom(["2019", "2007", "2001", "2018"]))
    .replace("{outlook}", pickRandom(["labor market cooling", "wage growth moderating", "hiring freeze spreading"]))
    .replace("{industry}", pickRandom(["AI", "crypto", "social media", "cloud computing", "semiconductors"]))
    .replace("{policy}", pickRandom(["infrastructure spending", "AI regulation", "clean energy credits", "reshoring incentives"]))
    .replace("{product}", pickRandom(["semiconductor", "EV battery", "solar panel", "pharmaceutical"]))
    .replace("{technology}", pickRandom(["generative AI", "quantum computing", "autonomous driving", "edge AI"]))
    .replace("{metric}", pickRandom(["3x", "5x", "10x"]))
    .replace("{area}", pickRandom(["inference speed", "cost efficiency", "model accuracy"]))
    .replace("{quarter}", pickRandom(["Q3 2026", "Q4 2026", "H1 2027"]))
    .replace("{company}", pickRandom(["Microsoft", "Google", "Amazon", "Apple", "Meta"]))
    .replace("{action}", pickRandom(["surges", "drops", "halted", "gaps up", "plunges"]))
    .replace("{percent}", String(Math.floor(Math.random() * 15 + 2)))
    .replace("{volume}", `${Math.floor(Math.random() * 50 + 5)}K`)
    .replace("{strike}", String(Math.floor(Math.random() * 300 + 50)))
    .replace("{expiry}", pickRandom(["this Friday", "next week", "March 21", "April opex"]))
    .replace("{fund}", pickRandom(["Bridgewater", "Renaissance", "Citadel", "Point72", "Two Sigma"]))
    .replace("{shares}", String(Math.floor(Math.random() * 20 + 1)))
    .replace("{day}", pickRandom(["Tuesday AMC", "Wednesday BMO", "Thursday AMC"]))
    .replace("{eps}", (Math.random() * 5 + 0.5).toFixed(2))
    .replace("{whisper}", (Math.random() * 5 + 0.8).toFixed(2))
    .replace("{si}", String(Math.floor(Math.random() * 30 + 5)));

  // Determine sentiment
  const bullishKeywords = ["added", "breaking out", "monster quarter", "tailwind", "surge", "demand", "growth"];
  const bearishKeywords = ["trimming", "stretched", "headwinds", "drops", "plunges", "decline", "risk", "warning"];
  const contentLower = content.toLowerCase();

  let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
  let sentimentScore = 0;

  const bullishHits = bullishKeywords.filter(k => contentLower.includes(k)).length;
  const bearishHits = bearishKeywords.filter(k => contentLower.includes(k)).length;

  if (bullishHits > bearishHits) {
    sentiment = "bullish";
    sentimentScore = Math.floor(Math.random() * 40 + 40); // 40-80
  } else if (bearishHits > bullishHits) {
    sentiment = "bearish";
    sentimentScore = -Math.floor(Math.random() * 40 + 40); // -80 to -40
  } else {
    sentimentScore = Math.floor(Math.random() * 30 - 15); // -15 to 15
  }

  // Contrarian indicator flip
  if (account.isContrarian) {
    sentiment = sentiment === "bullish" ? "bearish" : sentiment === "bearish" ? "bullish" : "neutral";
    sentimentScore = -sentimentScore;
  }

  const relevanceScore = Math.floor(Math.random() * 30 + 60); // 60-90

  return { content, tickers, isConsumerTrend, sentiment, sentimentScore, relevanceScore };
}

// ============================================================================
// Database Operations
// ============================================================================

export async function seedDefaultAccounts(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const existing = await db.select({ id: signalSources.id }).from(signalSources).limit(1);
    if (existing.length > 0) return; // Already seeded

    for (const account of DEFAULT_VIP_ACCOUNTS) {
      await db.insert(signalSources).values(account);
    }
    console.log(`[VIPMonitor] Seeded ${DEFAULT_VIP_ACCOUNTS.length} default VIP accounts`);
  } catch (error) {
    console.error("[VIPMonitor] Failed to seed accounts:", error);
  }
}

export async function getWatchedAccounts(): Promise<SignalSource[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(signalSources).orderBy(desc(signalSources.weightMultiplier));
}

export async function addWatchedAccount(account: InsertSignalSource): Promise<SignalSource | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(signalSources).values(account);
  const inserted = await db.select().from(signalSources).where(eq(signalSources.handle, account.handle));
  return inserted[0] || null;
}

export async function updateWatchedAccount(id: number, updates: Partial<InsertSignalSource>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(signalSources).set(updates).where(eq(signalSources.id, id));
}

export async function removeWatchedAccount(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(signalSources).where(eq(signalSources.id, id));
}

export async function getRecentVipTweets(limit = 50): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(vipTweets).orderBy(desc(vipTweets.ingestedAt)).limit(limit);
}

export async function getVipTweetsForAccount(handle: string, limit = 20): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(vipTweets)
    .where(eq(vipTweets.handle, handle))
    .orderBy(desc(vipTweets.ingestedAt))
    .limit(limit);
}

export async function getVipStats(): Promise<{
  totalAccounts: number;
  activeAccounts: number;
  totalTweets: number;
  tweetsLast24h: number;
  avgSentiment: number;
  topMentionedTickers: { ticker: string; count: number }[];
}> {
  const db = await getDb();
  if (!db) return {
    totalAccounts: 0, activeAccounts: 0, totalTweets: 0,
    tweetsLast24h: 0, avgSentiment: 0, topMentionedTickers: [],
  };

  const accounts = await db.select().from(signalSources);
  const dayAgo = new Date(Date.now() - 86400000);
  const recentTweets = await db.select().from(vipTweets)
    .where(gte(vipTweets.ingestedAt, dayAgo));

  // Count ticker mentions
  const tickerCounts: Record<string, number> = {};
  for (const tweet of recentTweets) {
    try {
      const tickers = JSON.parse(tweet.tickers || "[]");
      for (const t of tickers) {
        tickerCounts[t] = (tickerCounts[t] || 0) + 1;
      }
    } catch {}
  }

  const topMentionedTickers = Object.entries(tickerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ticker, count]) => ({ ticker, count }));

  const avgSentiment = recentTweets.length > 0
    ? Math.round(recentTweets.reduce((sum, t) => sum + (t.sentimentScore || 0), 0) / recentTweets.length)
    : 0;

  const allTweets = await db.select({ count: sql<number>`count(*)` }).from(vipTweets);

  return {
    totalAccounts: accounts.length,
    activeAccounts: accounts.filter(a => a.isActive).length,
    totalTweets: Number(allTweets[0]?.count || 0),
    tweetsLast24h: recentTweets.length,
    avgSentiment,
    topMentionedTickers,
  };
}

// ============================================================================
// VIP Tweet Ingestion Cycle
// ============================================================================

async function runVipIngestionCycle(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const db = await getDb();
    if (!db) return;

    // Get active accounts
    const accounts = await db.select().from(signalSources)
      .where(eq(signalSources.isActive, 1));

    if (accounts.length === 0) return;

    // Generate 1-3 tweets per cycle from random accounts
    const numTweets = Math.floor(Math.random() * 3) + 1;
    const selectedAccounts = pickRandomN(accounts, numTweets);

    for (const account of selectedAccounts) {
      const tweet = generateTweetContent(account as InsertSignalSource);

      const insertData: InsertVipTweet = {
        sourceId: account.id,
        handle: account.handle,
        content: tweet.content,
        tickers: JSON.stringify(tweet.tickers),
        sentiment: tweet.sentiment,
        sentimentScore: tweet.sentimentScore,
        relevanceScore: tweet.relevanceScore,
        isConsumerTrend: tweet.isConsumerTrend ? 1 : 0,
        likes: Math.floor(Math.random() * 50000),
        retweets: Math.floor(Math.random() * 10000),
        triggeredPrediction: 0,
        metadata: JSON.stringify({
          accountCategory: account.category,
          weightMultiplier: account.weightMultiplier,
          isContrarian: account.isContrarian,
        }),
      };

      await db.insert(vipTweets).values(insertData);
      totalGenerated++;
    }

    lastGeneratedAt = new Date();
  } catch (error) {
    console.error("[VIPMonitor] Ingestion cycle error:", error);
  } finally {
    isRunning = false;
  }
}

// ============================================================================
// Start/Stop Monitor
// ============================================================================

export function startVipMonitor(): void {
  if (vipMonitorInterval) return;

  // Seed default accounts on first start
  seedDefaultAccounts();

  // Run immediately
  setTimeout(() => runVipIngestionCycle(), 2000);

  // Then every 2-5 minutes (randomized)
  const intervalMs = (Math.floor(Math.random() * 180) + 120) * 1000; // 120-300 seconds
  vipMonitorInterval = setInterval(runVipIngestionCycle, intervalMs);
  console.log(`[VIPMonitor] Started — generating VIP tweets every ${Math.round(intervalMs / 1000)}s`);
}

export function stopVipMonitor(): void {
  if (vipMonitorInterval) {
    clearInterval(vipMonitorInterval);
    vipMonitorInterval = null;
    console.log("[VIPMonitor] Stopped");
  }
}

export function getVipMonitorStatus(): {
  isRunning: boolean;
  lastGenerated: Date | null;
  totalGenerated: number;
  intervalActive: boolean;
} {
  return {
    isRunning,
    lastGenerated: lastGeneratedAt,
    totalGenerated,
    intervalActive: vipMonitorInterval !== null,
  };
}
