/**
 * Real Podcast Ingestion via YouTube RSS Feeds.
 *
 * Fetches real episode data from high-signal finance podcasts using
 * free YouTube channel RSS feeds. Extracts episode titles, descriptions,
 * publish dates, and any ticker mentions.
 *
 * Stores results as ingested_signals with source='podcast_youtube'.
 * NO simulated data — if a feed fails, it's skipped.
 */

import { getDb } from "./db";
import { ingestedSignals, type InsertIngestedSignal } from "../drizzle/schema";
import { desc, eq, and, gte } from "drizzle-orm";

// ============================================================================
// Podcast Channel Registry
// ============================================================================

export interface PodcastChannel {
  name: string;
  channelId: string;
  category: "macro" | "investing" | "tech" | "general_finance";
  signalWeight: number;
  description: string;
}

export const PODCAST_CHANNELS: PodcastChannel[] = [
  {
    name: "All-In Podcast",
    channelId: "UCESLZhusAkFfsNsApnjF_Cg",
    category: "macro",
    signalWeight: 5,
    description: "Chamath, Jason Calacanis, David Sacks, David Friedberg. Tech, politics, macro.",
  },
  {
    name: "Odd Lots (Bloomberg)",
    channelId: "UCIALMKvObZNtJ6AmdCLP7Lg",
    category: "macro",
    signalWeight: 4,
    description: "Bloomberg's economics and finance podcast. Macro trends and market structure.",
  },
  {
    name: "The Prof G Pod (Scott Galloway)",
    channelId: "UCBcRF18a7Qf58cCRy5xuWwQ",
    category: "general_finance",
    signalWeight: 3,
    description: "Scott Galloway on business, tech, and markets.",
  },
  {
    name: "Patrick Boyle on Finance",
    channelId: "UCASM0cgfkJxQ1ICmRilfHLQ",
    category: "investing",
    signalWeight: 4,
    description: "Hedge fund manager covering markets, quant finance, and current events.",
  },
  {
    name: "The Plain Bagel",
    channelId: "UCFCEuCsyWP0YkP3CZ3Mr01Q",
    category: "investing",
    signalWeight: 3,
    description: "Finance education and market analysis.",
  },
  {
    name: "Graham Stephan",
    channelId: "UCa-ckhlKL98F8YXKQ-BALiw",
    category: "general_finance",
    signalWeight: 2,
    description: "Personal finance and real estate investing.",
  },
];

// ============================================================================
// Known Tickers for Extraction
// ============================================================================

const KNOWN_TICKERS = new Set([
  "AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "AMD",
  "SPY", "QQQ", "XLE", "XLK", "XLF", "GLD", "JPM", "V", "UNH", "NFLX",
  "CRM", "ORCL", "AVGO", "COST", "PEP", "KO", "MRK", "LLY", "ABBV",
  "WMT", "DIS", "INTC", "CSCO", "ADBE", "TXN", "QCOM", "PYPL", "SQ",
  "COIN", "PLTR", "SOFI", "RIVN", "LCID", "NIO", "BABA", "JD",
  "BA", "CAT", "GE", "MMM", "XOM", "CVX", "COP", "SLB",
  "GS", "MS", "BAC", "WFC", "C", "BRK", "BLK",
]);

// Company name → ticker mapping for description matching
const COMPANY_TICKERS: Record<string, string> = {
  "apple": "AAPL", "microsoft": "MSFT", "nvidia": "NVDA", "google": "GOOGL",
  "alphabet": "GOOGL", "amazon": "AMZN", "meta": "META", "facebook": "META",
  "tesla": "TSLA", "netflix": "NFLX", "salesforce": "CRM", "oracle": "ORCL",
  "broadcom": "AVGO", "costco": "COST", "walmart": "WMT", "disney": "DIS",
  "intel": "INTC", "cisco": "CSCO", "adobe": "ADBE", "paypal": "PYPL",
  "coinbase": "COIN", "palantir": "PLTR", "sofi": "SOFI", "rivian": "RIVN",
  "boeing": "BA", "caterpillar": "CAT", "exxon": "XOM", "chevron": "CVX",
  "goldman sachs": "GS", "morgan stanley": "MS", "jpmorgan": "JPM",
  "berkshire": "BRK", "blackrock": "BLK",
};

function extractTickers(text: string): string[] {
  const tickers = new Set<string>();

  // $TICKER pattern
  const cashtagMatches = text.match(/\$([A-Z]{1,6})/g) || [];
  for (const m of cashtagMatches) {
    const t = m.slice(1);
    if (KNOWN_TICKERS.has(t)) tickers.add(t);
  }

  // Company name matching
  const lower = text.toLowerCase();
  for (const [company, ticker] of Object.entries(COMPANY_TICKERS)) {
    if (lower.includes(company)) tickers.add(ticker);
  }

  return Array.from(tickers).slice(0, 5);
}

// ============================================================================
// YouTube RSS Parsing
// ============================================================================

interface YtEntry {
  videoId: string;
  title: string;
  published: string;
  updated: string;
  description: string;
  channelName: string;
}

function parseYouTubeRss(xml: string): YtEntry[] {
  const entries: YtEntry[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag: string): string => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].trim() : "";
    };

    entries.push({
      videoId: getTag("yt:videoId"),
      title: getTag("title"),
      published: getTag("published"),
      updated: getTag("updated"),
      description: getTag("media:description"),
      channelName: getTag("name"),
    });
  }

  return entries;
}

// ============================================================================
// Fetch Episodes for One Channel
// ============================================================================

async function fetchEpisodes(channel: PodcastChannel): Promise<YtEntry[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "MarketMind/1.0" },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.warn(`[Podcast] HTTP ${resp.status} for ${channel.name}`);
      return [];
    }

    const xml = await resp.text();
    const entries = parseYouTubeRss(xml);
    console.log(`[Podcast] Fetched ${entries.length} episodes for ${channel.name}`);
    return entries;
  } catch (err: any) {
    console.warn(`[Podcast] Failed to fetch ${channel.name}: ${err.message}`);
    return [];
  }
}

// ============================================================================
// Ingest Podcast Episodes
// ============================================================================

export async function ingestPodcasts(): Promise<{
  channelsProcessed: number;
  channelsFailed: number;
  episodesIngested: number;
  errors: string[];
}> {
  const stats = { channelsProcessed: 0, channelsFailed: 0, episodesIngested: 0, errors: [] as string[] };

  const db = await getDb();
  if (!db) return { ...stats, errors: ["Database not available"] };

  // Get the most recent ingestion timestamp
  const lastIngested = await db
    .select({ ingestedAt: ingestedSignals.ingestedAt })
    .from(ingestedSignals)
    .where(eq(ingestedSignals.source, "podcast_youtube"))
    .orderBy(desc(ingestedSignals.ingestedAt))
    .limit(1);

  const cutoff = lastIngested.length > 0
    ? new Date(lastIngested[0].ingestedAt).getTime()
    : Date.now() - 7 * 24 * 60 * 60 * 1000; // Default: last 7 days

  for (const channel of PODCAST_CHANNELS) {
    try {
      const episodes = await fetchEpisodes(channel);

      if (episodes.length === 0) {
        stats.channelsFailed++;
        stats.errors.push(`${channel.name}: fetch failed`);
        continue;
      }

      stats.channelsProcessed++;

      for (const ep of episodes) {
        const epDate = new Date(ep.published).getTime();
        if (isNaN(epDate) || epDate <= cutoff) continue;

        const fullText = `${ep.title}\n\n${ep.description}`;
        const tickers = extractTickers(fullText);

        const signal: InsertIngestedSignal = {
          source: "podcast_youtube",
          sourceDetail: channel.name,
          ticker: tickers[0] || null,
          title: ep.title,
          content: ep.description.slice(0, 2000),
          url: `https://www.youtube.com/watch?v=${ep.videoId}`,
          author: channel.name,
          sentiment: "neutral",
          sentimentScore: 0,
          signalType: "podcast_episode",
          metadata: JSON.stringify({
            channelId: channel.channelId,
            videoId: ep.videoId,
            category: channel.category,
            signalWeight: channel.signalWeight,
            allTickers: tickers,
            published: ep.published,
          }),
        };

        await db.insert(ingestedSignals).values(signal);
        stats.episodesIngested++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    } catch (err: any) {
      stats.channelsFailed++;
      stats.errors.push(`${channel.name}: ${err.message}`);
    }
  }

  console.log(`[Podcast] Ingestion complete: ${stats.channelsProcessed} channels, ${stats.episodesIngested} episodes, ${stats.channelsFailed} failed`);
  return stats;
}

// ============================================================================
// Status
// ============================================================================

export async function getPodcastStatus(): Promise<{
  totalChannels: number;
  lastIngestion: Date | null;
  recentEpisodeCount: number;
  status: "active" | "degraded" | "unavailable";
}> {
  const db = await getDb();
  if (!db) return { totalChannels: PODCAST_CHANNELS.length, lastIngestion: null, recentEpisodeCount: 0, status: "unavailable" };

  const recent = await db
    .select({ ingestedAt: ingestedSignals.ingestedAt })
    .from(ingestedSignals)
    .where(and(
      eq(ingestedSignals.source, "podcast_youtube"),
      gte(ingestedSignals.ingestedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    ))
    .orderBy(desc(ingestedSignals.ingestedAt));

  return {
    totalChannels: PODCAST_CHANNELS.length,
    lastIngestion: recent.length > 0 ? recent[0].ingestedAt : null,
    recentEpisodeCount: recent.length,
    status: recent.length > 5 ? "active" : recent.length > 0 ? "degraded" : "unavailable",
  };
}
