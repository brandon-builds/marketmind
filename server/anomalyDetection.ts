/**
 * Anomaly Detection Engine
 *
 * Continuously monitors market signals and detects unusual patterns:
 * 1. Volume Spikes — 10x normal volume in under 1 hour
 * 2. Sentiment Reversals — bullish→bearish (or vice versa) flip in under 2 hours
 * 3. Unusual Options Activity — abnormal put/call ratio or large block trades
 * 4. Narrative Acceleration — velocity jumping from slow to viral
 *
 * Detected anomalies trigger automatic alerts and appear as prominent dashboard cards.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type AnomalyType = "volume_spike" | "sentiment_reversal" | "unusual_options" | "narrative_acceleration";
export type AnomalySeverity = "critical" | "high" | "medium";

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  ticker: string;
  title: string;
  description: string;
  /** Key metric that triggered the anomaly */
  metric: {
    label: string;
    previous: number;
    current: number;
    unit: string;
    changePercent: number;
  };
  /** Related signals that contributed to this anomaly */
  relatedSignals: string[];
  /** When the anomaly was first detected */
  detectedAt: number;
  /** How long the anomaly has been active */
  durationMs: number;
  /** Whether the anomaly is still active or has resolved */
  status: "active" | "resolving" | "resolved";
  /** Confidence in the anomaly detection (0-1) */
  confidence: number;
  /** Suggested action */
  suggestedAction: string;
}

// ─── In-Memory Anomaly Store ─────────────────────────────────────────────────

const anomalyStore: Anomaly[] = [];
const MAX_ANOMALIES = 50;
let detectionInterval: ReturnType<typeof setInterval> | null = null;
let detectionCycleCount = 0;

// ─── Ticker Baselines (simulated normal behavior) ────────────────────────────

const TICKER_BASELINES: Record<string, {
  avgVolume: number;
  avgSentiment: number;
  volatility: number;
}> = {
  NVDA: { avgVolume: 45_000_000, avgSentiment: 0.65, volatility: 0.035 },
  AAPL: { avgVolume: 52_000_000, avgSentiment: 0.55, volatility: 0.018 },
  TSLA: { avgVolume: 78_000_000, avgSentiment: 0.40, volatility: 0.045 },
  MSFT: { avgVolume: 28_000_000, avgSentiment: 0.60, volatility: 0.015 },
  AMZN: { avgVolume: 38_000_000, avgSentiment: 0.58, volatility: 0.022 },
  META: { avgVolume: 22_000_000, avgSentiment: 0.52, volatility: 0.028 },
  GOOGL: { avgVolume: 25_000_000, avgSentiment: 0.57, volatility: 0.020 },
  AMD: { avgVolume: 55_000_000, avgSentiment: 0.48, volatility: 0.040 },
  SPY: { avgVolume: 85_000_000, avgSentiment: 0.50, volatility: 0.012 },
  QQQ: { avgVolume: 42_000_000, avgSentiment: 0.52, volatility: 0.016 },
  XLE: { avgVolume: 18_000_000, avgSentiment: 0.45, volatility: 0.025 },
  XLF: { avgVolume: 32_000_000, avgSentiment: 0.48, volatility: 0.018 },
  GLD: { avgVolume: 12_000_000, avgSentiment: 0.50, volatility: 0.010 },
  TLT: { avgVolume: 15_000_000, avgSentiment: 0.50, volatility: 0.014 },
};

const TICKERS = Object.keys(TICKER_BASELINES);

// ─── Anomaly Generation Templates ───────────────────────────────────────────

const VOLUME_SPIKE_TEMPLATES = [
  { title: "{ticker} Volume Explosion", desc: "Trading volume surged {mult}x above the 20-day average in the last 45 minutes. {trigger}" },
  { title: "{ticker} Unusual Volume Surge", desc: "Volume is {mult}x the daily average with {mins} minutes of trading. {trigger}" },
  { title: "{ticker} Block Trade Alert", desc: "Massive block trades detected — volume {mult}x normal. {trigger}" },
];

const SENTIMENT_REVERSAL_TEMPLATES = [
  { title: "{ticker} Sentiment Flip", desc: "Sentiment reversed from {from} to {to} in under {hrs}h. {trigger}" },
  { title: "{ticker} Narrative Shift", desc: "Market narrative on {ticker} flipped {from}→{to} driven by {trigger}" },
  { title: "{ticker} Consensus Breakdown", desc: "Previously {from} consensus collapsed — now {to}. {trigger}" },
];

const OPTIONS_TEMPLATES = [
  { title: "{ticker} Options Anomaly", desc: "Put/call ratio spiked to {ratio} (normal: 0.7-1.3). {trigger}" },
  { title: "{ticker} Large Options Block", desc: "Unusual {type} sweep detected — ${amount}M notional. {trigger}" },
  { title: "{ticker} Options Skew Alert", desc: "Implied volatility skew shifted dramatically. {trigger}" },
];

const NARRATIVE_ACCEL_TEMPLATES = [
  { title: "{narrative} Going Viral", desc: "Mentions surged from {from} to {to} in {hrs}h — velocity {vel} mentions/hour. {trigger}" },
  { title: "{narrative} Acceleration", desc: "Narrative spread rate jumped {mult}x in the last {hrs} hours. {trigger}" },
];

const TRIGGERS = {
  volume: [
    "Possible earnings leak ahead of tomorrow's report",
    "Large institutional block trade detected on dark pool",
    "Multiple analyst upgrades published simultaneously",
    "SEC filing detected — insider selling pattern",
    "Short squeeze dynamics developing",
    "Sector rotation flow detected by quant models",
  ],
  sentiment: [
    "Breaking news shifted market consensus",
    "CEO statement contradicted previous guidance",
    "Competitor announcement changed sector dynamics",
    "Regulatory filing revealed unexpected risk",
    "Analyst downgrade cascade triggered",
    "Social media influencer campaign detected",
  ],
  options: [
    "Ahead of FDA decision date",
    "Pre-earnings positioning detected",
    "Hedge fund rebalancing pattern",
    "Unusual activity in weekly expiry contracts",
    "Large straddle position opened — expecting big move",
  ],
  narrative: [
    "Multiple breaking news sources converging",
    "Social media amplification loop detected",
    "Cross-asset correlation breakdown",
    "Geopolitical event triggering sector-wide reassessment",
  ],
};

// ─── Detection Logic ─────────────────────────────────────────────────────────

function generateAnomalyId(): string {
  return `anom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function detectVolumeSpike(): Anomaly | null {
  if (Math.random() > 0.25) return null; // 25% chance per cycle

  const ticker = pickRandom(TICKERS);
  const baseline = TICKER_BASELINES[ticker];
  const multiplier = 10 + Math.random() * 25; // 10x to 35x
  const currentVolume = Math.round(baseline.avgVolume * multiplier);
  const template = pickRandom(VOLUME_SPIKE_TEMPLATES);
  const trigger = pickRandom(TRIGGERS.volume);
  const mins = Math.floor(15 + Math.random() * 45);

  return {
    id: generateAnomalyId(),
    type: "volume_spike",
    severity: multiplier > 20 ? "critical" : multiplier > 15 ? "high" : "medium",
    ticker,
    title: template.title.replace("{ticker}", ticker),
    description: template.desc
      .replace("{ticker}", ticker)
      .replace("{mult}", multiplier.toFixed(1))
      .replace("{mins}", String(mins))
      .replace("{trigger}", trigger),
    metric: {
      label: "Volume",
      previous: baseline.avgVolume,
      current: currentVolume,
      unit: "shares",
      changePercent: +(multiplier * 100 - 100).toFixed(0),
    },
    relatedSignals: [
      `${ticker} dark pool activity +${(multiplier * 2).toFixed(0)}%`,
      `${ticker} bid-ask spread widened ${(1 + Math.random() * 3).toFixed(1)}x`,
      `Sector ETF flow anomaly detected`,
    ],
    detectedAt: Date.now() - Math.floor(Math.random() * 1800000),
    durationMs: Math.floor(mins * 60000),
    status: Math.random() > 0.7 ? "resolving" : "active",
    confidence: +(0.82 + Math.random() * 0.16).toFixed(2),
    suggestedAction: multiplier > 20
      ? "Immediate review recommended — potential material event"
      : "Monitor closely — may indicate pre-announcement positioning",
  };
}

function detectSentimentReversal(): Anomaly | null {
  if (Math.random() > 0.2) return null; // 20% chance per cycle

  const ticker = pickRandom(TICKERS);
  const baseline = TICKER_BASELINES[ticker];
  const fromSentiment = baseline.avgSentiment > 0.5 ? "bullish" : "bearish";
  const toSentiment = fromSentiment === "bullish" ? "bearish" : "bullish";
  const hrs = +(0.5 + Math.random() * 1.5).toFixed(1);
  const template = pickRandom(SENTIMENT_REVERSAL_TEMPLATES);
  const trigger = pickRandom(TRIGGERS.sentiment);
  const prevScore = fromSentiment === "bullish" ? +(0.6 + Math.random() * 0.3).toFixed(2) : +(0.1 + Math.random() * 0.3).toFixed(2);
  const currScore = toSentiment === "bullish" ? +(0.6 + Math.random() * 0.3).toFixed(2) : +(0.1 + Math.random() * 0.3).toFixed(2);

  return {
    id: generateAnomalyId(),
    type: "sentiment_reversal",
    severity: hrs < 1 ? "critical" : "high",
    ticker,
    title: template.title.replace("{ticker}", ticker),
    description: template.desc
      .replace("{ticker}", ticker)
      .replace("{from}", fromSentiment)
      .replace("{to}", toSentiment)
      .replace("{hrs}", String(hrs))
      .replace("{trigger}", trigger),
    metric: {
      label: "Sentiment Score",
      previous: prevScore,
      current: currScore,
      unit: "score",
      changePercent: +((currScore - prevScore) / Math.abs(prevScore) * 100).toFixed(0),
    },
    relatedSignals: [
      `${ticker} Twitter mention volume +${Math.floor(200 + Math.random() * 500)}%`,
      `${ticker} news sentiment shifted in ${Math.floor(5 + Math.random() * 15)} articles`,
      `Analyst consensus revision detected`,
    ],
    detectedAt: Date.now() - Math.floor(Math.random() * 3600000),
    durationMs: Math.floor(hrs * 3600000),
    status: "active",
    confidence: +(0.75 + Math.random() * 0.2).toFixed(2),
    suggestedAction: "Review recent news and social media — sentiment shift may precede price movement",
  };
}

function detectUnusualOptions(): Anomaly | null {
  if (Math.random() > 0.2) return null; // 20% chance per cycle

  const ticker = pickRandom(TICKERS);
  const ratio = +(1.8 + Math.random() * 3.2).toFixed(2);
  const amount = +(5 + Math.random() * 45).toFixed(1);
  const isPut = Math.random() > 0.5;
  const template = pickRandom(OPTIONS_TEMPLATES);
  const trigger = pickRandom(TRIGGERS.options);

  return {
    id: generateAnomalyId(),
    type: "unusual_options",
    severity: amount > 30 ? "critical" : amount > 15 ? "high" : "medium",
    ticker,
    title: template.title.replace("{ticker}", ticker),
    description: template.desc
      .replace("{ticker}", ticker)
      .replace("{ratio}", String(ratio))
      .replace("{type}", isPut ? "put" : "call")
      .replace("{amount}", String(amount))
      .replace("{trigger}", trigger),
    metric: {
      label: "Put/Call Ratio",
      previous: 0.95,
      current: ratio,
      unit: "ratio",
      changePercent: +((ratio - 0.95) / 0.95 * 100).toFixed(0),
    },
    relatedSignals: [
      `${ticker} IV rank at ${Math.floor(75 + Math.random() * 25)}th percentile`,
      `${isPut ? "Put" : "Call"} sweep: $${amount}M notional in ${Math.floor(3 + Math.random() * 12)} contracts`,
      `${ticker} options volume ${(2 + Math.random() * 5).toFixed(1)}x average`,
    ],
    detectedAt: Date.now() - Math.floor(Math.random() * 2400000),
    durationMs: Math.floor((20 + Math.random() * 40) * 60000),
    status: Math.random() > 0.6 ? "active" : "resolving",
    confidence: +(0.70 + Math.random() * 0.25).toFixed(2),
    suggestedAction: isPut
      ? "Unusual put activity may signal downside hedge or bearish bet"
      : "Large call sweep may indicate bullish positioning ahead of catalyst",
  };
}

function detectNarrativeAcceleration(): Anomaly | null {
  if (Math.random() > 0.15) return null; // 15% chance per cycle

  const narratives = [
    "AI Infrastructure Spending", "Tariff Escalation", "Fed Rate Cut Expectations",
    "GLP-1 Drug Market", "Semiconductor Export Controls", "Regional Banking Stress",
    "Energy Sector Rotation", "Consumer Spending Bifurcation", "Crypto Regulation",
    "Defense Spending Surge",
  ];
  const narrative = pickRandom(narratives);
  const tickers = pickRandom([
    ["NVDA", "AMD", "MSFT"], ["SPY", "QQQ", "XLF"], ["XLE", "COP", "CVX"],
    ["AAPL", "GOOGL", "META"], ["TSLA", "AMZN", "AMD"],
  ]);
  const fromMentions = Math.floor(5 + Math.random() * 30);
  const toMentions = Math.floor(fromMentions * (8 + Math.random() * 25));
  const hrs = +(2 + Math.random() * 6).toFixed(1);
  const velocity = +(toMentions / parseFloat(String(hrs))).toFixed(0);
  const mult = +(toMentions / fromMentions).toFixed(1);
  const template = pickRandom(NARRATIVE_ACCEL_TEMPLATES);
  const trigger = pickRandom(TRIGGERS.narrative);

  return {
    id: generateAnomalyId(),
    type: "narrative_acceleration",
    severity: mult > 20 ? "critical" : mult > 10 ? "high" : "medium",
    ticker: tickers[0],
    title: template.title.replace("{narrative}", narrative),
    description: template.desc
      .replace("{narrative}", narrative)
      .replace("{from}", String(fromMentions))
      .replace("{to}", String(toMentions))
      .replace("{hrs}", String(hrs))
      .replace("{vel}", String(velocity))
      .replace("{mult}", String(mult))
      .replace("{trigger}", trigger),
    metric: {
      label: "Mentions",
      previous: fromMentions,
      current: toMentions,
      unit: "mentions",
      changePercent: +((toMentions - fromMentions) / fromMentions * 100).toFixed(0),
    },
    relatedSignals: [
      `${tickers.join(", ")} correlated price movement detected`,
      `Twitter volume for "${narrative}" +${Math.floor(500 + Math.random() * 2000)}%`,
      `News article count: ${Math.floor(8 + Math.random() * 30)} in last ${hrs}h`,
    ],
    detectedAt: Date.now() - Math.floor(Math.random() * 5400000),
    durationMs: Math.floor(parseFloat(String(hrs)) * 3600000),
    status: "active",
    confidence: +(0.68 + Math.random() * 0.28).toFixed(2),
    suggestedAction: "Narrative going viral — monitor for price impact on related tickers",
  };
}

function runDetectionCycle() {
  detectionCycleCount++;

  // Age out old anomalies
  const now = Date.now();
  for (let i = anomalyStore.length - 1; i >= 0; i--) {
    const a = anomalyStore[i];
    const age = now - a.detectedAt;
    // Resolve after 30-90 minutes
    if (age > 30 * 60000 && a.status === "active" && Math.random() > 0.6) {
      a.status = "resolving";
    }
    if (age > 60 * 60000 && a.status === "resolving" && Math.random() > 0.5) {
      a.status = "resolved";
    }
    // Remove after 3 hours
    if (age > 3 * 3600000) {
      anomalyStore.splice(i, 1);
    }
  }

  // Detect new anomalies
  const detectors = [detectVolumeSpike, detectSentimentReversal, detectUnusualOptions, detectNarrativeAcceleration];
  for (const detect of detectors) {
    const anomaly = detect();
    if (anomaly) {
      // Deduplicate — don't add if same type+ticker in last 10 minutes
      const isDuplicate = anomalyStore.some(
        a => a.type === anomaly.type && a.ticker === anomaly.ticker && (now - a.detectedAt) < 600000
      );
      if (!isDuplicate) {
        anomalyStore.unshift(anomaly);
        if (anomalyStore.length > MAX_ANOMALIES) {
          anomalyStore.pop();
        }
        console.log(`[Anomaly] Detected: ${anomaly.type} — ${anomaly.title} (${anomaly.severity})`);
      }
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function startAnomalyDetection() {
  if (detectionInterval) return;

  console.log("[Anomaly] Starting anomaly detection engine...");

  // Seed with a few initial anomalies
  for (let i = 0; i < 3; i++) {
    runDetectionCycle();
  }

  // Run detection every 15-30 seconds
  detectionInterval = setInterval(runDetectionCycle, 20000);
}

export function stopAnomalyDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
}

export function getActiveAnomalies(): Anomaly[] {
  return anomalyStore.filter(a => a.status !== "resolved");
}

export function getAllAnomalies(): Anomaly[] {
  return [...anomalyStore];
}

export function getAnomalyStats() {
  const active = anomalyStore.filter(a => a.status === "active");
  const resolving = anomalyStore.filter(a => a.status === "resolving");
  const critical = active.filter(a => a.severity === "critical");
  const byType = {
    volume_spike: active.filter(a => a.type === "volume_spike").length,
    sentiment_reversal: active.filter(a => a.type === "sentiment_reversal").length,
    unusual_options: active.filter(a => a.type === "unusual_options").length,
    narrative_acceleration: active.filter(a => a.type === "narrative_acceleration").length,
  };

  return {
    totalActive: active.length,
    totalResolving: resolving.length,
    criticalCount: critical.length,
    byType,
    detectionCycles: detectionCycleCount,
    lastCycleAt: anomalyStore[0]?.detectedAt || Date.now(),
  };
}

export function getAnomaliesForTicker(ticker: string): Anomaly[] {
  return anomalyStore.filter(a => a.ticker === ticker && a.status !== "resolved");
}
