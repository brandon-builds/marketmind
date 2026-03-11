import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { updatePrice, startAlertChecker, stopAlertChecker } from "./alertChecker";
import { startDigestScheduler, stopDigestScheduler } from "./digestJob";
import { startReportScheduler } from "./reportGenerator";
import { startTwitterIngestion } from "./twitterIngestion";
import { startAnomalyDetection, stopAnomalyDetection } from "./anomalyDetection";
import { startRealIngestion } from "./realIngestion";
import { startResearchAgent } from "./researchAgent";
import { startImprovementAgent } from "./improvementAgent";
import { startVipMonitor } from "./vipAccountMonitor";
import { startTrendingIngestion } from "./trendingTopics";
import { startPredictionMarketIngestion, getActiveMarkets } from "./predictionMarkets";
import { startAlphaEngine } from "./alphaEngine";
import { startTradeJournal, stopTradeJournal } from "./tradeJournal";
import { startAlphaAlerts, stopAlphaAlerts } from "./alphaAlerts";
import { startDailyDigest, stopDailyDigest } from "./dailyDigest";
import { startMultiTimeframeEngine, stopMultiTimeframeEngine, getMultiTimeframeScores } from "./multiTimeframeAlpha";
import { startRebalanceEngine, stopRebalanceEngine } from "./rebalanceSuggestions";
import { getAlphaScores } from "./alphaEngine";
import { getDb } from "./db";
import { portfolioHoldings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

interface PriceTick {
  type: "price_update";
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

interface MarketStatusMessage {
  type: "market_status";
  status: "open" | "closed" | "pre" | "after";
  timestamp: number;
}

// Collab messages
interface CollabJoin {
  type: "collab_join";
  watchlistId: number;
  userId: string;
  userName: string;
}

interface CollabLeave {
  type: "collab_leave";
  watchlistId: number;
  userId: string;
}

interface CollabPresence {
  type: "collab_presence";
  watchlistId: number;
  viewers: { userId: string; userName: string }[];
}

interface CollabAnnotation {
  type: "collab_annotation";
  watchlistId: number;
  annotation: {
    id: number;
    ticker: string;
    content: string;
    sentiment: string | null;
    userName: string;
    userId: string;
    createdAt: number;
  };
}

interface CollabAnnotationDeleted {
  type: "collab_annotation_deleted";
  watchlistId: number;
  annotationId: number;
}

interface AlphaScoreUpdate {
  type: "alpha_score_update";
  scores: Array<{
    ticker: string;
    score: number;
    direction: string;
    change: number;
  }>;
  timestamp: number;
}

type WSMessage = PriceTick | MarketStatusMessage | AlphaScoreUpdate;

// Base prices for simulation — these get updated as ticks flow
const basePrices: Record<string, { price: number; name: string }> = {
  SPY: { price: 582.51, name: "S&P 500 ETF" },
  QQQ: { price: 485.84, name: "Nasdaq 100 ETF" },
  "^VIX": { price: 17.1, name: "VIX Volatility" },
  XLK: { price: 217.42, name: "Technology" },
  XLE: { price: 89.8, name: "Energy" },
  XLF: { price: 43.58, name: "Financials" },
  XLI: { price: 118.01, name: "Industrials" },
  XLY: { price: 195.44, name: "Consumer Disc." },
  XLP: { price: 79.84, name: "Consumer Staples" },
  XLV: { price: 145.35, name: "Healthcare" },
  XLB: { price: 85.51, name: "Materials" },
  AAPL: { price: 229.98, name: "Apple Inc." },
  MSFT: { price: 429.71, name: "Microsoft Corp." },
  NVDA: { price: 136.85, name: "NVIDIA Corp." },
  GOOGL: { price: 173.18, name: "Alphabet Inc." },
  AMZN: { price: 195.54, name: "Amazon.com" },
  META: { price: 574.26, name: "Meta Platforms" },
  TSLA: { price: 343.21, name: "Tesla Inc." },
  GLD: { price: 241.44, name: "Gold ETF" },
  USO: { price: 73.16, name: "Oil ETF" },
  TLT: { price: 88.01, name: "Treasury Bond ETF" },
};

// Track current simulated prices
const currentPrices = new Map<string, number>();
const openPrices = new Map<string, number>();

// Initialize prices
for (const [symbol, data] of Object.entries(basePrices)) {
  currentPrices.set(symbol, data.price);
  openPrices.set(symbol, data.price * (1 + (Math.random() - 0.5) * 0.02));
}

let wss: WebSocketServer | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;

// ─── Collab Presence Tracking ───
interface ClientMeta {
  ws: WebSocket;
  userId?: string;
  userName?: string;
  watchlistId?: number;
}

const clients = new Map<WebSocket, ClientMeta>();

function getWatchlistViewers(watchlistId: number): { userId: string; userName: string }[] {
  const viewers: { userId: string; userName: string }[] = [];
  const seen = new Set<string>();
  clients.forEach((meta) => {
    if (meta.watchlistId === watchlistId && meta.userId && !seen.has(meta.userId)) {
      seen.add(meta.userId);
      viewers.push({ userId: meta.userId, userName: meta.userName || "Anonymous" });
    }
  });
  return viewers;
}

function broadcastToWatchlist(watchlistId: number, message: object, excludeWs?: WebSocket) {
  const data = JSON.stringify(message);
  clients.forEach((meta, ws) => {
    if (meta.watchlistId === watchlistId && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

function broadcastPresence(watchlistId: number) {
  const viewers = getWatchlistViewers(watchlistId);
  const msg: CollabPresence = { type: "collab_presence", watchlistId, viewers };
  broadcastToWatchlist(watchlistId, msg);
}

// Public API for routers to broadcast annotations
export function broadcastAnnotation(watchlistId: number, annotation: CollabAnnotation["annotation"]) {
  const msg: CollabAnnotation = { type: "collab_annotation", watchlistId, annotation };
  broadcastToWatchlist(watchlistId, msg);
}

export function broadcastAnnotationDeleted(watchlistId: number, annotationId: number) {
  const msg: CollabAnnotationDeleted = { type: "collab_annotation_deleted", watchlistId, annotationId };
  broadcastToWatchlist(watchlistId, msg);
}

function generatePriceTick(): PriceTick {
  const symbols = Object.keys(basePrices);
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const current = currentPrices.get(symbol)!;
  const open = openPrices.get(symbol)!;

  // Small random walk: -0.15% to +0.15% per tick
  const volatility = symbol === "^VIX" ? 0.004 : 0.0015;
  const drift = (Math.random() - 0.502) * volatility; // slight mean-reversion bias
  const newPrice = +(current * (1 + drift)).toFixed(2);

  currentPrices.set(symbol, newPrice);

  const change = +(newPrice - open).toFixed(2);
  const changePercent = +((change / open) * 100).toFixed(2);

  return {
    type: "price_update",
    symbol,
    price: newPrice,
    change,
    changePercent,
    timestamp: Date.now(),
  };
}

/** Previous alpha scores for change detection in WS push */
let prevAlphaForWs: Map<string, number> = new Map();

function broadcast(message: WSMessage) {
  if (!wss) return;
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });

  // Feed price updates to the alert checker
  if (message.type === "price_update") {
    updatePrice(message.symbol, message.price);
  }
}

/**
 * Broadcast alpha score changes to all connected clients.
 * Only sends tickers that actually changed.
 */
function broadcastAlphaScores(): void {
  if (!wss || wss.clients.size === 0) return;

  const current = getAlphaScores();
  const changes: AlphaScoreUpdate["scores"] = [];

  for (const score of current) {
    const prev = prevAlphaForWs.get(score.ticker);
    const change = prev !== undefined ? score.score - prev : 0;
    // Only broadcast if score changed by at least 1 point
    if (prev === undefined || Math.abs(change) >= 1) {
      changes.push({
        ticker: score.ticker,
        score: score.score,
        direction: score.direction,
        change: Math.round(change * 10) / 10,
      });
    }
  }

  if (changes.length > 0) {
    const msg: AlphaScoreUpdate = {
      type: "alpha_score_update",
      scores: changes,
      timestamp: Date.now(),
    };
    const data = JSON.stringify(msg);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // Update previous scores
  prevAlphaForWs.clear();
  for (const score of current) {
    prevAlphaForWs.set(score.ticker, score.score);
  }
}

export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    // Register client
    clients.set(ws, { ws });

    // Send initial snapshot of all current prices
    const snapshot = Object.keys(basePrices).map((symbol) => {
      const price = currentPrices.get(symbol)!;
      const open = openPrices.get(symbol)!;
      const change = +(price - open).toFixed(2);
      const changePercent = +((change / open) * 100).toFixed(2);
      return {
        type: "price_update" as const,
        symbol,
        price,
        change,
        changePercent,
        timestamp: Date.now(),
      };
    });

    ws.send(JSON.stringify({ type: "snapshot", prices: snapshot }));

    // Send market status
    ws.send(
      JSON.stringify({
        type: "market_status",
        status: "open",
        timestamp: Date.now(),
      })
    );

    // Handle incoming messages (collab join/leave)
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const meta = clients.get(ws);
        if (!meta) return;

        if (msg.type === "collab_join" && msg.watchlistId && msg.userId) {
          // Leave previous watchlist if any
          const prevWatchlistId = meta.watchlistId;
          
          meta.userId = msg.userId;
          meta.userName = msg.userName || "Anonymous";
          meta.watchlistId = msg.watchlistId;

          // Broadcast updated presence to the new watchlist
          broadcastPresence(msg.watchlistId);
          
          // If they left a previous watchlist, update that one too
          if (prevWatchlistId && prevWatchlistId !== msg.watchlistId) {
            broadcastPresence(prevWatchlistId);
          }
        } else if (msg.type === "collab_leave") {
          const prevWatchlistId = meta.watchlistId;
          meta.watchlistId = undefined;
          if (prevWatchlistId) {
            broadcastPresence(prevWatchlistId);
          }
        }
      } catch {
        // Ignore parse errors
      }
    });

    ws.on("close", () => {
      const meta = clients.get(ws);
      const watchlistId = meta?.watchlistId;
      clients.delete(ws);
      if (watchlistId) {
        broadcastPresence(watchlistId);
      }
    });

    ws.on("error", () => {
      // Silently handle client errors
    });
  });

  // Generate price ticks every 2-4 seconds (random interval for realism)
  function scheduleTick() {
    const delay = 2000 + Math.random() * 2000; // 2-4 seconds
    tickInterval = setTimeout(() => {
      // Send 1-3 ticks per batch for realism
      const tickCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < tickCount; i++) {
        const tick = generatePriceTick();
        broadcast(tick);
      }
      scheduleTick();
    }, delay);
  }

  scheduleTick();

  // Start server-side alert checker
  startAlertChecker();

  // Start email digest scheduler
  startDigestScheduler();

  // Start weekly report scheduler
  startReportScheduler();

  // Start Twitter/X real-time signal ingestion pipeline
  startTwitterIngestion();

  // Start anomaly detection engine
  startAnomalyDetection();

  // Start real data ingestion (Reddit, Yahoo Finance, RSS)
  startRealIngestion();

  // Start LLM research agent (narrative + prediction generation)
  startResearchAgent();

  // Start self-improvement agent (accuracy tracking + weight tuning)
  startImprovementAgent();

  // Start VIP account monitor (high-signal Twitter/X accounts)
  startVipMonitor();

  // Start X trending topics tracker
  startTrendingIngestion();

  // Start prediction market ingestion (Polymarket + Kalshi)
  startPredictionMarketIngestion();

  // Start alpha engine (composite scoring + arbitrage detection)
  // Provide data accessors for the engine to pull from caches
  startAlphaEngine(
    () => [], // predictions come from market router cache — populated after first research run
    () => [], // narratives come from market router cache
    () => getActiveMarkets(50)
  );

  // Start trade journal (automated prediction outcome logging)
  startTradeJournal(
    () => [], // predictions from market router cache
    async (ticker: string) => {
      try {
        const db = await getDb();
        if (!db) return null;
        const holdings = await db.select().from(portfolioHoldings).where(eq(portfolioHoldings.ticker, ticker)).limit(1);
        return holdings.length > 0 ? holdings[0].shares : null;
      } catch { return null; }
    }
  );

  // Start alpha score alerts checker
  startAlphaAlerts();

  // Start daily alpha digest scheduler
  startDailyDigest();

  // Start multi-timeframe alpha + smart money flow engine
  startMultiTimeframeEngine();

  // Start portfolio rebalancing suggestions engine
  startRebalanceEngine();

  // Broadcast alpha score changes every 30 seconds to all connected clients
  setInterval(() => broadcastAlphaScores(), 30 * 1000);

  console.log("[WebSocket] Real-time price feed initialized (with collab channels + all agents)");
}

export function shutdownWebSocket() {
  stopAlertChecker();
  stopDigestScheduler();
  stopAnomalyDetection();
  stopTradeJournal();
  stopAlphaAlerts();
  stopDailyDigest();
  stopMultiTimeframeEngine();
  stopRebalanceEngine();
  if (tickInterval) {
    clearTimeout(tickInterval);
    tickInterval = null;
  }
  if (wss) {
    wss.close();
    wss = null;
  }
  clients.clear();
}
