/**
 * Alpha Score Alerts — Custom alert rules based on Alpha Score thresholds
 * 
 * Users can create rules like:
 * - "Notify me when any ticker's Alpha Score crosses 80"
 * - "Alert me when AAPL's Alpha Score drops below 40"
 * - "Alert when any ticker enters Top Opportunities (score > 75)"
 * 
 * Also provides leaderboard data endpoints with historical tracking.
 */

import { getAlphaScores, type AlphaScore } from "./alphaEngine";
import { notifyOwner } from "./_core/notification";

// ============================================================================
// Types
// ============================================================================

export interface AlphaAlert {
  id: string;
  /** null = any ticker */
  ticker: string | null;
  /** Alert condition */
  condition: "above" | "below" | "crosses_above" | "crosses_below";
  /** Threshold score (0-100) */
  threshold: number;
  /** Label for display */
  label: string;
  /** Whether alert is active */
  isActive: boolean;
  /** Whether it's been triggered */
  triggered: boolean;
  triggeredAt: number | null;
  triggerContext: string | null;
  /** Created timestamp */
  createdAt: number;
}

export interface AlphaScoreHistory {
  ticker: string;
  /** Array of [timestamp, score] pairs for sparkline */
  history: Array<{ timestamp: number; score: number }>;
  /** 24h change */
  change24h: number;
  /** 7-day high/low */
  high7d: number;
  low7d: number;
}

export interface LeaderboardEntry {
  ticker: string;
  score: number;
  rank: number;
  change24h: number;
  components: AlphaScore["components"];
  direction: AlphaScore["direction"];
  reasoning: string;
  sparkline: number[]; // last 7 days of scores
  isTopOpportunity: boolean;
  sector: string;
}

// ============================================================================
// In-memory stores
// ============================================================================

let alphaAlerts: AlphaAlert[] = [];
let scoreHistory: Map<string, Array<{ timestamp: number; score: number }>> = new Map();
let previousScores: Map<string, number> = new Map();
let alertCheckInterval: ReturnType<typeof setInterval> | null = null;
let historyInterval: ReturnType<typeof setInterval> | null = null;

// Sector mapping for tickers
const TICKER_SECTORS: Record<string, string> = {
  AAPL: "Technology", MSFT: "Technology", GOOGL: "Technology", META: "Technology",
  AMZN: "Consumer", TSLA: "Automotive", NVDA: "Semiconductors", AMD: "Semiconductors",
  SPY: "Index", QQQ: "Index", DIA: "Index", IWM: "Index",
  JPM: "Financials", GS: "Financials", BAC: "Financials", WFC: "Financials",
  XOM: "Energy", CVX: "Energy", COP: "Energy",
  JNJ: "Healthcare", UNH: "Healthcare", PFE: "Healthcare",
  WMT: "Consumer", HD: "Consumer", NKE: "Consumer",
  DIS: "Communication", NFLX: "Communication", CMCSA: "Communication",
  BA: "Industrial", CAT: "Industrial", GE: "Industrial",
  V: "Financials", MA: "Financials", PYPL: "Financials",
  CRM: "Technology", ORCL: "Technology", ADBE: "Technology",
  COIN: "Crypto", MSTR: "Crypto",
  PLTR: "Technology", SNOW: "Technology", NET: "Technology",
};

// ============================================================================
// Alpha Alert CRUD
// ============================================================================

export function createAlphaAlert(params: {
  ticker: string | null;
  condition: AlphaAlert["condition"];
  threshold: number;
  label?: string;
}): AlphaAlert {
  const tickerLabel = params.ticker || "Any Ticker";
  const condLabel = params.condition.replace("_", " ");
  const defaultLabel = `${tickerLabel} Alpha Score ${condLabel} ${params.threshold}`;

  const alert: AlphaAlert = {
    id: `aa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ticker: params.ticker,
    condition: params.condition,
    threshold: params.threshold,
    label: params.label || defaultLabel,
    isActive: true,
    triggered: false,
    triggeredAt: null,
    triggerContext: null,
    createdAt: Date.now(),
  };

  alphaAlerts.push(alert);
  return alert;
}

export function getAlphaAlerts(): AlphaAlert[] {
  return alphaAlerts;
}

export function deleteAlphaAlert(id: string): boolean {
  const idx = alphaAlerts.findIndex(a => a.id === id);
  if (idx === -1) return false;
  alphaAlerts.splice(idx, 1);
  return true;
}

export function toggleAlphaAlert(id: string, isActive: boolean): boolean {
  const alert = alphaAlerts.find(a => a.id === id);
  if (!alert) return false;
  alert.isActive = isActive;
  if (isActive) {
    alert.triggered = false;
    alert.triggeredAt = null;
    alert.triggerContext = null;
  }
  return true;
}

export function resetAlphaAlert(id: string): boolean {
  const alert = alphaAlerts.find(a => a.id === id);
  if (!alert) return false;
  alert.triggered = false;
  alert.triggeredAt = null;
  alert.triggerContext = null;
  alert.isActive = true;
  return true;
}

// ============================================================================
// Alert Checking
// ============================================================================

async function checkAlphaAlerts(): Promise<void> {
  const currentScores = getAlphaScores();
  const scoreMap = new Map(currentScores.map(s => [s.ticker, s.score]));

  for (const alert of alphaAlerts) {
    if (!alert.isActive || alert.triggered) continue;

    // Get relevant scores
    const tickersToCheck = alert.ticker 
      ? [alert.ticker] 
      : Array.from(scoreMap.keys());

    for (const ticker of tickersToCheck) {
      const currentScore = scoreMap.get(ticker);
      if (currentScore === undefined) continue;

      const prevScore = previousScores.get(ticker) ?? currentScore;
      let shouldTrigger = false;
      let context = "";

      switch (alert.condition) {
        case "above":
          if (currentScore >= alert.threshold) {
            shouldTrigger = true;
            context = `${ticker} Alpha Score is ${currentScore} (above ${alert.threshold})`;
          }
          break;
        case "below":
          if (currentScore <= alert.threshold) {
            shouldTrigger = true;
            context = `${ticker} Alpha Score is ${currentScore} (below ${alert.threshold})`;
          }
          break;
        case "crosses_above":
          if (prevScore < alert.threshold && currentScore >= alert.threshold) {
            shouldTrigger = true;
            context = `${ticker} Alpha Score crossed above ${alert.threshold} (was ${prevScore}, now ${currentScore})`;
          }
          break;
        case "crosses_below":
          if (prevScore > alert.threshold && currentScore <= alert.threshold) {
            shouldTrigger = true;
            context = `${ticker} Alpha Score crossed below ${alert.threshold} (was ${prevScore}, now ${currentScore})`;
          }
          break;
      }

      if (shouldTrigger) {
        alert.triggered = true;
        alert.triggeredAt = Date.now();
        alert.triggerContext = context;

        // Send notification
        try {
          await notifyOwner({
            title: `Alpha Alert: ${alert.label}`,
            content: `${context}\n\nTriggered: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET`,
          });
        } catch {
          // Notification failure is non-critical
        }

        console.log(`[AlphaAlerts] Triggered: ${context}`);
        break; // Only trigger once per alert
      }
    }
  }

  // Update previous scores for crossing detection
  for (const [ticker, score] of Array.from(scoreMap)) {
    previousScores.set(ticker, score);
  }
}

// ============================================================================
// Score History Tracking
// ============================================================================

function recordScoreHistory(): void {
  const currentScores = getAlphaScores();
  const now = Date.now();

  for (const score of currentScores) {
    if (!scoreHistory.has(score.ticker)) {
      scoreHistory.set(score.ticker, []);
    }
    const history = scoreHistory.get(score.ticker)!;
    history.push({ timestamp: now, score: score.score });

    // Keep only 7 days of history (at 5-min intervals = ~2016 points)
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const filtered = history.filter(h => h.timestamp >= sevenDaysAgo);
    scoreHistory.set(score.ticker, filtered);
  }
}

/**
 * Seed initial history with simulated data for sparklines
 */
function seedHistory(): void {
  const tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "AMZN", "META", "SPY", "QQQ", "AMD",
    "JPM", "GS", "XOM", "JNJ", "WMT", "DIS", "BA", "V", "CRM", "COIN"];
  const now = Date.now();

  for (const ticker of tickers) {
    const history: Array<{ timestamp: number; score: number }> = [];
    let baseScore = 30 + Math.random() * 50; // 30-80

    // Generate 7 days of data at 30-min intervals
    for (let i = 7 * 48; i >= 0; i--) {
      const timestamp = now - i * 30 * 60 * 1000;
      // Random walk with mean reversion
      baseScore += (Math.random() - 0.48) * 4;
      baseScore = Math.max(5, Math.min(95, baseScore));
      history.push({ timestamp, score: Math.round(baseScore) });
    }

    scoreHistory.set(ticker, history);
    previousScores.set(ticker, Math.round(baseScore));
  }
}

// ============================================================================
// Leaderboard Data
// ============================================================================

export function getLeaderboard(options?: {
  sector?: string;
  minScore?: number;
  signalType?: string;
  limit?: number;
}): LeaderboardEntry[] {
  const currentScores = getAlphaScores();
  const limit = options?.limit || 50;

  let entries: LeaderboardEntry[] = currentScores.map((score, idx) => {
    const history = scoreHistory.get(score.ticker) || [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const dayAgoEntry = history.find(h => h.timestamp >= oneDayAgo);
    const change24h = dayAgoEntry ? score.score - dayAgoEntry.score : 0;

    // Get sparkline (last 7 days, sampled to ~14 points)
    const sparkline: number[] = [];
    if (history.length > 0) {
      const step = Math.max(1, Math.floor(history.length / 14));
      for (let i = 0; i < history.length; i += step) {
        sparkline.push(history[i].score);
      }
      // Always include the latest
      if (sparkline[sparkline.length - 1] !== history[history.length - 1].score) {
        sparkline.push(history[history.length - 1].score);
      }
    }

    const sector = TICKER_SECTORS[score.ticker] || "Other";

    // Determine dominant signal type
    const components = score.components;
    let dominantSignal = "ai_confidence";
    let maxComponent = components.aiConfidence;
    if (components.marketDivergence > maxComponent) { dominantSignal = "market_divergence"; maxComponent = components.marketDivergence; }
    if (components.vipSentiment > maxComponent) { dominantSignal = "vip_sentiment"; maxComponent = components.vipSentiment; }
    if (components.narrativeVelocity > maxComponent) { dominantSignal = "narrative_velocity"; maxComponent = components.narrativeVelocity; }
    if (components.anomalyFlags > maxComponent) { dominantSignal = "anomaly_flags"; }

    return {
      ticker: score.ticker,
      score: score.score,
      rank: idx + 1,
      change24h: Math.round(change24h * 10) / 10,
      components: score.components,
      direction: score.direction,
      reasoning: score.reasoning,
      sparkline,
      isTopOpportunity: score.score >= 75,
      sector,
      _dominantSignal: dominantSignal,
    } as LeaderboardEntry & { _dominantSignal: string };
  });

  // Apply filters
  if (options?.sector && options.sector !== "all") {
    entries = entries.filter(e => e.sector === options.sector);
  }
  if (options?.minScore) {
    entries = entries.filter(e => e.score >= options.minScore!);
  }
  if (options?.signalType && options.signalType !== "all") {
    entries = entries.filter(e => (e as any)._dominantSignal === options.signalType);
  }

  // Re-rank after filtering
  entries.forEach((e, i) => { e.rank = i + 1; });

  // Clean up internal field
  return entries.slice(0, limit).map(({ _dominantSignal, ...rest }: any) => rest);
}

export function getTopOpportunities(limit = 10): LeaderboardEntry[] {
  return getLeaderboard({ minScore: 75, limit });
}

export function getScoreHistory(ticker: string): AlphaScoreHistory {
  const history = scoreHistory.get(ticker) || [];
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  const dayAgoEntry = history.find(h => h.timestamp >= oneDayAgo);
  const currentScore = history.length > 0 ? history[history.length - 1].score : 0;
  const change24h = dayAgoEntry ? currentScore - dayAgoEntry.score : 0;

  const scores = history.map(h => h.score);
  const high7d = scores.length > 0 ? Math.max(...scores) : 0;
  const low7d = scores.length > 0 ? Math.min(...scores) : 0;

  return {
    ticker,
    history,
    change24h: Math.round(change24h * 10) / 10,
    high7d,
    low7d,
  };
}

export function getAvailableSectors(): string[] {
  const sectors = new Set<string>();
  const currentScores = getAlphaScores();
  for (const score of currentScores) {
    sectors.add(TICKER_SECTORS[score.ticker] || "Other");
  }
  return Array.from(sectors).sort();
}

export function getAlphaAlertStatus() {
  return {
    name: "Alpha Alerts",
    description: "Custom Alpha Score threshold alerts",
    status: alertCheckInterval ? "running" as const : "stopped" as const,
    totalAlerts: alphaAlerts.length,
    activeAlerts: alphaAlerts.filter(a => a.isActive && !a.triggered).length,
    triggeredAlerts: alphaAlerts.filter(a => a.triggered).length,
  };
}

// ============================================================================
// Background Runner
// ============================================================================

export function startAlphaAlerts(): void {
  if (alertCheckInterval) return;

  console.log("[AlphaAlerts] Starting alpha alert checker...");

  // Seed history
  seedHistory();

  // Seed some default alerts
  if (alphaAlerts.length === 0) {
    createAlphaAlert({
      ticker: null,
      condition: "crosses_above",
      threshold: 80,
      label: "Any ticker Alpha Score crosses above 80",
    });
    createAlphaAlert({
      ticker: "AAPL",
      condition: "crosses_below",
      threshold: 40,
      label: "AAPL Alpha Score drops below 40",
    });
    createAlphaAlert({
      ticker: "TSLA",
      condition: "above",
      threshold: 75,
      label: "TSLA enters Top Opportunities (score > 75)",
    });
  }

  // Check alerts every 2 minutes
  alertCheckInterval = setInterval(async () => {
    try {
      await checkAlphaAlerts();
      recordScoreHistory();
    } catch (err) {
      console.error("[AlphaAlerts] Check error:", err);
    }
  }, 2 * 60 * 1000);

  // Also record history every 5 minutes
  historyInterval = setInterval(() => {
    try {
      recordScoreHistory();
    } catch (err) {
      console.error("[AlphaAlerts] History recording error:", err);
    }
  }, 5 * 60 * 1000);

  // Initial check after 25 seconds
  setTimeout(async () => {
    try {
      recordScoreHistory();
      await checkAlphaAlerts();
    } catch (err) {
      console.error("[AlphaAlerts] Initial check error:", err);
    }
  }, 25000);
}

export function stopAlphaAlerts(): void {
  if (alertCheckInterval) {
    clearInterval(alertCheckInterval);
    alertCheckInterval = null;
  }
  if (historyInterval) {
    clearInterval(historyInterval);
    historyInterval = null;
  }
}
