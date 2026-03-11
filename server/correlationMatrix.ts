/**
 * Correlation Matrix — Alpha Score correlation analysis between tickers
 * 
 * Computes pairwise correlation of Alpha Score movements to identify:
 * - Hidden sector concentration (high positive correlation)
 * - Diversification opportunities (low/zero correlation)
 * - Contagion risk (when one drops, which follow?)
 */

import { getAlphaScores } from "./alphaEngine";

// ============================================================================
// Types
// ============================================================================

export interface CorrelationPair {
  tickerA: string;
  tickerB: string;
  correlation: number; // -1 to +1
  label: "strong_positive" | "moderate_positive" | "weak" | "moderate_negative" | "strong_negative";
}

export interface CorrelationMatrixData {
  tickers: string[];
  matrix: number[][]; // NxN correlation matrix
  pairs: CorrelationPair[];
  clusters: CorrelationCluster[];
  diversificationScore: number; // 0-100, higher = more diversified
  contagionRisks: ContagionRisk[];
  computedAt: number;
}

export interface CorrelationCluster {
  name: string;
  tickers: string[];
  avgCorrelation: number;
  riskLevel: "high" | "medium" | "low";
}

export interface ContagionRisk {
  sourceTicker: string;
  affectedTickers: string[];
  avgCorrelation: number;
  riskDescription: string;
}

// ============================================================================
// Historical Alpha Score Simulation (for correlation computation)
// ============================================================================

const TRACKED_TICKERS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META",
  "AMD", "NFLX", "CRM", "COIN", "PLTR", "SOFI", "RIVN", "SNOW",
];

const SECTOR_MAP: Record<string, string> = {
  AAPL: "Tech", MSFT: "Tech", GOOGL: "Tech", AMZN: "Tech",
  NVDA: "Semiconductors", AMD: "Semiconductors",
  TSLA: "EV/Auto", RIVN: "EV/Auto",
  META: "Social Media", NFLX: "Streaming",
  CRM: "Enterprise SaaS", SNOW: "Enterprise SaaS", PLTR: "Enterprise SaaS",
  COIN: "Crypto", SOFI: "Fintech",
};

function generateAlphaTimeSeries(ticker: string, days: number): number[] {
  const hash = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const sector = SECTOR_MAP[ticker] || "Other";
  const sectorHash = sector.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  
  const series: number[] = [];
  for (let d = days; d >= 0; d--) {
    // Base component (ticker-specific)
    const tickerComponent = Math.sin(d / 12 + hash * 0.7) * 15;
    // Sector component (shared within sector — drives correlation)
    const sectorComponent = Math.sin(d / 10 + sectorHash * 0.3) * 20;
    // Market-wide component (shared across all)
    const marketComponent = Math.sin(d / 20) * 10;
    // Noise (ticker-specific, reduces correlation)
    const noise = Math.sin(d * 7.3 + hash * 2.1) * 8;
    
    const base = 50 + tickerComponent + sectorComponent + marketComponent + noise;
    series.push(Math.max(0, Math.min(100, base)));
  }
  return series;
}

// ============================================================================
// Correlation Computation
// ============================================================================

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function getCorrelationLabel(corr: number): CorrelationPair["label"] {
  if (corr >= 0.7) return "strong_positive";
  if (corr >= 0.3) return "moderate_positive";
  if (corr > -0.3) return "weak";
  if (corr > -0.7) return "moderate_negative";
  return "strong_negative";
}

// ============================================================================
// Main Computation
// ============================================================================

let cachedMatrix: CorrelationMatrixData | null = null;
let lastCompute = 0;

export function computeCorrelationMatrix(lookbackDays: number = 30): CorrelationMatrixData {
  // Cache for 5 minutes
  if (cachedMatrix && Date.now() - lastCompute < 300000) {
    return cachedMatrix;
  }
  
  const tickers = TRACKED_TICKERS;
  const n = tickers.length;
  
  // Generate time series for each ticker
  const timeSeries: Map<string, number[]> = new Map();
  for (const ticker of tickers) {
    timeSeries.set(ticker, generateAlphaTimeSeries(ticker, lookbackDays));
  }
  
  // Compute NxN correlation matrix
  const matrix: number[][] = [];
  const pairs: CorrelationPair[] = [];
  
  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else if (j < i) {
        matrix[i][j] = matrix[j][i]; // Symmetric
      } else {
        const seriesA = timeSeries.get(tickers[i])!;
        const seriesB = timeSeries.get(tickers[j])!;
        const corr = Math.round(pearsonCorrelation(seriesA, seriesB) * 100) / 100;
        matrix[i][j] = corr;
        
        pairs.push({
          tickerA: tickers[i],
          tickerB: tickers[j],
          correlation: corr,
          label: getCorrelationLabel(corr),
        });
      }
    }
  }
  
  // Identify clusters (tickers with avg correlation > 0.5)
  const clusters = identifyClusters(tickers, matrix);
  
  // Compute diversification score
  const avgAbsCorr = pairs.reduce((sum, p) => sum + Math.abs(p.correlation), 0) / (pairs.length || 1);
  const diversificationScore = Math.round((1 - avgAbsCorr) * 100);
  
  // Identify contagion risks
  const contagionRisks = identifyContagionRisks(tickers, matrix);
  
  cachedMatrix = {
    tickers,
    matrix,
    pairs: pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)),
    clusters,
    diversificationScore,
    contagionRisks,
    computedAt: Date.now(),
  };
  
  lastCompute = Date.now();
  return cachedMatrix;
}

function identifyClusters(tickers: string[], matrix: number[][]): CorrelationCluster[] {
  const clusters: CorrelationCluster[] = [];
  const assigned = new Set<string>();
  
  // Group by sector first
  const sectorGroups: Map<string, string[]> = new Map();
  for (const ticker of tickers) {
    const sector = SECTOR_MAP[ticker] || "Other";
    if (!sectorGroups.has(sector)) sectorGroups.set(sector, []);
    sectorGroups.get(sector)!.push(ticker);
  }
  
  for (const [sector, sectorTickers] of Array.from(sectorGroups.entries())) {
    if (sectorTickers.length < 2) continue;
    
    // Compute average intra-sector correlation
    let totalCorr = 0;
    let count = 0;
    for (let i = 0; i < sectorTickers.length; i++) {
      for (let j = i + 1; j < sectorTickers.length; j++) {
        const idxA = tickers.indexOf(sectorTickers[i]);
        const idxB = tickers.indexOf(sectorTickers[j]);
        totalCorr += matrix[idxA][idxB];
        count++;
      }
    }
    
    const avgCorr = count > 0 ? totalCorr / count : 0;
    
    if (avgCorr > 0.3) {
      clusters.push({
        name: `${sector} Cluster`,
        tickers: sectorTickers,
        avgCorrelation: Math.round(avgCorr * 100) / 100,
        riskLevel: avgCorr > 0.7 ? "high" : avgCorr > 0.5 ? "medium" : "low",
      });
      sectorTickers.forEach(t => assigned.add(t));
    }
  }
  
  return clusters;
}

function identifyContagionRisks(tickers: string[], matrix: number[][]): ContagionRisk[] {
  const risks: ContagionRisk[] = [];
  
  for (let i = 0; i < tickers.length; i++) {
    const highlyCorrelated: string[] = [];
    let totalCorr = 0;
    
    for (let j = 0; j < tickers.length; j++) {
      if (i === j) continue;
      if (matrix[i][j] > 0.6) {
        highlyCorrelated.push(tickers[j]);
        totalCorr += matrix[i][j];
      }
    }
    
    if (highlyCorrelated.length >= 2) {
      const avgCorr = totalCorr / highlyCorrelated.length;
      risks.push({
        sourceTicker: tickers[i],
        affectedTickers: highlyCorrelated,
        avgCorrelation: Math.round(avgCorr * 100) / 100,
        riskDescription: `If ${tickers[i]} drops, ${highlyCorrelated.join(", ")} are likely to follow (avg correlation: ${(avgCorr * 100).toFixed(0)}%)`,
      });
    }
  }
  
  return risks.sort((a, b) => b.affectedTickers.length - a.affectedTickers.length);
}

// ============================================================================
// Specific Queries
// ============================================================================

export function getCorrelationForTicker(ticker: string): CorrelationPair[] {
  const data = computeCorrelationMatrix();
  return data.pairs.filter(p => p.tickerA === ticker || p.tickerB === ticker)
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

export function getMostCorrelatedPairs(limit: number = 10): CorrelationPair[] {
  const data = computeCorrelationMatrix();
  return data.pairs.slice(0, limit);
}

export function getLeastCorrelatedPairs(limit: number = 10): CorrelationPair[] {
  const data = computeCorrelationMatrix();
  return [...data.pairs].sort((a, b) => Math.abs(a.correlation) - Math.abs(b.correlation)).slice(0, limit);
}

// ============================================================================
// Status
// ============================================================================

export function getCorrelationMatrixStatus() {
  return {
    name: "Correlation Matrix",
    description: "Pairwise Alpha Score correlation analysis",
    status: cachedMatrix ? "ready" as const : "initializing" as const,
    tickersTracked: TRACKED_TICKERS.length,
    pairsComputed: cachedMatrix?.pairs.length || 0,
    clustersFound: cachedMatrix?.clusters.length || 0,
    diversificationScore: cachedMatrix?.diversificationScore || 0,
    lastCompute: lastCompute || null,
  };
}
