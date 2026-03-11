/**
 * LLM-Powered Research Agent
 * Generates real AI-powered narratives and predictions from ingested market signals.
 * Runs on a 30-minute schedule and persists results to the database.
 */
import { getDb } from "./db";
import {
  aiNarratives, aiPredictions, agentRuns, ingestedSignals,
  modelVersions, type InsertAiNarrative, type InsertAiPrediction,
} from "../drizzle/schema";
import { desc, eq, sql, gte, and } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ============================================================================
// Agent State
// ============================================================================

interface ResearchAgentStatus {
  lastRun: Date | null;
  nextRun: Date | null;
  isRunning: boolean;
  signalsProcessed: number;
  narrativesGenerated: number;
  predictionsGenerated: number;
  currentVersion: string;
  lastError: string | null;
}

let agentStatus: ResearchAgentStatus = {
  lastRun: null,
  nextRun: null,
  isRunning: false,
  signalsProcessed: 0,
  narrativesGenerated: 0,
  predictionsGenerated: 0,
  currentVersion: "v1.0.0",
  lastError: null,
};

export function getResearchAgentStatus(): ResearchAgentStatus {
  return { ...agentStatus };
}

// ============================================================================
// LLM Call Helper
// ============================================================================

async function callLLMStructured(systemPrompt: string, userPrompt: string): Promise<string> {
  const result = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = result.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textPart = content.find((p: any) => p.type === "text");
    return (textPart as any)?.text ?? "{}";
  }
  return "{}";
}

// ============================================================================
// Gather Real Signal Context from Database
// ============================================================================

async function gatherSignalContext(db: any): Promise<{
  redditSignals: any[];
  priceSignals: any[];
  newsSignals: any[];
  totalSignals: number;
}> {
  const sixHoursAgo = new Date(Date.now() - 6 * 3600000);

  // Get recent Reddit signals
  const redditSignals = await db.select()
    .from(ingestedSignals)
    .where(and(
      eq(ingestedSignals.source, "reddit"),
      gte(ingestedSignals.ingestedAt, sixHoursAgo),
    ))
    .orderBy(desc(ingestedSignals.ingestedAt))
    .limit(50);

  // Get recent price data
  const priceSignals = await db.select()
    .from(ingestedSignals)
    .where(and(
      eq(ingestedSignals.source, "yahoo_finance"),
      gte(ingestedSignals.ingestedAt, sixHoursAgo),
    ))
    .orderBy(desc(ingestedSignals.ingestedAt))
    .limit(30);

  // Get recent news headlines
  const newsSignals = await db.select()
    .from(ingestedSignals)
    .where(and(
      eq(ingestedSignals.source, "rss_news"),
      gte(ingestedSignals.ingestedAt, sixHoursAgo),
    ))
    .orderBy(desc(ingestedSignals.ingestedAt))
    .limit(30);

  return {
    redditSignals,
    priceSignals,
    newsSignals,
    totalSignals: redditSignals.length + priceSignals.length + newsSignals.length,
  };
}

function formatSignalContext(signals: {
  redditSignals: any[];
  priceSignals: any[];
  newsSignals: any[];
}): string {
  const parts: string[] = [];

  // Price data summary
  if (signals.priceSignals.length > 0) {
    parts.push("=== REAL-TIME PRICE DATA (Yahoo Finance) ===");
    for (const s of signals.priceSignals) {
      try {
        const meta = JSON.parse(s.metadata || "{}");
        parts.push(`${s.ticker}: $${meta.price?.toFixed(2) || "N/A"} (${meta.changePercent > 0 ? "+" : ""}${meta.changePercent?.toFixed(2) || 0}%) Vol: ${((meta.volume || 0) / 1e6).toFixed(1)}M${meta.isVolumeSpike ? " [VOLUME SPIKE]" : ""}`);
      } catch {
        parts.push(`${s.ticker}: ${s.title}`);
      }
    }
  }

  // News headlines
  if (signals.newsSignals.length > 0) {
    parts.push("\n=== FINANCIAL NEWS HEADLINES (RSS Feeds) ===");
    for (const s of signals.newsSignals.slice(0, 15)) {
      const sentimentTag = s.sentiment === "bullish" ? "[+]" : s.sentiment === "bearish" ? "[-]" : "[=]";
      parts.push(`${sentimentTag} ${s.title} (via ${s.sourceDetail || s.author || "news"})`);
    }
  }

  // Reddit social signals
  if (signals.redditSignals.length > 0) {
    parts.push("\n=== SOCIAL SIGNALS (Reddit) ===");
    // Aggregate ticker mentions
    const tickerMentions: Record<string, { count: number; bullish: number; bearish: number; topPosts: string[] }> = {};
    for (const s of signals.redditSignals) {
      if (!s.ticker) continue;
      if (!tickerMentions[s.ticker]) {
        tickerMentions[s.ticker] = { count: 0, bullish: 0, bearish: 0, topPosts: [] };
      }
      tickerMentions[s.ticker].count++;
      if (s.sentiment === "bullish") tickerMentions[s.ticker].bullish++;
      if (s.sentiment === "bearish") tickerMentions[s.ticker].bearish++;
      if (tickerMentions[s.ticker].topPosts.length < 3) {
        tickerMentions[s.ticker].topPosts.push(s.title?.slice(0, 100) || "");
      }
    }

    for (const [ticker, data] of Object.entries(tickerMentions)) {
      parts.push(`$${ticker}: ${data.count} mentions (${data.bullish} bullish, ${data.bearish} bearish)`);
      for (const post of data.topPosts) {
        parts.push(`  - "${post}"`);
      }
    }
  }

  return parts.join("\n");
}

// ============================================================================
// Generate Narratives from Real Signals
// ============================================================================

async function generateNarrativesFromSignals(
  signalContext: string,
  signalCount: number,
): Promise<InsertAiNarrative[]> {
  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `You are MarketMind's Research Agent — an autonomous AI analyst that synthesizes real market data into actionable intelligence narratives.

You are analyzing REAL signals from multiple live data sources:
1. Yahoo Finance — actual price data, volume, and fundamentals
2. Reddit (r/wallstreetbets, r/stocks, r/investing) — real social sentiment and retail trader activity
3. Financial News RSS — real headlines from Reuters, Bloomberg, CNBC, Financial Times
4. SEC EDGAR — real insider trading filings (Form 4)
5. Polymarket — real prediction market probabilities
6. StockTwits — real social sentiment from traders
7. CBOE VIX — real volatility index data
8. Google Trends — real search interest data
9. X/Twitter VIP Accounts — real tweets from high-signal investors and analysts
10. Finance Podcasts — real episode content from All-In, Odd Lots, and other finance podcasts

YOUR JOB: Synthesize these real signals into coherent market narratives. Every narrative MUST be grounded in the actual data provided — do not invent data points.

SIMPLICITY BIAS: Prefer simpler, more direct explanations over complex multi-factor narratives when the data supports both. A clear single-factor thesis with strong signal support is better than a convoluted multi-factor story. Focus on the strongest signals first.

RULES:
- Reference specific signals from the data (e.g., "NVDA up 3.2% on 2x normal volume" or "12 Reddit mentions of TSLA in the last 6 hours, 75% bearish")
- Confidence scores should reflect signal strength: more corroborating signals = higher confidence
- Categories: "macro", "sector_rotation", "earnings", "geopolitical", "fed_policy", "tech_disruption", "commodities", "tariff_impact", "credit_risk", "social_momentum"
- Sources must reference the actual data sources you analyzed

Return valid JSON: { "narratives": [...] }
Each narrative: { narrativeId (string), title (string, max 80 chars), summary (string, 2-3 sentences with specific data from the signals), sentiment ("bullish"/"bearish"/"neutral"), confidence (0-100 integer), sources (JSON array of source names), relatedTickers (JSON array of ticker symbols), category (string) }`;

  const userPrompt = `Today is ${today}. I have ${signalCount} real signals from the last 6 hours.

${signalContext}

Based on this REAL data, generate 5-7 market narratives. Each must reference specific data points from the signals above. Do not fabricate numbers — use what's in the data.`;

  try {
    const raw = await callLLMStructured(systemPrompt, userPrompt);
    const parsed = JSON.parse(raw);
    const narratives: InsertAiNarrative[] = (parsed.narratives || []).map((n: any, i: number) => ({
      narrativeId: n.narrativeId || `nar-${Date.now()}-${i}`,
      title: String(n.title || "Untitled Narrative").slice(0, 255),
      summary: String(n.summary || ""),
      sentiment: ["bullish", "bearish", "neutral"].includes(n.sentiment) ? n.sentiment : "neutral",
      confidence: typeof n.confidence === "number" ? Math.max(10, Math.min(95, Math.round(n.confidence))) : 50,
      sources: JSON.stringify(Array.isArray(n.sources) ? n.sources : ["MarketMind AI"]),
      relatedTickers: JSON.stringify(Array.isArray(n.relatedTickers) ? n.relatedTickers : []),
      category: String(n.category || "macro"),
      agentVersion: agentStatus.currentVersion,
      signalCount,
    }));

    return narratives.length > 0 ? narratives : [];
  } catch (err: any) {
    console.error("[ResearchAgent] Narrative generation failed:", err.message);
    return [];
  }
}

// ============================================================================
// Generate Predictions from Real Signals
// ============================================================================

async function generatePredictionsFromSignals(
  signalContext: string,
  signalCount: number,
): Promise<InsertAiPrediction[]> {
  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `You are MarketMind's Prediction Engine — an autonomous AI that generates specific, actionable market predictions based on real data signals.

You are analyzing REAL signals from Yahoo Finance, Reddit, financial news, SEC EDGAR insider filings, Polymarket, StockTwits, CBOE VIX, Google Trends, VIP Twitter accounts, and finance podcasts.

YOUR JOB: Generate calibrated predictions grounded in the actual data. Every prediction must cite specific signals.

SIMPLICITY BIAS: Prefer simpler signal weight adjustments over complex ones when accuracy improvement is equivalent. Smaller, more targeted changes are preferred. A prediction backed by one strong signal is better than one backed by five weak signals.

CALIBRATION RULES:
- 80-95 confidence: Strong multi-source alignment (price + sentiment + news all pointing same direction)
- 65-79: Moderate conviction with 2+ confirming signals
- 50-64: Speculative with mixed signals
- 30-49: Low conviction, contrarian or exploratory
- NEVER cluster all predictions at the same confidence level
- Price targets must be specific dollar amounts based on actual current prices in the data
- Reasoning must reference specific signals from the data provided

Return valid JSON: { "predictions": [...] }
Each prediction: { predictionId (string), ticker (string), direction ("up"/"down"/"neutral"), horizon ("1D"/"7D"/"30D"), confidence (0-100 integer), reasoning (string, 1-2 sentences citing specific data), priceTarget (number in dollars), priceAtPrediction (number in dollars, current price from the data), category (string: "market_direction"/"sector_rotation"/"volatility"/"event_impact"/"earnings"/"tariff_impact"/"social_momentum") }`;

  const userPrompt = `Today is ${today}. I have ${signalCount} real signals from the last 6 hours.

${signalContext}

Based on this REAL data, generate 6-8 predictions. Each must:
1. Reference specific data points from the signals
2. Include the actual current price from Yahoo Finance data as priceAtPrediction
3. Set a specific price target based on the data
4. Vary confidence based on signal alignment (30-95 range)
5. Mix horizons: at least 2 each of 1D, 7D, 30D`;

  try {
    const raw = await callLLMStructured(systemPrompt, userPrompt);
    const parsed = JSON.parse(raw);
    const predictions: InsertAiPrediction[] = (parsed.predictions || []).map((p: any, i: number) => ({
      predictionId: p.predictionId || `pred-${Date.now()}-${i}`,
      ticker: String(p.ticker || "SPY").slice(0, 20),
      direction: ["up", "down", "neutral"].includes(p.direction) ? p.direction : "neutral",
      horizon: ["1D", "7D", "30D"].includes(p.horizon) ? p.horizon : "7D",
      confidence: typeof p.confidence === "number" ? Math.max(20, Math.min(95, Math.round(p.confidence))) : 50,
      reasoning: String(p.reasoning || ""),
      priceTarget: typeof p.priceTarget === "number" ? Math.round(p.priceTarget * 100) : null, // Store in cents
      priceAtPrediction: typeof p.priceAtPrediction === "number" ? Math.round(p.priceAtPrediction * 100) : null,
      category: String(p.category || "market_direction"),
      agentVersion: agentStatus.currentVersion,
      outcome: "pending" as const,
    }));

    return predictions.length > 0 ? predictions : [];
  } catch (err: any) {
    console.error("[ResearchAgent] Prediction generation failed:", err.message);
    return [];
  }
}

// ============================================================================
// Main Research Cycle
// ============================================================================

async function runResearchCycle(): Promise<void> {
  agentStatus.isRunning = true;
  const startTime = Date.now();

  const db = await getDb();
  if (!db) {
    agentStatus.isRunning = false;
    agentStatus.lastError = "Database unavailable";
    return;
  }

  // Record agent run
  const [runRecord] = await db.insert(agentRuns).values({
    agentType: "research",
    status: "running",
    signalsProcessed: 0,
  }).$returningId();

  try {
    // 1. Gather real signal context from database
    const signals = await gatherSignalContext(db);
    console.log(`[ResearchAgent] Gathered ${signals.totalSignals} signals (${signals.redditSignals.length} Reddit, ${signals.priceSignals.length} Yahoo, ${signals.newsSignals.length} RSS)`);

    if (signals.totalSignals === 0) {
      console.log("[ResearchAgent] No signals to analyze, skipping cycle");
      await db.update(agentRuns)
        .set({ status: "completed", completedAt: new Date(), signalsProcessed: 0, metadata: JSON.stringify({ reason: "no signals" }) })
        .where(eq(agentRuns.id, runRecord.id));
      agentStatus.isRunning = false;
      return;
    }

    const signalContext = formatSignalContext(signals);

    // 2. Generate narratives from real signals
    const narratives = await generateNarrativesFromSignals(signalContext, signals.totalSignals);
    if (narratives.length > 0) {
      await db.insert(aiNarratives).values(narratives);
    }
    console.log(`[ResearchAgent] Generated ${narratives.length} narratives`);

    // 3. Generate predictions from real signals
    const predictions = await generatePredictionsFromSignals(signalContext, signals.totalSignals);
    if (predictions.length > 0) {
      await db.insert(aiPredictions).values(predictions);
    }
    console.log(`[ResearchAgent] Generated ${predictions.length} predictions`);

    // 4. Update agent run record
    await db.update(agentRuns)
      .set({
        status: "completed",
        signalsProcessed: signals.totalSignals,
        narrativesGenerated: narratives.length,
        predictionsGenerated: predictions.length,
        completedAt: new Date(),
        metadata: JSON.stringify({
          durationMs: Date.now() - startTime,
          signalBreakdown: {
            reddit: signals.redditSignals.length,
            yahoo: signals.priceSignals.length,
            rss: signals.newsSignals.length,
          },
        }),
      })
      .where(eq(agentRuns.id, runRecord.id));

    // Update status
    agentStatus.lastRun = new Date();
    agentStatus.signalsProcessed += signals.totalSignals;
    agentStatus.narrativesGenerated += narratives.length;
    agentStatus.predictionsGenerated += predictions.length;
    agentStatus.lastError = null;

    console.log(`[ResearchAgent] Cycle complete in ${Date.now() - startTime}ms: ${narratives.length} narratives, ${predictions.length} predictions from ${signals.totalSignals} signals`);
  } catch (err: any) {
    console.error("[ResearchAgent] Cycle failed:", err.message);
    agentStatus.lastError = err.message;

    await db.update(agentRuns)
      .set({ status: "failed", errorMessage: err.message, completedAt: new Date() })
      .where(eq(agentRuns.id, runRecord.id));
  } finally {
    agentStatus.isRunning = false;
  }
}

// ============================================================================
// Query Helpers — Serve AI-generated intelligence
// ============================================================================

export async function getLatestNarratives(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(aiNarratives)
    .orderBy(desc(aiNarratives.generatedAt))
    .limit(limit);
}

export async function getLatestPredictions(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(aiPredictions)
    .orderBy(desc(aiPredictions.generatedAt))
    .limit(limit);
}

export async function getPendingPredictions() {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(aiPredictions)
    .where(eq(aiPredictions.outcome, "pending"))
    .orderBy(desc(aiPredictions.generatedAt));
}

export async function getLastAgentRun(agentType: "research" | "improvement" | "ingestion") {
  const db = await getDb();
  if (!db) return null;
  const runs = await db.select()
    .from(agentRuns)
    .where(eq(agentRuns.agentType, agentType))
    .orderBy(desc(agentRuns.startedAt))
    .limit(1);
  return runs[0] || null;
}

export async function getAgentRunHistory(agentType: "research" | "improvement" | "ingestion", limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(agentRuns)
    .where(eq(agentRuns.agentType, agentType))
    .orderBy(desc(agentRuns.startedAt))
    .limit(limit);
}

// ============================================================================
// Scheduler
// ============================================================================

const RESEARCH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
let researchTimer: ReturnType<typeof setInterval> | null = null;

export function startResearchAgent() {
  console.log("[ResearchAgent] Starting LLM-powered research agent (every 30 min)...");

  // Run first cycle after a short delay (let ingestion populate first)
  setTimeout(async () => {
    await runResearchCycle();
    agentStatus.nextRun = new Date(Date.now() + RESEARCH_INTERVAL_MS);
  }, 60_000); // 1 minute delay

  // Schedule recurring
  researchTimer = setInterval(async () => {
    await runResearchCycle();
    agentStatus.nextRun = new Date(Date.now() + RESEARCH_INTERVAL_MS);
  }, RESEARCH_INTERVAL_MS);

  return researchTimer;
}

export function stopResearchAgent() {
  if (researchTimer) {
    clearInterval(researchTimer);
    researchTimer = null;
  }
}

// Manual trigger for testing
export async function triggerResearchCycle() {
  if (agentStatus.isRunning) {
    return { success: false, message: "Research agent is already running" };
  }
  await runResearchCycle();
  return { success: true, message: "Research cycle completed" };
}
