/**
 * Real Data Ingestion Service
 * Pulls actual data from Reddit, Yahoo Finance, and RSS feeds
 */
import { getDb } from "./db";
import { ingestedSignals, agentRuns, type InsertIngestedSignal } from "../drizzle/schema";
import { desc, eq, sql, and, gte } from "drizzle-orm";
import { ingestVipTweets, getVipTwitterStatus } from "./realTwitterVip";
import { ingestPodcasts, getPodcastStatus } from "./realPodcastIngestion";
import { ingestAllSources, getAllDataSourceStatuses, type DataSourceInfo } from "./realDataSources";

// ============================================================================
// Configuration
// ============================================================================

const TRACKED_TICKERS = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD",
  "SPY", "QQQ", "XLE", "XLK", "XLF", "GLD", "BRK-B", "JPM",
  "V", "UNH", "JNJ", "WMT", "PG", "HD", "DIS", "NFLX", "INTC",
];

const REDDIT_SUBREDDITS = ["wallstreetbets", "stocks", "investing"];

const RSS_FEEDS = [
  { name: "Reuters Business", url: "https://news.google.com/rss/search?q=stock+market+when:1d&hl=en-US&gl=US&ceid=US:en" },
  { name: "CNBC Top News", url: "https://news.google.com/rss/search?q=CNBC+stocks+market&hl=en-US&gl=US&ceid=US:en" },
  { name: "Bloomberg Markets", url: "https://news.google.com/rss/search?q=Bloomberg+markets+stocks&hl=en-US&gl=US&ceid=US:en" },
  { name: "Financial Times", url: "https://news.google.com/rss/search?q=financial+times+markets&hl=en-US&gl=US&ceid=US:en" },
];

// ============================================================================
// Agent Status Tracking
// ============================================================================

interface IngestionStatus {
  lastRun: Date | null;
  nextRun: Date | null;
  sourcesActive: number;
  signalsPerHour: number;
  lastError: string | null;
  isRunning: boolean;
  totalSignalsToday: number;
  sourceBreakdown: Record<string, { count: number; lastFetched: Date | null; status: string }>;
}

let ingestionStatus: IngestionStatus = {
  lastRun: null,
  nextRun: null,
  sourcesActive: 0,
  signalsPerHour: 0,
  lastError: null,
  isRunning: false,
  totalSignalsToday: 0,
  sourceBreakdown: {
    reddit: { count: 0, lastFetched: null, status: "idle" },
    yahoo_finance: { count: 0, lastFetched: null, status: "idle" },
    rss_news: { count: 0, lastFetched: null, status: "idle" },
    twitter_vip: { count: 0, lastFetched: null, status: "idle" },
    podcast_youtube: { count: 0, lastFetched: null, status: "idle" },
    sec_edgar: { count: 0, lastFetched: null, status: "idle" },
    fred_macro: { count: 0, lastFetched: null, status: "idle" },
    polymarket: { count: 0, lastFetched: null, status: "idle" },
    stocktwits: { count: 0, lastFetched: null, status: "idle" },
    cboe_vix: { count: 0, lastFetched: null, status: "idle" },
    google_trends: { count: 0, lastFetched: null, status: "idle" },
    congressional: { count: 0, lastFetched: null, status: "idle" },
  },
};

export function getIngestionStatus(): IngestionStatus {
  return { ...ingestionStatus };
}

// ============================================================================
// Reddit Ingestion (public JSON API — no auth needed)
// ============================================================================

async function fetchRedditPosts(subreddit: string): Promise<InsertIngestedSignal[]> {
  const signals: InsertIngestedSignal[] = [];

  try {
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
      {
        headers: {
          "User-Agent": "MarketMind/1.0 (market intelligence platform)",
        },
      }
    );

    if (!response.ok) {
      console.warn(`[Ingestion] Reddit r/${subreddit} returned ${response.status}`);
      return signals;
    }

    const data = await response.json();
    const posts = data?.data?.children || [];

    for (const post of posts) {
      const { title, selftext, author, url, score, num_comments, created_utc } = post.data;
      const fullText = `${title} ${selftext || ""}`.toUpperCase();

      // Extract ticker mentions
      const mentionedTickers = TRACKED_TICKERS.filter((t) => {
        const regex = new RegExp(`\\b\\$?${t}\\b`, "i");
        return regex.test(fullText);
      });

      if (mentionedTickers.length === 0) continue;

      // Quick sentiment from title keywords
      const sentiment = detectSentiment(title + " " + (selftext || ""));

      for (const ticker of mentionedTickers) {
        signals.push({
          source: "reddit",
          sourceDetail: `r/${subreddit}`,
          ticker,
          title: title.slice(0, 500),
          content: (selftext || "").slice(0, 1000),
          url: `https://reddit.com${post.data.permalink}`,
          author: author || "anonymous",
          sentiment: sentiment.label,
          sentimentScore: sentiment.score,
          signalType: "social_mention",
          metadata: JSON.stringify({
            score,
            numComments: num_comments,
            createdUtc: created_utc,
            subreddit,
          }),
        });
      }
    }

    ingestionStatus.sourceBreakdown.reddit = {
      count: (ingestionStatus.sourceBreakdown.reddit?.count || 0) + signals.length,
      lastFetched: new Date(),
      status: "active",
    };

    console.log(`[Ingestion] Reddit r/${subreddit}: ${signals.length} signals extracted`);
  } catch (err: any) {
    console.error(`[Ingestion] Reddit r/${subreddit} error:`, err.message);
    ingestionStatus.sourceBreakdown.reddit = {
      ...ingestionStatus.sourceBreakdown.reddit,
      status: `error: ${err.message}`,
    };
  }

  return signals;
}

// ============================================================================
// Yahoo Finance Ingestion (public API)
// ============================================================================

async function fetchYahooFinanceData(): Promise<InsertIngestedSignal[]> {
  const signals: InsertIngestedSignal[] = [];
  const batchSize = 5;

  for (let i = 0; i < TRACKED_TICKERS.length; i += batchSize) {
    const batch = TRACKED_TICKERS.slice(i, i + batchSize);

    for (const ticker of batch) {
      try {
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            },
          }
        );

        if (!response.ok) continue;

        const data = await response.json();
        const result = data?.chart?.result?.[0];
        if (!result) continue;

        const meta = result.meta;
        const quotes = result.indicators?.quote?.[0];
        const timestamps = result.timestamp;

        if (!meta || !quotes || !timestamps) continue;

        const currentPrice = meta.regularMarketPrice;
        const previousClose = meta.chartPreviousClose || meta.previousClose;
        const volume = quotes.volume?.[quotes.volume.length - 1] || 0;
        const avgVolume = quotes.volume
          ? quotes.volume.reduce((a: number, b: number) => a + (b || 0), 0) / quotes.volume.length
          : 0;

        const changePercent = previousClose
          ? ((currentPrice - previousClose) / previousClose) * 100
          : 0;

        // Detect volume spike
        const isVolumeSpike = volume > avgVolume * 2;

        signals.push({
          source: "yahoo_finance",
          sourceDetail: "Yahoo Finance API",
          ticker,
          title: `${ticker}: $${currentPrice?.toFixed(2)} (${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}%)`,
          content: `Price: $${currentPrice?.toFixed(2)}, Volume: ${(volume / 1e6).toFixed(1)}M, Avg Volume: ${(avgVolume / 1e6).toFixed(1)}M`,
          sentiment: changePercent > 1 ? "bullish" : changePercent < -1 ? "bearish" : "neutral",
          sentimentScore: Math.round(Math.max(-100, Math.min(100, changePercent * 20))),
          signalType: isVolumeSpike ? "volume_spike" : "price_data",
          metadata: JSON.stringify({
            price: currentPrice,
            previousClose,
            changePercent: +changePercent.toFixed(2),
            volume,
            avgVolume: Math.round(avgVolume),
            marketCap: meta.marketCap,
            isVolumeSpike,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
          }),
        });
      } catch (err: any) {
        // Skip individual ticker errors
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < TRACKED_TICKERS.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  ingestionStatus.sourceBreakdown.yahoo_finance = {
    count: (ingestionStatus.sourceBreakdown.yahoo_finance?.count || 0) + signals.length,
    lastFetched: new Date(),
    status: signals.length > 0 ? "active" : "no data",
  };

  console.log(`[Ingestion] Yahoo Finance: ${signals.length} price signals fetched`);
  return signals;
}

// ============================================================================
// RSS Feed Ingestion
// ============================================================================

async function fetchRSSFeeds(): Promise<InsertIngestedSignal[]> {
  const signals: InsertIngestedSignal[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      const response = await fetch(feed.url, {
        headers: {
          "User-Agent": "MarketMind/1.0 (market intelligence platform)",
        },
      });

      if (!response.ok) continue;

      const text = await response.text();

      // Simple XML parsing for RSS items
      const items = text.match(/<item>([\s\S]*?)<\/item>/g) || [];

      for (const item of items.slice(0, 15)) {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]>|<description>(.*?)<\/description>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/);

        const title = (titleMatch?.[1] || titleMatch?.[2] || "").replace(/<[^>]*>/g, "").trim();
        const link = linkMatch?.[1] || "";
        const description = (descMatch?.[1] || descMatch?.[2] || "").replace(/<[^>]*>/g, "").trim();
        const pubDate = pubDateMatch?.[1] || "";
        const sourceName = sourceMatch?.[1] || feed.name;

        if (!title) continue;

        // Extract ticker mentions from headline
        const fullText = `${title} ${description}`.toUpperCase();
        const mentionedTickers = TRACKED_TICKERS.filter((t) => {
          const regex = new RegExp(`\\b\\$?${t}\\b`, "i");
          return regex.test(fullText);
        });

        // Also check for company names
        const companyMentions: Record<string, string> = {
          APPLE: "AAPL", MICROSOFT: "MSFT", NVIDIA: "NVDA", GOOGLE: "GOOGL",
          ALPHABET: "GOOGL", AMAZON: "AMZN", TESLA: "TSLA", "META PLATFORMS": "META",
          FACEBOOK: "META", NETFLIX: "NFLX", INTEL: "INTC", AMD: "AMD",
          "JPMORGAN": "JPM", "GOLDMAN": "GS", "WALL STREET": "SPY",
          "S&P 500": "SPY", "S&P": "SPY", NASDAQ: "QQQ", "DOW JONES": "SPY",
        };

        for (const [name, ticker] of Object.entries(companyMentions)) {
          if (fullText.includes(name) && !mentionedTickers.includes(ticker)) {
            mentionedTickers.push(ticker);
          }
        }

        const sentiment = detectSentiment(title + " " + description);

        // If no specific ticker found, still store as general market signal
        const tickersToStore = mentionedTickers.length > 0 ? mentionedTickers : [null];

        for (const ticker of tickersToStore) {
          signals.push({
            source: "rss_news",
            sourceDetail: sourceName,
            ticker,
            title: title.slice(0, 500),
            content: description.slice(0, 1000),
            url: link,
            author: sourceName,
            sentiment: sentiment.label,
            sentimentScore: sentiment.score,
            signalType: "news_headline",
            metadata: JSON.stringify({
              feedName: feed.name,
              pubDate,
              sourceName,
            }),
          });
        }
      }
    } catch (err: any) {
      console.error(`[Ingestion] RSS ${feed.name} error:`, err.message);
    }
  }

  ingestionStatus.sourceBreakdown.rss_news = {
    count: (ingestionStatus.sourceBreakdown.rss_news?.count || 0) + signals.length,
    lastFetched: new Date(),
    status: signals.length > 0 ? "active" : "no data",
  };

  console.log(`[Ingestion] RSS Feeds: ${signals.length} news signals extracted`);
  return signals;
}

// ============================================================================
// Sentiment Detection (rule-based, fast)
// ============================================================================

function detectSentiment(text: string): { label: "bullish" | "bearish" | "neutral"; score: number } {
  const upper = text.toUpperCase();

  const bullishWords = [
    "BULL", "MOON", "ROCKET", "CALLS", "LONG", "BUY", "SURGE", "RALLY",
    "BREAKOUT", "UPGRADE", "BEAT", "GROWTH", "STRONG", "SOAR", "GAIN",
    "RECORD HIGH", "ALL-TIME HIGH", "OUTPERFORM", "UPSIDE", "POSITIVE",
    "BOOST", "RECOVERY", "PROFIT", "REVENUE BEAT", "EARNINGS BEAT",
  ];

  const bearishWords = [
    "BEAR", "CRASH", "PUTS", "SHORT", "SELL", "PLUNGE", "DROP", "TANK",
    "BREAKDOWN", "DOWNGRADE", "MISS", "DECLINE", "WEAK", "FALL", "LOSS",
    "RECORD LOW", "UNDERPERFORM", "DOWNSIDE", "NEGATIVE", "CUT",
    "RECESSION", "LAYOFF", "BANKRUPTCY", "DEFAULT", "TARIFF", "RISK",
    "WARNING", "CONCERN", "FEAR", "CRISIS", "INFLATION",
  ];

  let bullCount = 0;
  let bearCount = 0;

  for (const word of bullishWords) {
    if (upper.includes(word)) bullCount++;
  }
  for (const word of bearishWords) {
    if (upper.includes(word)) bearCount++;
  }

  const total = bullCount + bearCount;
  if (total === 0) return { label: "neutral", score: 0 };

  const netScore = ((bullCount - bearCount) / total) * 100;

  if (netScore > 20) return { label: "bullish", score: Math.round(netScore) };
  if (netScore < -20) return { label: "bearish", score: Math.round(netScore) };
  return { label: "neutral", score: Math.round(netScore) };
}

// ============================================================================
// Main Ingestion Cycle
// ============================================================================

async function runIngestionCycle(): Promise<number> {
  ingestionStatus.isRunning = true;
  const startTime = Date.now();
  let totalSignals = 0;
  const db = await getDb();
  if (!db) { ingestionStatus.isRunning = false; return 0; }

  // Record agent run start
  const [runRecord] = await db.insert(agentRuns).values({
    agentType: "ingestion",
    status: "running",
    signalsProcessed: 0,
  }).$returningId();

  try {
    // 1. Fetch from all sources in parallel
    const [redditSignals, yahooSignals, rssSignals] = await Promise.all([
      Promise.all(REDDIT_SUBREDDITS.map(fetchRedditPosts)).then((r) => r.flat()),
      fetchYahooFinanceData(),
      fetchRSSFeeds(),
    ]);

    const allSignals = [...redditSignals, ...yahooSignals, ...rssSignals];
    totalSignals = allSignals.length;

    // 1b. Ingest new real data sources (these insert directly into DB)
    let newSourceSignals = 0;
    try {
      const vipResult = await ingestVipTweets();
      newSourceSignals += vipResult.tweetsIngested;
      ingestionStatus.sourceBreakdown.twitter_vip = {
        count: vipResult.tweetsIngested,
        lastFetched: new Date(),
        status: vipResult.accountsFailed === 17 ? "error" : vipResult.tweetsIngested > 0 ? "active" : "no data",
      };
    } catch (err: any) {
      console.warn("[Ingestion] VIP tweets failed:", err.message);
    }

    try {
      const podcastResult = await ingestPodcasts();
      newSourceSignals += podcastResult.episodesIngested;
      ingestionStatus.sourceBreakdown.podcast_youtube = {
        count: podcastResult.episodesIngested,
        lastFetched: new Date(),
        status: podcastResult.episodesIngested > 0 ? "active" : "no data",
      };
    } catch (err: any) {
      console.warn("[Ingestion] Podcasts failed:", err.message);
    }

    try {
      const dsResults = await ingestAllSources();
      for (const [source, result] of Object.entries(dsResults)) {
        newSourceSignals += result.ingested;
        const key = source as keyof typeof ingestionStatus.sourceBreakdown;
        if (ingestionStatus.sourceBreakdown[key]) {
          ingestionStatus.sourceBreakdown[key] = {
            count: result.ingested,
            lastFetched: new Date(),
            status: result.ingested > 0 ? "active" : result.errors.length > 0 ? "error" : "no data",
          };
        }
      }
    } catch (err: any) {
      console.warn("[Ingestion] New data sources failed:", err.message);
    }

    totalSignals += newSourceSignals;

    // 2. Batch insert into database
    if (allSignals.length > 0) {
      // Insert in batches of 50 to avoid query size limits
      for (let i = 0; i < allSignals.length; i += 50) {
        const batch = allSignals.slice(i, i + 50);
        await db.insert(ingestedSignals).values(batch);
      }
    }

    // 3. Update agent run record
    await db.update(agentRuns)
      .set({
        status: "completed",
        signalsProcessed: totalSignals,
        completedAt: new Date(),
        metadata: JSON.stringify({
          reddit: redditSignals.length,
          yahoo: yahooSignals.length,
          rss: rssSignals.length,
          newSources: newSourceSignals,
          durationMs: Date.now() - startTime,
        }),
      })
      .where(eq(agentRuns.id, runRecord.id));

    ingestionStatus.lastRun = new Date();
    ingestionStatus.lastError = null;
    ingestionStatus.sourcesActive = Object.values(ingestionStatus.sourceBreakdown)
      .filter((s) => s.status === "active").length;

    console.log(`[Ingestion] Cycle complete: ${totalSignals} signals ingested in ${Date.now() - startTime}ms`);
  } catch (err: any) {
    console.error("[Ingestion] Cycle failed:", err.message);
    ingestionStatus.lastError = err.message;

    await db.update(agentRuns)
      .set({
        status: "failed",
        errorMessage: err.message,
        completedAt: new Date(),
      })
      .where(eq(agentRuns.id, runRecord.id));
  } finally {
    ingestionStatus.isRunning = false;
  }

  return totalSignals;
}

// ============================================================================
// Query Helpers
// ============================================================================

export async function getRecentSignals(limit = 50, source?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = source ? [eq(ingestedSignals.source, source as any)] : [];
  return db.select()
    .from(ingestedSignals)
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(desc(ingestedSignals.ingestedAt))
    .limit(limit);
}

export async function getSignalCountsBySource() {
  const db = await getDb();
  if (!db) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const counts = await db.select({
    source: ingestedSignals.source,
    count: sql<number>`count(*)`,
    latestAt: sql<Date>`max(${ingestedSignals.ingestedAt})`,
  })
    .from(ingestedSignals)
    .where(gte(ingestedSignals.ingestedAt, today))
    .groupBy(ingestedSignals.source);

  return counts;
}

export async function getTickerSignals(ticker: string, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(ingestedSignals)
    .where(eq(ingestedSignals.ticker, ticker))
    .orderBy(desc(ingestedSignals.ingestedAt))
    .limit(limit);
}

export async function getSignalSentimentSummary() {
  const db = await getDb();
  if (!db) return [];
  const oneHourAgo = new Date(Date.now() - 3600000);

  return db.select({
    ticker: ingestedSignals.ticker,
    sentiment: ingestedSignals.sentiment,
    count: sql<number>`count(*)`,
    avgScore: sql<number>`avg(${ingestedSignals.sentimentScore})`,
  })
    .from(ingestedSignals)
    .where(and(
      gte(ingestedSignals.ingestedAt, oneHourAgo),
      sql`${ingestedSignals.ticker} IS NOT NULL`,
    ))
    .groupBy(ingestedSignals.ticker, ingestedSignals.sentiment);
}

// ============================================================================
// Scheduler
// ============================================================================

const INGESTION_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let ingestionTimer: ReturnType<typeof setInterval> | null = null;

export function startRealIngestion() {
  console.log("[Ingestion] Starting real data ingestion service (every 10 min)...");

  // Run immediately
  runIngestionCycle().then((count) => {
    ingestionStatus.totalSignalsToday += count;
    ingestionStatus.nextRun = new Date(Date.now() + INGESTION_INTERVAL_MS);
  });

  // Schedule recurring
  ingestionTimer = setInterval(async () => {
    const count = await runIngestionCycle();
    ingestionStatus.totalSignalsToday += count;
    ingestionStatus.nextRun = new Date(Date.now() + INGESTION_INTERVAL_MS);

    // Calculate signals per hour
    const hoursSinceStart = Math.max(1, (Date.now() - (ingestionStatus.lastRun?.getTime() || Date.now())) / 3600000);
    ingestionStatus.signalsPerHour = Math.round(ingestionStatus.totalSignalsToday / hoursSinceStart);
  }, INGESTION_INTERVAL_MS);

  return ingestionTimer;
}

export function stopRealIngestion() {
  if (ingestionTimer) {
    clearInterval(ingestionTimer);
    ingestionTimer = null;
  }
}

// ============================================================================
// Full Data Source Status (combines all sources)
// ============================================================================

export async function getFullDataSourceStatus(): Promise<DataSourceInfo[]> {
  const [vipStatus, podcastStatus, otherStatuses] = await Promise.all([
    getVipTwitterStatus(),
    getPodcastStatus(),
    getAllDataSourceStatuses(),
  ]);

  // Get original 3 source stats
  const coreSourceStats = await getSignalCountsBySource();
  const coreMap = new Map(coreSourceStats.map(s => [s.source, s]));

  const coreSources: DataSourceInfo[] = [
    {
      name: "Reddit (Social Sentiment)",
      source: "reddit",
      status: coreMap.has("reddit") ? "active" : "unavailable",
      lastIngestion: coreMap.get("reddit")?.latestAt || null,
      recentSignalCount: Number(coreMap.get("reddit")?.count || 0),
      description: "Real posts from r/wallstreetbets, r/stocks, r/investing. Free, no API key.",
      apiKeyRequired: false,
    },
    {
      name: "Yahoo Finance (Price Data)",
      source: "yahoo_finance",
      status: coreMap.has("yahoo_finance") ? "active" : "unavailable",
      lastIngestion: coreMap.get("yahoo_finance")?.latestAt || null,
      recentSignalCount: Number(coreMap.get("yahoo_finance")?.count || 0),
      description: "Real price, volume, and fundamental data from Yahoo Finance. Free, no API key.",
      apiKeyRequired: false,
    },
    {
      name: "RSS News Feeds",
      source: "rss_news",
      status: coreMap.has("rss_news") ? "active" : "unavailable",
      lastIngestion: coreMap.get("rss_news")?.latestAt || null,
      recentSignalCount: Number(coreMap.get("rss_news")?.count || 0),
      description: "Real headlines from Reuters, Bloomberg, CNBC, Financial Times via Google News RSS. Free.",
      apiKeyRequired: false,
    },
  ];

  const vipSource: DataSourceInfo = {
    name: "X/Twitter VIP Accounts",
    source: "twitter_vip",
    status: vipStatus.status,
    lastIngestion: vipStatus.lastIngestion,
    recentSignalCount: vipStatus.recentTweetCount,
    description: `Real tweets from ${vipStatus.totalAccounts} curated VIP accounts via Nitter RSS. Free, no API key.`,
    apiKeyRequired: false,
  };

  const podcastSource: DataSourceInfo = {
    name: "Finance Podcasts (YouTube)",
    source: "podcast_youtube",
    status: podcastStatus.status,
    lastIngestion: podcastStatus.lastIngestion,
    recentSignalCount: podcastStatus.recentEpisodeCount,
    description: `Real episodes from ${podcastStatus.totalChannels} finance podcasts via YouTube RSS. Free, no API key.`,
    apiKeyRequired: false,
  };

  return [...coreSources, vipSource, podcastSource, ...otherStatuses];
}
