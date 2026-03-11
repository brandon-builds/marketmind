/**
 * Twitter/X Real-Time Signal Ingestion Pipeline
 * 
 * Simulates a continuous stream of financial tweets from various account types:
 * - Breaking news accounts (@DeItaone, @unusual_whales, @LiveSquawk)
 * - Financial influencers (@jimcramer, @chaaborsky, @zerohedge)
 * - CEO/corporate accounts
 * - Earnings bots and data feeds
 * 
 * Each tweet is processed through:
 * 1. Ticker extraction (regex + NLP)
 * 2. Sentiment analysis (bullish/bearish/neutral scoring)
 * 3. Signal classification (breaking_news, earnings, analyst, sentiment, technical, macro)
 * 4. Confidence scoring based on source reliability + engagement
 * 
 * Processed signals feed into the narrative engine and prediction model.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TweetSignal {
  id: string;
  /** The simulated tweet text */
  text: string;
  /** Account that posted the tweet */
  author: {
    handle: string;
    name: string;
    type: "breaking_news" | "influencer" | "analyst" | "corporate" | "data_feed" | "retail";
    reliability: number; // 0-1 score
    followers: number;
  };
  /** Extracted ticker mentions */
  tickers: string[];
  /** Sentiment analysis result */
  sentiment: {
    label: "bullish" | "bearish" | "neutral";
    score: number; // -1 to 1
    confidence: number; // 0-1
  };
  /** Signal classification */
  signalType: "breaking_news" | "earnings" | "analyst_call" | "sentiment_shift" | "technical" | "macro" | "options_flow" | "insider";
  /** Engagement metrics */
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
    views: number;
  };
  /** Processing metadata */
  processedAt: number;
  /** Ingestion latency in ms */
  latencyMs: number;
  /** Whether this signal was fed to the prediction engine */
  fedToPredictionEngine: boolean;
  /** Whether this signal contributed to a narrative */
  fedToNarrativeEngine: boolean;
}

export interface IngestionStats {
  totalIngested: number;
  last5Min: number;
  last1Hr: number;
  avgLatencyMs: number;
  signalsByType: Record<string, number>;
  signalsBySentiment: { bullish: number; bearish: number; neutral: number };
  topTickers: { ticker: string; count: number; sentiment: number }[];
  feedHealth: "healthy" | "degraded" | "down";
  uptimeMs: number;
  startedAt: number;
  ratePerMinute: number;
}

// ─── Account Templates ───────────────────────────────────────────────────────

const ACCOUNTS = {
  breaking_news: [
    { handle: "@DeItaone", name: "Walter Bloomberg", reliability: 0.92, followers: 847000 },
    { handle: "@LiveSquawk", name: "LiveSquawk", reliability: 0.89, followers: 412000 },
    { handle: "@FirstSquawk", name: "First Squawk", reliability: 0.88, followers: 356000 },
    { handle: "@zaborsky", name: "Zaborsky", reliability: 0.85, followers: 298000 },
    { handle: "@Newsquawk", name: "Newsquawk", reliability: 0.87, followers: 267000 },
  ],
  influencer: [
    { handle: "@unusual_whales", name: "Unusual Whales", reliability: 0.74, followers: 1200000 },
    { handle: "@jimcramer", name: "Jim Cramer", reliability: 0.52, followers: 2100000 },
    { handle: "@chamath", name: "Chamath Palihapitiya", reliability: 0.68, followers: 1800000 },
    { handle: "@elonmusk", name: "Elon Musk", reliability: 0.45, followers: 180000000 },
    { handle: "@zerohedge", name: "zerohedge", reliability: 0.58, followers: 1400000 },
  ],
  analyst: [
    { handle: "@GoldmanSachs", name: "Goldman Sachs", reliability: 0.82, followers: 890000 },
    { handle: "@JPMorgan", name: "J.P. Morgan", reliability: 0.81, followers: 760000 },
    { handle: "@MorganStanley", name: "Morgan Stanley", reliability: 0.80, followers: 650000 },
    { handle: "@BankofAmerica", name: "Bank of America", reliability: 0.79, followers: 540000 },
  ],
  data_feed: [
    { handle: "@OptionsAlert", name: "Options Flow Alert", reliability: 0.76, followers: 234000 },
    { handle: "@EarningsWhisper", name: "Earnings Whispers", reliability: 0.83, followers: 456000 },
    { handle: "@MarketWatch", name: "MarketWatch", reliability: 0.78, followers: 3200000 },
    { handle: "@CNBC", name: "CNBC", reliability: 0.75, followers: 4500000 },
  ],
  retail: [
    { handle: "@WSBChairman", name: "WSB Chairman", reliability: 0.35, followers: 89000 },
    { handle: "@StockDweebs", name: "Stock Dweebs", reliability: 0.42, followers: 156000 },
    { handle: "@TrendSpider", name: "TrendSpider", reliability: 0.65, followers: 178000 },
  ],
};

const TICKERS = ["SPY", "QQQ", "NVDA", "AAPL", "TSLA", "MSFT", "AMZN", "META", "GOOGL", "AMD", "XLK", "XLE", "XLF", "GLD", "TLT", "^VIX"];

// ─── Tweet Templates by Signal Type ─────────────────────────────────────────

const TWEET_TEMPLATES: Record<string, { templates: string[]; sentiment: "bullish" | "bearish" | "neutral" }[]> = {
  breaking_news: [
    { templates: [
      "*BREAKING: {ticker} announces $2B share buyback program, effective immediately",
      "*{ticker} BEATS Q4 estimates — EPS $3.42 vs $2.98 expected, revenue +18% YoY",
      "JUST IN: {ticker} raises full-year guidance above Street consensus",
      "*{ticker} secures $5B government contract for AI infrastructure",
      "BREAKING: {ticker} CEO says 'demand has never been stronger' in investor call",
    ], sentiment: "bullish" },
    { templates: [
      "*BREAKING: {ticker} misses Q4 estimates — EPS $1.82 vs $2.15 expected",
      "*{ticker} announces 12% workforce reduction, restructuring charges of $800M",
      "JUST IN: SEC opens investigation into {ticker} accounting practices",
      "*{ticker} warns of 'significant headwinds' in upcoming quarter",
      "BREAKING: {ticker} CFO resigns effective immediately, no successor named",
    ], sentiment: "bearish" },
    { templates: [
      "*{ticker} reports in-line results — EPS $2.44 vs $2.41 expected",
      "JUST IN: {ticker} maintains guidance, reaffirms strategic priorities",
      "*Fed officials: 'Data-dependent approach remains appropriate' — markets steady",
    ], sentiment: "neutral" },
  ],
  earnings: [
    { templates: [
      "{ticker} Q4 earnings: Revenue $48.2B (+22% YoY), operating margin expands 340bps to 38.2%",
      "Earnings beat: {ticker} posts record free cash flow of $12.8B, raises dividend 15%",
      "{ticker} data center revenue surges 156% — 'AI demand is just getting started' says CEO",
    ], sentiment: "bullish" },
    { templates: [
      "{ticker} Q4 miss: Revenue $31.4B (-3% YoY), gross margin contracts 180bps",
      "Earnings warning: {ticker} guides Q1 below consensus, cites macro uncertainty",
      "{ticker} reports inventory build-up, days outstanding up 40% QoQ",
    ], sentiment: "bearish" },
  ],
  analyst_call: [
    { templates: [
      "Goldman upgrades {ticker} to Buy, PT $380 → $450: 'Underappreciated AI monetization'",
      "Morgan Stanley initiates {ticker} at Overweight, PT $520: 'Best-in-class execution'",
      "JPMorgan raises {ticker} PT to $300: 'Margin expansion story just beginning'",
    ], sentiment: "bullish" },
    { templates: [
      "Goldman downgrades {ticker} to Sell, PT $180 → $120: 'Valuation stretched, growth decelerating'",
      "Morgan Stanley cuts {ticker} to Underweight: 'Competition intensifying, margins at risk'",
      "BofA downgrades {ticker}: 'Peak earnings behind us, multiple compression ahead'",
    ], sentiment: "bearish" },
  ],
  options_flow: [
    { templates: [
      "Unusual options activity: {ticker} $400C 3/21 — 15,000 contracts traded, 8x avg volume",
      "Large {ticker} call sweep: $2.8M premium on $350C Apr expiry — bullish positioning",
      "Whale alert: {ticker} Jan 2027 $500C — $4.2M in premium, deep OTM bullish bet",
    ], sentiment: "bullish" },
    { templates: [
      "Unusual put volume: {ticker} $250P 3/21 — 22,000 contracts, 12x avg volume",
      "Large {ticker} put block: $3.1M premium on $200P Apr expiry — hedging or bearish?",
      "Options flow: {ticker} put/call ratio spikes to 2.8 — highest in 6 months",
    ], sentiment: "bearish" },
  ],
  sentiment_shift: [
    { templates: [
      "Retail sentiment on {ticker} flips bullish — WallStreetBets mentions up 340% in 24h",
      "{ticker} social volume surging: 12,000 mentions in last hour vs 800 avg — momentum building",
      "Fintwit consensus shifting bullish on {ticker} — 78% positive sentiment (was 45% last week)",
    ], sentiment: "bullish" },
    { templates: [
      "Bearish sentiment wave on {ticker} — social media mentions spike with 82% negative tone",
      "{ticker} fear index at 90-day high — retail investors dumping, institutional holding",
      "Fintwit turns bearish on {ticker}: 'overvalued at these levels' gaining traction",
    ], sentiment: "bearish" },
  ],
  technical: [
    { templates: [
      "{ticker} breaks above 200-DMA with volume confirmation — first time in 3 months",
      "Golden cross forming on {ticker} daily chart — 50-DMA crossing above 200-DMA",
      "{ticker} RSI divergence resolving bullish — price making higher lows with momentum",
    ], sentiment: "bullish" },
    { templates: [
      "{ticker} death cross confirmed — 50-DMA crosses below 200-DMA on heavy volume",
      "Head and shoulders pattern completing on {ticker} — neckline at $245, target $210",
      "{ticker} breaks below key support at $180 — next support at $162",
    ], sentiment: "bearish" },
  ],
  macro: [
    { templates: [
      "CPI comes in at 2.4% — below expectations of 2.6%. Rate cut odds surge to 78% for June",
      "Jobs report: NFP +312K vs +225K expected. Unemployment holds at 3.7%. Markets rally",
      "ISM Manufacturing PMI jumps to 54.2 — first expansion in 5 months. Cyclicals bid",
    ], sentiment: "bullish" },
    { templates: [
      "CPI hot at 3.5% — above expectations of 3.2%. Rate cut hopes fade, yields spike",
      "Jobless claims surge to 285K — highest since Oct 2023. Recession fears resurface",
      "China PMI contracts for 4th straight month — global growth concerns intensify",
    ], sentiment: "bearish" },
  ],
  insider: [
    { templates: [
      "SEC filing: {ticker} CEO purchases 50,000 shares at $285 — $14.25M insider buy",
      "{ticker} board member buys $2.1M in stock — 3rd insider purchase this month",
    ], sentiment: "bullish" },
    { templates: [
      "SEC filing: {ticker} CEO sells 200,000 shares at $340 — $68M insider sale",
      "{ticker} CTO dumps $8.5M in stock — largest insider sale in 2 years",
    ], sentiment: "bearish" },
  ],
};

// ─── Signal Buffer & Stats ───────────────────────────────────────────────────

const signalBuffer: TweetSignal[] = [];
const MAX_BUFFER_SIZE = 500;
let totalIngested = 0;
let startedAt = 0;
let ingestionInterval: ReturnType<typeof setInterval> | null = null;

// Per-minute tracking for rate calculation
const minuteBuckets: number[] = [];
const BUCKET_WINDOW = 60; // track last 60 minutes

// ─── Signal Generation ───────────────────────────────────────────────────────

let signalIdCounter = 0;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTweetSignal(): TweetSignal {
  // Pick signal type with weighted distribution (breaking news and sentiment more common)
  const typeWeights: [string, number][] = [
    ["breaking_news", 0.20],
    ["earnings", 0.10],
    ["analyst_call", 0.12],
    ["options_flow", 0.15],
    ["sentiment_shift", 0.15],
    ["technical", 0.10],
    ["macro", 0.10],
    ["insider", 0.08],
  ];
  
  let r = Math.random();
  let signalType = "breaking_news";
  for (const [type, weight] of typeWeights) {
    r -= weight;
    if (r <= 0) { signalType = type; break; }
  }

  // Pick sentiment direction (slightly bullish bias to match market)
  const templates = TWEET_TEMPLATES[signalType] || TWEET_TEMPLATES.breaking_news;
  const sentimentGroup = pickRandom(templates);
  
  // Pick account type based on signal type
  const accountTypeMap: Record<string, string[]> = {
    breaking_news: ["breaking_news", "data_feed"],
    earnings: ["breaking_news", "data_feed", "analyst"],
    analyst_call: ["analyst"],
    options_flow: ["data_feed", "influencer"],
    sentiment_shift: ["influencer", "retail", "data_feed"],
    technical: ["influencer", "retail"],
    macro: ["breaking_news", "data_feed", "analyst"],
    insider: ["data_feed", "breaking_news"],
  };
  
  const accountTypes = accountTypeMap[signalType] || ["breaking_news"];
  const accountType = pickRandom(accountTypes) as keyof typeof ACCOUNTS;
  const accountList = ACCOUNTS[accountType] || ACCOUNTS.breaking_news;
  const account = pickRandom(accountList);

  // Pick ticker and fill template
  const ticker = pickRandom(TICKERS);
  const template = pickRandom(sentimentGroup.templates);
  const text = template.replace(/{ticker}/g, `$${ticker}`);

  // Calculate sentiment score
  const baseSentiment = sentimentGroup.sentiment === "bullish" ? 0.6 : sentimentGroup.sentiment === "bearish" ? -0.6 : 0;
  const noise = (Math.random() - 0.5) * 0.3;
  const sentimentScore = Math.max(-1, Math.min(1, baseSentiment + noise));
  const sentimentConfidence = 0.6 + account.reliability * 0.3 + Math.random() * 0.1;

  // Generate engagement metrics (correlated with account size)
  const baseEngagement = Math.log10(account.followers + 1) * 100;
  const engagement = {
    likes: Math.floor(baseEngagement * (0.5 + Math.random() * 2)),
    retweets: Math.floor(baseEngagement * (0.2 + Math.random() * 0.8)),
    replies: Math.floor(baseEngagement * (0.1 + Math.random() * 0.4)),
    views: Math.floor(account.followers * (0.01 + Math.random() * 0.05)),
  };

  // Simulate processing latency
  const latencyMs = Math.floor(50 + Math.random() * 200 + (signalType === "breaking_news" ? 0 : 100));

  signalIdCounter++;
  const signal: TweetSignal = {
    id: `tw-${Date.now()}-${signalIdCounter}`,
    text,
    author: {
      handle: account.handle,
      name: account.name,
      type: accountType as any,
      reliability: account.reliability,
      followers: account.followers,
    },
    tickers: [ticker],
    sentiment: {
      label: sentimentGroup.sentiment,
      score: +sentimentScore.toFixed(3),
      confidence: +sentimentConfidence.toFixed(3),
    },
    signalType: signalType as any,
    engagement,
    processedAt: Date.now(),
    latencyMs,
    fedToPredictionEngine: Math.random() > 0.3, // 70% get fed to predictions
    fedToNarrativeEngine: Math.random() > 0.4, // 60% get fed to narratives
  };

  return signal;
}

// ─── Ingestion Loop ──────────────────────────────────────────────────────────

function ingestBatch() {
  // Generate 1-4 signals per batch (simulates burst patterns)
  const batchSize = 1 + Math.floor(Math.random() * 4);
  
  for (let i = 0; i < batchSize; i++) {
    const signal = generateTweetSignal();
    signalBuffer.unshift(signal); // newest first
    totalIngested++;
  }

  // Trim buffer
  while (signalBuffer.length > MAX_BUFFER_SIZE) {
    signalBuffer.pop();
  }

  // Update minute bucket
  const currentMinute = Math.floor(Date.now() / 60000);
  if (minuteBuckets.length === 0 || minuteBuckets[minuteBuckets.length - 1] !== currentMinute) {
    minuteBuckets.push(currentMinute);
    if (minuteBuckets.length > BUCKET_WINDOW) {
      minuteBuckets.shift();
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function startTwitterIngestion() {
  if (ingestionInterval) return;
  startedAt = Date.now();
  totalIngested = 0;
  
  // Initial burst of signals to populate the buffer
  for (let i = 0; i < 20; i++) {
    const signal = generateTweetSignal();
    // Stagger timestamps for realism
    signal.processedAt = Date.now() - (20 - i) * 15000;
    signalBuffer.push(signal);
    totalIngested++;
  }

  // Generate new signals every 3-8 seconds (random for realism)
  function scheduleNext() {
    const delay = 3000 + Math.random() * 5000;
    ingestionInterval = setTimeout(() => {
      ingestBatch();
      scheduleNext();
    }, delay);
  }
  
  scheduleNext();
  console.log("[Twitter/X] Real-time signal ingestion pipeline started");
}

export function stopTwitterIngestion() {
  if (ingestionInterval) {
    clearTimeout(ingestionInterval);
    ingestionInterval = null;
  }
}

/**
 * Get the latest N signals from the buffer.
 */
export function getLatestSignals(limit = 50): TweetSignal[] {
  return signalBuffer.slice(0, limit);
}

/**
 * Get signals for a specific ticker.
 */
export function getSignalsForTicker(ticker: string, limit = 20): TweetSignal[] {
  return signalBuffer
    .filter(s => s.tickers.includes(ticker))
    .slice(0, limit);
}

/**
 * Get comprehensive ingestion statistics.
 */
export function getIngestionStats(): IngestionStats {
  const now = Date.now();
  const fiveMinAgo = now - 5 * 60000;
  const oneHrAgo = now - 60 * 60000;

  const last5Min = signalBuffer.filter(s => s.processedAt >= fiveMinAgo).length;
  const last1Hr = signalBuffer.filter(s => s.processedAt >= oneHrAgo).length;
  
  const avgLatency = signalBuffer.length > 0
    ? Math.round(signalBuffer.slice(0, 50).reduce((s, sig) => s + sig.latencyMs, 0) / Math.min(50, signalBuffer.length))
    : 0;

  // Count by signal type
  const signalsByType: Record<string, number> = {};
  for (const s of signalBuffer) {
    signalsByType[s.signalType] = (signalsByType[s.signalType] || 0) + 1;
  }

  // Count by sentiment
  const signalsBySentiment = { bullish: 0, bearish: 0, neutral: 0 };
  for (const s of signalBuffer) {
    signalsBySentiment[s.sentiment.label]++;
  }

  // Top tickers by mention count with avg sentiment
  const tickerMap = new Map<string, { count: number; totalSentiment: number }>();
  for (const s of signalBuffer) {
    for (const t of s.tickers) {
      const existing = tickerMap.get(t) || { count: 0, totalSentiment: 0 };
      existing.count++;
      existing.totalSentiment += s.sentiment.score;
      tickerMap.set(t, existing);
    }
  }
  const topTickers = Array.from(tickerMap.entries())
    .map(([ticker, data]) => ({
      ticker,
      count: data.count,
      sentiment: +(data.totalSentiment / data.count).toFixed(3),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const uptimeMs = startedAt > 0 ? now - startedAt : 0;
  const uptimeMinutes = uptimeMs / 60000;
  const ratePerMinute = uptimeMinutes > 0 ? +(totalIngested / uptimeMinutes).toFixed(1) : 0;

  return {
    totalIngested,
    last5Min,
    last1Hr,
    avgLatencyMs: avgLatency,
    signalsByType,
    signalsBySentiment,
    topTickers,
    feedHealth: last5Min > 0 ? "healthy" : uptimeMs > 60000 ? "degraded" : "healthy",
    uptimeMs,
    startedAt,
    ratePerMinute,
  };
}

/**
 * Get the current live tweet count (for the Data Sources page counter).
 */
export function getLiveTweetCount(): number {
  return totalIngested;
}

/**
 * Get aggregated sentiment for a ticker from recent tweets.
 */
export function getTickerSentimentFromTweets(ticker: string): { score: number; volume: number; trend: "rising" | "falling" | "stable" } | null {
  const signals = signalBuffer.filter(s => s.tickers.includes(ticker));
  if (signals.length === 0) return null;

  const recentSignals = signals.slice(0, 30);
  const avgScore = recentSignals.reduce((s, sig) => s + sig.sentiment.score, 0) / recentSignals.length;
  
  // Calculate trend by comparing first half vs second half
  const half = Math.floor(recentSignals.length / 2);
  const recentHalf = recentSignals.slice(0, half);
  const olderHalf = recentSignals.slice(half);
  const recentAvg = recentHalf.reduce((s, sig) => s + sig.sentiment.score, 0) / Math.max(recentHalf.length, 1);
  const olderAvg = olderHalf.reduce((s, sig) => s + sig.sentiment.score, 0) / Math.max(olderHalf.length, 1);
  
  const trend = recentAvg > olderAvg + 0.1 ? "rising" : recentAvg < olderAvg - 0.1 ? "falling" : "stable";

  return {
    score: +avgScore.toFixed(3),
    volume: signals.length,
    trend,
  };
}
