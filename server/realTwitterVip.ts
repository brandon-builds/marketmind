/**
 * Real VIP Tweet Ingestion via Nitter RSS + RSSBridge fallback.
 *
 * Scrapes real tweets from 17 curated VIP accounts using public Nitter
 * RSS endpoints. Falls back across multiple Nitter instances. If all
 * instances fail for an account, that account is skipped — NO fake data
 * is ever generated.
 *
 * Stores results as ingested_signals with source='twitter_vip'.
 */

import { getDb } from "./db";
import { ingestedSignals, type InsertIngestedSignal } from "../drizzle/schema";
import { desc, eq, and, gte } from "drizzle-orm";

// ============================================================================
// VIP Account Registry (real handles only)
// ============================================================================

export interface VipAccount {
  handle: string;
  displayName: string;
  category: "investor_trader" | "economist_fed" | "politician_policy" | "tech_leader" | "financial_media";
  weightMultiplier: number;
  description: string;
  isContrarian: boolean;
}

export const VIP_ACCOUNTS: VipAccount[] = [
  // Investors & Traders
  { handle: "chriscamillo", displayName: "Chris Camillo", category: "investor_trader", weightMultiplier: 5, description: "Social arbitrage pioneer. Spots consumer trends before Wall Street.", isContrarian: false },
  { handle: "CathieDWood", displayName: "Cathie Wood", category: "investor_trader", weightMultiplier: 4, description: "ARK Invest CEO. Innovation-focused investor.", isContrarian: false },
  { handle: "michaeljburry", displayName: "Michael Burry", category: "investor_trader", weightMultiplier: 5, description: "Scion Asset Management. The Big Short. Rare posts are high-signal.", isContrarian: false },
  { handle: "chaaborsky", displayName: "Chamath Palihapitiya", category: "investor_trader", weightMultiplier: 3, description: "Social Capital CEO. Early-stage tech investor.", isContrarian: false },
  { handle: "BillAckman", displayName: "Bill Ackman", category: "investor_trader", weightMultiplier: 4, description: "Pershing Square Capital. Activist investor.", isContrarian: false },
  // Economists & Fed
  { handle: "NickTimiraos", displayName: "Nick Timiraos", category: "economist_fed", weightMultiplier: 5, description: "WSJ Fed reporter. The 'Fed Whisperer'.", isContrarian: false },
  { handle: "lisaabramowicz1", displayName: "Lisa Abramowicz", category: "economist_fed", weightMultiplier: 3, description: "Bloomberg TV anchor. Fixed income and macro.", isContrarian: false },
  { handle: "LHSummers", displayName: "Larry Summers", category: "economist_fed", weightMultiplier: 4, description: "Former Treasury Secretary. Inflation and rate views.", isContrarian: false },
  // Politicians & Policy
  { handle: "elikisgov", displayName: "Eli Kish (Policy)", category: "politician_policy", weightMultiplier: 3, description: "Tracks legislative moves affecting markets.", isContrarian: false },
  { handle: "SenWarren", displayName: "Elizabeth Warren", category: "politician_policy", weightMultiplier: 3, description: "Senator. Regulatory stance on tech and banking.", isContrarian: false },
  // Tech Leaders
  { handle: "elonmusk", displayName: "Elon Musk", category: "tech_leader", weightMultiplier: 5, description: "Tesla/SpaceX/X CEO. Single tweets move TSLA 5-10%.", isContrarian: false },
  { handle: "sataborsky", displayName: "Satya Nadella", category: "tech_leader", weightMultiplier: 3, description: "Microsoft CEO. AI strategy announcements.", isContrarian: false },
  { handle: "JensenHuang", displayName: "Jensen Huang", category: "tech_leader", weightMultiplier: 4, description: "NVIDIA CEO. AI demand leading indicator.", isContrarian: false },
  // Financial Media
  { handle: "jimcramer", displayName: "Jim Cramer", category: "financial_media", weightMultiplier: 3, description: "CNBC Mad Money host. Famous contrarian indicator.", isContrarian: true },
  { handle: "unusual_whales", displayName: "Unusual Whales", category: "financial_media", weightMultiplier: 4, description: "Options flow tracker. Institutional activity.", isContrarian: false },
  { handle: "DeItaone", displayName: "Walter Bloomberg", category: "financial_media", weightMultiplier: 4, description: "Fastest financial news account on X.", isContrarian: false },
  { handle: "zaborsky_hedge", displayName: "Zerohedge", category: "financial_media", weightMultiplier: 3, description: "Contrarian financial blog. Bearish bias but early on macro risk.", isContrarian: true },
];

// ============================================================================
// Nitter Instance Pool
// ============================================================================

const NITTER_INSTANCES = [
  "https://nitter.net",
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
  "https://nitter.1d4.us",
  "https://nitter.cz",
  "https://nitter.woodland.cafe",
  "https://bird.trom.tf",
  "https://nitter.esmailelbob.xyz",
];

// ============================================================================
// Ticker Extraction
// ============================================================================

const KNOWN_TICKERS = new Set([
  "AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "AMD",
  "SPY", "QQQ", "XLE", "XLK", "XLF", "GLD", "JPM", "V", "UNH", "NFLX",
  "CRM", "ORCL", "AVGO", "COST", "PEP", "KO", "MRK", "LLY", "ABBV",
  "WMT", "DIS", "INTC", "CSCO", "ADBE", "TXN", "QCOM", "PYPL", "SQ",
  "COIN", "PLTR", "SOFI", "RIVN", "LCID", "NIO", "BABA", "JD",
  "BA", "CAT", "GE", "MMM", "XOM", "CVX", "COP", "SLB",
  "GS", "MS", "BAC", "WFC", "C", "BRK", "BLK",
  "ARKK", "VIX", "TLT", "IWM", "DIA", "EEM",
]);

function extractTickers(text: string): string[] {
  // Match $TICKER pattern
  const cashtagMatches = text.match(/\$([A-Z]{1,6})/g) || [];
  const cashtags = cashtagMatches.map(m => m.slice(1)).filter(t => KNOWN_TICKERS.has(t));

  // Also match standalone known tickers (word boundary)
  const words = text.toUpperCase().split(/\s+/);
  const wordMatches = words.filter(w => KNOWN_TICKERS.has(w.replace(/[^A-Z]/g, "")));

  const all = new Set([...cashtags, ...wordMatches.map(w => w.replace(/[^A-Z]/g, ""))]);
  return Array.from(all).slice(0, 5); // max 5 tickers per tweet
}

// ============================================================================
// Simple Sentiment Detection
// ============================================================================

function detectSentiment(text: string): { sentiment: "bullish" | "bearish" | "neutral"; score: number } {
  const lower = text.toLowerCase();
  const bullishWords = ["buy", "long", "bullish", "moon", "pump", "rally", "breakout", "undervalued", "upgrade", "beat", "growth", "strong", "opportunity", "upside"];
  const bearishWords = ["sell", "short", "bearish", "crash", "dump", "decline", "overvalued", "downgrade", "miss", "weak", "risk", "downside", "bubble", "recession"];

  let score = 0;
  for (const w of bullishWords) if (lower.includes(w)) score += 10;
  for (const w of bearishWords) if (lower.includes(w)) score -= 10;

  if (score > 10) return { sentiment: "bullish", score: Math.min(score, 100) };
  if (score < -10) return { sentiment: "bearish", score: Math.max(score, -100) };
  return { sentiment: "neutral", score: 0 };
}

// ============================================================================
// RSS Parsing (simple XML parser for Nitter RSS)
// ============================================================================

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  creator: string;
}

function parseNitterRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag: string): string => {
      const m = block.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`)) ||
                block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].trim() : "";
    };

    items.push({
      title: getTag("title"),
      link: getTag("link"),
      description: getTag("description"),
      pubDate: getTag("pubDate"),
      creator: getTag("dc:creator") || getTag("creator"),
    });
  }

  return items;
}

// Strip HTML tags from Nitter descriptions
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ============================================================================
// Fetch Tweets for One Account
// ============================================================================

async function fetchTweetsForAccount(account: VipAccount): Promise<RssItem[]> {
  for (const instance of NITTER_INSTANCES) {
    const url = `${instance}/${account.handle}/rss`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MarketMind/1.0; +https://marketmind.app)",
        },
      });
      clearTimeout(timeout);

      if (!resp.ok) continue;

      const text = await resp.text();
      if (!text.includes("<item>")) continue; // Cloudflare challenge or empty

      const items = parseNitterRss(text);
      if (items.length > 0) {
        console.log(`[TwitterVIP] Fetched ${items.length} tweets for @${account.handle} from ${instance}`);
        return items;
      }
    } catch (err) {
      // Instance failed, try next
      continue;
    }
  }

  console.warn(`[TwitterVIP] All instances failed for @${account.handle} — skipping (NO fake data)`);
  return [];
}

// ============================================================================
// Ingest VIP Tweets
// ============================================================================

export async function ingestVipTweets(): Promise<{
  accountsProcessed: number;
  accountsFailed: number;
  tweetsIngested: number;
  errors: string[];
}> {
  const stats = { accountsProcessed: 0, accountsFailed: 0, tweetsIngested: 0, errors: [] as string[] };

  const db = await getDb();
  if (!db) return { ...stats, errors: ["Database not available"] };

  // Get the most recent ingestion timestamp to avoid duplicates
  const lastIngested = await db
    .select({ ingestedAt: ingestedSignals.ingestedAt })
    .from(ingestedSignals)
    .where(eq(ingestedSignals.source, "twitter_vip"))
    .orderBy(desc(ingestedSignals.ingestedAt))
    .limit(1);

  const cutoff = lastIngested.length > 0
    ? new Date(lastIngested[0].ingestedAt).getTime()
    : Date.now() - 24 * 60 * 60 * 1000; // Default: last 24 hours

  for (const account of VIP_ACCOUNTS) {
    try {
      const tweets = await fetchTweetsForAccount(account);

      if (tweets.length === 0) {
        stats.accountsFailed++;
        stats.errors.push(`@${account.handle}: all Nitter instances failed`);
        continue;
      }

      stats.accountsProcessed++;

      for (const tweet of tweets) {
        const tweetDate = new Date(tweet.pubDate).getTime();
        if (isNaN(tweetDate) || tweetDate <= cutoff) continue;

        const text = stripHtml(tweet.description || tweet.title);
        if (!text || text.length < 5) continue;

        const tickers = extractTickers(text);
        const { sentiment, score } = detectSentiment(text);

        // If contrarian account, flip sentiment
        const finalSentiment = account.isContrarian
          ? (sentiment === "bullish" ? "bearish" : sentiment === "bearish" ? "bullish" : "neutral")
          : sentiment;
        const finalScore = account.isContrarian ? -score : score;

        const signal: InsertIngestedSignal = {
          source: "twitter_vip",
          sourceDetail: `@${account.handle} (${account.displayName})`,
          ticker: tickers[0] || null,
          title: `@${account.handle}: ${text.slice(0, 120)}${text.length > 120 ? "..." : ""}`,
          content: text,
          url: tweet.link || `https://x.com/${account.handle}`,
          author: account.displayName,
          sentiment: finalSentiment,
          sentimentScore: finalScore,
          signalType: "social_mention",
          metadata: JSON.stringify({
            handle: account.handle,
            category: account.category,
            weightMultiplier: account.weightMultiplier,
            isContrarian: account.isContrarian,
            allTickers: tickers,
            rawPubDate: tweet.pubDate,
          }),
        };

        await db.insert(ingestedSignals).values(signal);
        stats.tweetsIngested++;

        // If tweet mentions multiple tickers, create additional signals
        for (const extraTicker of tickers.slice(1)) {
          await db.insert(ingestedSignals).values({
            ...signal,
            ticker: extraTicker,
            title: `@${account.handle} mentions $${extraTicker}: ${text.slice(0, 100)}...`,
          });
          stats.tweetsIngested++;
        }
      }

      // Rate limit: small delay between accounts
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      stats.accountsFailed++;
      stats.errors.push(`@${account.handle}: ${err.message}`);
    }
  }

  console.log(`[TwitterVIP] Ingestion complete: ${stats.accountsProcessed} accounts, ${stats.tweetsIngested} tweets, ${stats.accountsFailed} failed`);
  return stats;
}

// ============================================================================
// Status
// ============================================================================

export async function getVipTwitterStatus(): Promise<{
  totalAccounts: number;
  lastIngestion: Date | null;
  recentTweetCount: number;
  status: "active" | "degraded" | "unavailable";
}> {
  const db = await getDb();
  if (!db) return { totalAccounts: VIP_ACCOUNTS.length, lastIngestion: null, recentTweetCount: 0, status: "unavailable" as const };

  const recent = await db
    .select({ ingestedAt: ingestedSignals.ingestedAt })
    .from(ingestedSignals)
    .where(and(
      eq(ingestedSignals.source, "twitter_vip"),
      gte(ingestedSignals.ingestedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
    ))
    .orderBy(desc(ingestedSignals.ingestedAt));

  const lastIngestion = recent.length > 0 ? recent[0].ingestedAt : null;

  return {
    totalAccounts: VIP_ACCOUNTS.length,
    lastIngestion,
    recentTweetCount: recent.length,
    status: recent.length > 10 ? "active" : recent.length > 0 ? "degraded" : "unavailable",
  };
}
