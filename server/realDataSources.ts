/**
 * Real Data Source Modules — SEC EDGAR, FRED, Polymarket, StockTwits,
 * CBOE VIX, Google Trends, Congressional Trading.
 *
 * Each module fetches REAL data from free public APIs. If a source
 * requires an API key that isn't configured, it returns a clear
 * "needs_api_key" status. NO simulated data is ever generated.
 */

import { getDb } from "./db";
import { ingestedSignals, type InsertIngestedSignal } from "../drizzle/schema";
import { desc, eq, and, gte } from "drizzle-orm";

// ============================================================================
// Shared Utilities
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

function extractTickers(text: string): string[] {
  const tickers = new Set<string>();
  const cashtagMatches = text.match(/\$([A-Z]{1,6})/g) || [];
  for (const m of cashtagMatches) {
    const t = m.slice(1);
    if (KNOWN_TICKERS.has(t)) tickers.add(t);
  }
  const words = text.toUpperCase().split(/[\s,;:()]+/);
  for (const w of words) {
    const clean = w.replace(/[^A-Z]/g, "");
    if (clean.length >= 2 && clean.length <= 5 && KNOWN_TICKERS.has(clean)) tickers.add(clean);
  }
  return Array.from(tickers).slice(0, 5);
}

async function safeFetch(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return resp;
  } catch {
    return null;
  }
}

export type DataSourceStatus = "active" | "degraded" | "needs_api_key" | "unavailable";

export interface DataSourceInfo {
  name: string;
  source: string;
  status: DataSourceStatus;
  lastIngestion: Date | null;
  recentSignalCount: number;
  description: string;
  apiKeyRequired: boolean;
  apiKeyName?: string;
  apiKeyUrl?: string;
}

async function getSourceStats(source: string, daysCutoff = 1): Promise<{ lastIngestion: Date | null; count: number }> {
  const db = await getDb();
  if (!db) return { lastIngestion: null, count: 0 };
  const recent = await db
    .select({ ingestedAt: ingestedSignals.ingestedAt })
    .from(ingestedSignals)
    .where(and(
      eq(ingestedSignals.source, source as any),
      gte(ingestedSignals.ingestedAt, new Date(Date.now() - daysCutoff * 24 * 60 * 60 * 1000))
    ))
    .orderBy(desc(ingestedSignals.ingestedAt));
  return {
    lastIngestion: recent.length > 0 ? recent[0].ingestedAt : null,
    count: recent.length,
  };
}

// ============================================================================
// 1. SEC EDGAR — Form 4 Insider Trading (FREE, no API key)
// ============================================================================

export async function ingestSecEdgar(): Promise<{ ingested: number; errors: string[] }> {
  const stats = { ingested: 0, errors: [] as string[] };
  const db = await getDb();
  if (!db) return { ...stats, errors: ["Database not available"] };

  try {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const url = `https://efts.sec.gov/LATEST/search-index?q=%22form+4%22&forms=4&dateRange=custom&startdt=${startDate}&enddt=${endDate}`;
    const resp = await safeFetch(url, {
      headers: { "User-Agent": "MarketMind/1.0 (contact@marketmind.app)" },
    });

    if (!resp || !resp.ok) {
      stats.errors.push(`SEC EDGAR API returned ${resp?.status || "no response"}`);
      return stats;
    }

    const data = await resp.json() as any;
    const hits = data?.hits?.hits || [];

    for (const hit of hits.slice(0, 50)) { // Process top 50 filings
      const src = hit._source;
      if (!src) continue;

      const names = src.display_names || [];
      const filerName = names[0] || "Unknown";
      const companyName = names[1] || "";

      // Try to extract ticker from company name
      const tickers = extractTickers(companyName);

      const signal: InsertIngestedSignal = {
        source: "sec_edgar",
        sourceDetail: "Form 4 Insider Trading",
        ticker: tickers[0] || null,
        title: `Insider Filing: ${filerName} at ${companyName}`,
        content: `SEC Form 4 filed by ${filerName} for ${companyName}. Filed: ${src.file_date}. ADSH: ${src.adsh}`,
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${src.adsh?.split("-")[0] || ""}&type=4`,
        author: filerName,
        sentiment: "neutral",
        sentimentScore: 0,
        signalType: "insider_trade",
        metadata: JSON.stringify({
          adsh: src.adsh,
          fileDate: src.file_date,
          form: src.form,
          displayNames: names,
          sics: src.sics,
          bizLocations: src.biz_locations,
          allTickers: tickers,
        }),
      };

      await db.insert(ingestedSignals).values(signal);
      stats.ingested++;
    }

    console.log(`[SEC EDGAR] Ingested ${stats.ingested} insider filings`);
  } catch (err: any) {
    stats.errors.push(`SEC EDGAR: ${err.message}`);
  }

  return stats;
}

export async function getSecEdgarStatus(): Promise<DataSourceInfo> {
  const { lastIngestion, count } = await getSourceStats("sec_edgar", 2);
  return {
    name: "SEC EDGAR (Insider Trading)",
    source: "sec_edgar",
    status: count > 0 ? "active" : "unavailable",
    lastIngestion,
    recentSignalCount: count,
    description: "Form 4 insider trading filings from SEC EDGAR EFTS API. Free, no API key.",
    apiKeyRequired: false,
  };
}

// ============================================================================
// 2. FRED — Macro Economic Data (FREE with API key)
// ============================================================================

const FRED_SERIES = [
  { id: "T10Y2Y", name: "10Y-2Y Yield Curve Spread", description: "Treasury yield curve spread. Negative = recession signal." },
  { id: "CPIAUCSL", name: "CPI (All Urban Consumers)", description: "Consumer Price Index. Key inflation measure." },
  { id: "UNRATE", name: "Unemployment Rate", description: "U.S. unemployment rate." },
  { id: "FEDFUNDS", name: "Federal Funds Rate", description: "Fed Funds effective rate." },
  { id: "VIXCLS", name: "VIX Close", description: "CBOE Volatility Index daily close." },
];

export async function ingestFred(): Promise<{ ingested: number; errors: string[] }> {
  const stats = { ingested: 0, errors: [] as string[] };
  const db = await getDb();
  if (!db) return { ...stats, errors: ["Database not available"] };

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    stats.errors.push("FRED_API_KEY not configured. Register free at https://fred.stlouisfed.org/docs/api/api_key.html");
    return stats;
  }

  for (const series of FRED_SERIES) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${apiKey}&file_type=json&limit=5&sort_order=desc`;
      const resp = await safeFetch(url);
      if (!resp || !resp.ok) {
        stats.errors.push(`FRED ${series.id}: HTTP ${resp?.status || "timeout"}`);
        continue;
      }

      const data = await resp.json() as any;
      const observations = data?.observations || [];

      for (const obs of observations) {
        if (obs.value === ".") continue; // Missing data point

        const signal: InsertIngestedSignal = {
          source: "fred_macro",
          sourceDetail: series.name,
          ticker: null,
          title: `${series.name}: ${obs.value} (${obs.date})`,
          content: `${series.description} Value: ${obs.value} as of ${obs.date}.`,
          url: `https://fred.stlouisfed.org/series/${series.id}`,
          author: "Federal Reserve Economic Data",
          sentiment: "neutral",
          sentimentScore: 0,
          signalType: "macro_indicator",
          metadata: JSON.stringify({
            seriesId: series.id,
            value: parseFloat(obs.value),
            date: obs.date,
            realtimeStart: obs.realtime_start,
            realtimeEnd: obs.realtime_end,
          }),
        };

        await db.insert(ingestedSignals).values(signal);
        stats.ingested++;
      }
    } catch (err: any) {
      stats.errors.push(`FRED ${series.id}: ${err.message}`);
    }
  }

  console.log(`[FRED] Ingested ${stats.ingested} macro data points`);
  return stats;
}

export async function getFredStatus(): Promise<DataSourceInfo> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return {
      name: "FRED (Macro Data)",
      source: "fred_macro",
      status: "needs_api_key",
      lastIngestion: null,
      recentSignalCount: 0,
      description: "Federal Reserve Economic Data — yield curve, CPI, unemployment, Fed Funds rate.",
      apiKeyRequired: true,
      apiKeyName: "FRED_API_KEY",
      apiKeyUrl: "https://fred.stlouisfed.org/docs/api/api_key.html",
    };
  }
  const { lastIngestion, count } = await getSourceStats("fred_macro", 7);
  return {
    name: "FRED (Macro Data)",
    source: "fred_macro",
    status: count > 0 ? "active" : "unavailable",
    lastIngestion,
    recentSignalCount: count,
    description: "Federal Reserve Economic Data — yield curve, CPI, unemployment, Fed Funds rate.",
    apiKeyRequired: true,
    apiKeyName: "FRED_API_KEY",
    apiKeyUrl: "https://fred.stlouisfed.org/docs/api/api_key.html",
  };
}

// ============================================================================
// 3. Polymarket — Prediction Markets (FREE, no API key)
// ============================================================================

export async function ingestPolymarket(): Promise<{ ingested: number; errors: string[] }> {
  const stats = { ingested: 0, errors: [] as string[] };
  const db = await getDb();
  if (!db) return { ...stats, errors: ["Database not available"] };

  try {
    const resp = await safeFetch("https://gamma-api.polymarket.com/markets?limit=30&active=true&closed=false&order=volume24hr&ascending=false");
    if (!resp || !resp.ok) {
      stats.errors.push(`Polymarket API: HTTP ${resp?.status || "timeout"}`);
      return stats;
    }

    const markets = await resp.json() as any[];

    for (const market of markets) {
      const tickers = extractTickers(market.question + " " + (market.description || ""));

      const signal: InsertIngestedSignal = {
        source: "polymarket",
        sourceDetail: market.slug || "polymarket",
        ticker: tickers[0] || null,
        title: market.question,
        content: (market.description || "").slice(0, 2000),
        url: `https://polymarket.com/event/${market.slug}`,
        author: "Polymarket",
        sentiment: "neutral",
        sentimentScore: 0,
        signalType: "prediction_market",
        metadata: JSON.stringify({
          outcomePrices: market.outcomePrices,
          outcomes: market.outcomes,
          volume: market.volume,
          volume24hr: market.volume24hr,
          liquidity: market.liquidity,
          endDate: market.endDate,
        }),
      };

      await db.insert(ingestedSignals).values(signal);
      stats.ingested++;
    }

    console.log(`[Polymarket] Ingested ${stats.ingested} prediction markets`);
  } catch (err: any) {
    stats.errors.push(`Polymarket: ${err.message}`);
  }

  return stats;
}

export async function getPolymarketStatus(): Promise<DataSourceInfo> {
  const { lastIngestion, count } = await getSourceStats("polymarket", 1);
  return {
    name: "Polymarket (Prediction Markets)",
    source: "polymarket",
    status: count > 0 ? "active" : "unavailable",
    lastIngestion,
    recentSignalCount: count,
    description: "Real prediction market data from Polymarket Gamma API. Free, no API key.",
    apiKeyRequired: false,
  };
}

// ============================================================================
// 4. StockTwits — Social Sentiment (FREE, no API key)
// ============================================================================

const STOCKTWITS_TICKERS = ["AAPL", "MSFT", "NVDA", "TSLA", "AMD", "META", "AMZN", "GOOGL", "SPY", "QQQ"];

export async function ingestStockTwits(): Promise<{ ingested: number; errors: string[] }> {
  const stats = { ingested: 0, errors: [] as string[] };
  const db = await getDb();
  if (!db) return { ...stats, errors: ["Database not available"] };

  for (const ticker of STOCKTWITS_TICKERS) {
    try {
      const resp = await safeFetch(`https://api.stocktwits.com/api/2/streams/symbol/${ticker}.json`);
      if (!resp || !resp.ok) {
        stats.errors.push(`StockTwits ${ticker}: HTTP ${resp?.status || "timeout"}`);
        continue;
      }

      const data = await resp.json() as any;
      const messages = data?.messages || [];

      // Take top 5 most recent messages per ticker
      for (const msg of messages.slice(0, 5)) {
        const sentimentLabel = msg.entities?.sentiment?.basic;
        const sentiment = sentimentLabel === "Bullish" ? "bullish" : sentimentLabel === "Bearish" ? "bearish" : "neutral";

        const signal: InsertIngestedSignal = {
          source: "stocktwits",
          sourceDetail: `StockTwits $${ticker}`,
          ticker,
          title: `$${ticker}: ${(msg.body || "").slice(0, 120)}`,
          content: msg.body || "",
          url: `https://stocktwits.com/message/${msg.id}`,
          author: msg.user?.username || "unknown",
          sentiment,
          sentimentScore: sentiment === "bullish" ? 50 : sentiment === "bearish" ? -50 : 0,
          signalType: "social_mention",
          metadata: JSON.stringify({
            messageId: msg.id,
            username: msg.user?.username,
            followers: msg.user?.followers,
            likes: msg.likes?.total || 0,
            createdAt: msg.created_at,
          }),
        };

        await db.insert(ingestedSignals).values(signal);
        stats.ingested++;
      }

      // Rate limit: StockTwits has 200 req/hr limit
      await new Promise(r => setTimeout(r, 1000));
    } catch (err: any) {
      stats.errors.push(`StockTwits ${ticker}: ${err.message}`);
    }
  }

  console.log(`[StockTwits] Ingested ${stats.ingested} social signals`);
  return stats;
}

export async function getStockTwitsStatus(): Promise<DataSourceInfo> {
  const { lastIngestion, count } = await getSourceStats("stocktwits", 1);
  return {
    name: "StockTwits (Social Sentiment)",
    source: "stocktwits",
    status: count > 0 ? "active" : "unavailable",
    lastIngestion,
    recentSignalCount: count,
    description: "Real social sentiment from StockTwits API. Free, no API key. 200 req/hr limit.",
    apiKeyRequired: false,
  };
}

// ============================================================================
// 5. CBOE VIX — Volatility Index (FREE, no API key)
// ============================================================================

export async function ingestCboeVix(): Promise<{ ingested: number; errors: string[] }> {
  const stats = { ingested: 0, errors: [] as string[] };
  const db = await getDb();
  if (!db) return { ...stats, errors: ["Database not available"] };

  try {
    const resp = await safeFetch("https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv");
    if (!resp || !resp.ok) {
      stats.errors.push(`CBOE VIX: HTTP ${resp?.status || "timeout"}`);
      return stats;
    }

    const csv = await resp.text();
    const lines = csv.trim().split("\n");

    // Take last 5 trading days
    for (const line of lines.slice(-5)) {
      const [date, open, high, low, close] = line.split(",");
      if (!date || !close) continue;

      const vixClose = parseFloat(close);
      let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
      let score = 0;

      if (vixClose > 30) { sentiment = "bearish"; score = -70; }
      else if (vixClose > 25) { sentiment = "bearish"; score = -40; }
      else if (vixClose < 15) { sentiment = "bullish"; score = 50; }
      else if (vixClose < 20) { sentiment = "bullish"; score = 20; }

      const signal: InsertIngestedSignal = {
        source: "cboe_vix",
        sourceDetail: "VIX Daily Close",
        ticker: "VIX",
        title: `VIX: ${vixClose.toFixed(2)} (${date})`,
        content: `CBOE Volatility Index closed at ${vixClose.toFixed(2)} on ${date}. Open: ${open}, High: ${high}, Low: ${low}.${vixClose > 30 ? " ELEVATED FEAR." : vixClose > 25 ? " Above average volatility." : vixClose < 15 ? " Very low volatility — complacency signal." : ""}`,
        url: "https://www.cboe.com/tradable_products/vix/",
        author: "CBOE",
        sentiment,
        sentimentScore: score,
        signalType: "volatility",
        metadata: JSON.stringify({ date, open: parseFloat(open), high: parseFloat(high), low: parseFloat(low), close: vixClose }),
      };

      await db.insert(ingestedSignals).values(signal);
      stats.ingested++;
    }

    console.log(`[CBOE VIX] Ingested ${stats.ingested} VIX data points`);
  } catch (err: any) {
    stats.errors.push(`CBOE VIX: ${err.message}`);
  }

  return stats;
}

export async function getCboeVixStatus(): Promise<DataSourceInfo> {
  const { lastIngestion, count } = await getSourceStats("cboe_vix", 7);
  return {
    name: "CBOE VIX (Volatility Index)",
    source: "cboe_vix",
    status: count > 0 ? "active" : "unavailable",
    lastIngestion,
    recentSignalCount: count,
    description: "Real daily VIX data from CBOE public CSV endpoint. Free, no API key.",
    apiKeyRequired: false,
  };
}

// ============================================================================
// 6. Google Trends — Trending Searches (FREE, no API key)
// ============================================================================

export async function ingestGoogleTrends(): Promise<{ ingested: number; errors: string[] }> {
  const stats = { ingested: 0, errors: [] as string[] };
  const db = await getDb();
  if (!db) return { ...stats, errors: ["Database not available"] };

  try {
    const resp = await safeFetch("https://trends.google.com/trending/rss?geo=US");
    if (!resp || !resp.ok) {
      stats.errors.push(`Google Trends: HTTP ${resp?.status || "timeout"}`);
      return stats;
    }

    const xml = await resp.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const getTag = (tag: string): string => {
        const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].trim() : "";
      };

      const title = getTag("title");
      const traffic = getTag("ht:approx_traffic");
      const pubDate = getTag("pubDate");
      const newsTitle = getTag("ht:news_item_title");
      const newsUrl = getTag("ht:news_item_url");

      const tickers = extractTickers(title + " " + newsTitle);

      // Only ingest finance-related trends
      const financeKeywords = ["stock", "market", "fed", "rate", "inflation", "earnings", "ipo", "crypto", "bitcoin", "recession", "tariff", "trade"];
      const isFinanceRelated = tickers.length > 0 || financeKeywords.some(kw => (title + " " + newsTitle).toLowerCase().includes(kw));

      if (!isFinanceRelated) continue;

      const signal: InsertIngestedSignal = {
        source: "google_trends",
        sourceDetail: "US Daily Trending",
        ticker: tickers[0] || null,
        title: `Trending: ${title} (${traffic})`,
        content: newsTitle || title,
        url: newsUrl || "https://trends.google.com/trending",
        author: "Google Trends",
        sentiment: "neutral",
        sentimentScore: 0,
        signalType: "trend_signal",
        metadata: JSON.stringify({
          searchTerm: title,
          approxTraffic: traffic,
          pubDate,
          allTickers: tickers,
        }),
      };

      await db.insert(ingestedSignals).values(signal);
      stats.ingested++;
    }

    console.log(`[Google Trends] Ingested ${stats.ingested} trending signals`);
  } catch (err: any) {
    stats.errors.push(`Google Trends: ${err.message}`);
  }

  return stats;
}

export async function getGoogleTrendsStatus(): Promise<DataSourceInfo> {
  const { lastIngestion, count } = await getSourceStats("google_trends", 1);
  return {
    name: "Google Trends (Trending Searches)",
    source: "google_trends",
    status: count > 0 ? "active" : "unavailable",
    lastIngestion,
    recentSignalCount: count,
    description: "Real US daily trending searches from Google Trends RSS. Free, no API key.",
    apiKeyRequired: false,
  };
}

// ============================================================================
// 7. Congressional Trading (Capitol Trades scraping)
// ============================================================================

export async function ingestCongressionalTrading(): Promise<{ ingested: number; errors: string[] }> {
  const stats = { ingested: 0, errors: [] as string[] };
  const db = await getDb();
  if (!db) return { ...stats, errors: ["Database not available"] };

  try {
    // Capitol Trades is a web app — we'll try their public API endpoint
    const resp = await safeFetch("https://www.capitoltrades.com/trades?pageSize=20", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketMind/1.0)",
        "Accept": "application/json",
      },
    });

    if (!resp || !resp.ok) {
      // Fallback: try to get data from SEC EDGAR for congressional disclosures
      // Congress members file periodic transaction reports
      const edgarResp = await safeFetch(
        "https://efts.sec.gov/LATEST/search-index?q=%22periodic+transaction+report%22&dateRange=custom&startdt=" +
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] +
        "&enddt=" + new Date().toISOString().split("T")[0],
        { headers: { "User-Agent": "MarketMind/1.0 (contact@marketmind.app)" } }
      );

      if (edgarResp && edgarResp.ok) {
        const data = await edgarResp.json() as any;
        const hits = data?.hits?.hits || [];

        for (const hit of hits.slice(0, 20)) {
          const src = hit._source;
          if (!src) continue;

          const signal: InsertIngestedSignal = {
            source: "congressional",
            sourceDetail: "SEC Periodic Transaction Report",
            ticker: null,
            title: `Congressional Disclosure: ${(src.display_names || []).join(", ")}`,
            content: `Periodic transaction report filed ${src.file_date}. Filers: ${(src.display_names || []).join(", ")}`,
            url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${src.adsh?.split("-")[0] || ""}`,
            author: (src.display_names || [])[0] || "Unknown",
            sentiment: "neutral",
            sentimentScore: 0,
            signalType: "congressional_trade",
            metadata: JSON.stringify({
              adsh: src.adsh,
              fileDate: src.file_date,
              displayNames: src.display_names,
            }),
          };

          await db.insert(ingestedSignals).values(signal);
          stats.ingested++;
        }
      } else {
        stats.errors.push("Congressional trading: Capitol Trades and SEC EDGAR fallback both failed");
      }
    } else {
      // Parse Capitol Trades HTML response for trade data
      const html = await resp.text();
      // Capitol Trades returns HTML, not JSON — extract what we can
      stats.errors.push("Congressional trading: Capitol Trades returned HTML (scraping not implemented yet)");
    }

    console.log(`[Congressional] Ingested ${stats.ingested} congressional trading signals`);
  } catch (err: any) {
    stats.errors.push(`Congressional: ${err.message}`);
  }

  return stats;
}

export async function getCongressionalStatus(): Promise<DataSourceInfo> {
  const { lastIngestion, count } = await getSourceStats("congressional", 7);
  return {
    name: "Congressional Trading",
    source: "congressional",
    status: count > 0 ? "active" : "unavailable",
    lastIngestion,
    recentSignalCount: count,
    description: "Congressional stock trading disclosures via SEC EDGAR periodic transaction reports. Free.",
    apiKeyRequired: false,
  };
}

// ============================================================================
// Master Ingestion Orchestrator
// ============================================================================

export async function ingestAllSources(): Promise<Record<string, { ingested: number; errors: string[] }>> {
  const results: Record<string, { ingested: number; errors: string[] }> = {};

  console.log("[DataSources] Starting full ingestion cycle...");

  results.sec_edgar = await ingestSecEdgar();
  results.fred_macro = await ingestFred();
  results.polymarket = await ingestPolymarket();
  results.stocktwits = await ingestStockTwits();
  results.cboe_vix = await ingestCboeVix();
  results.google_trends = await ingestGoogleTrends();
  results.congressional = await ingestCongressionalTrading();

  const totalIngested = Object.values(results).reduce((sum, r) => sum + r.ingested, 0);
  const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);
  console.log(`[DataSources] Cycle complete: ${totalIngested} signals ingested, ${totalErrors} errors`);

  return results;
}

// ============================================================================
// All Source Statuses
// ============================================================================

export async function getAllDataSourceStatuses(): Promise<DataSourceInfo[]> {
  return Promise.all([
    getSecEdgarStatus(),
    getFredStatus(),
    getPolymarketStatus(),
    getStockTwitsStatus(),
    getCboeVixStatus(),
    getGoogleTrendsStatus(),
    getCongressionalStatus(),
  ]);
}
