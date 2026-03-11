import { describe, it, expect } from "vitest";
import {
  getSectorHeatmap,
  getSectorDrilldown,
  getBacktestResults,
  getSectorHeatmapStatus,
} from "./sectorHeatmap";
import {
  previewDigest,
  getDigestConfig,
  getDigestHistory,
  getDailyDigestStatus,
} from "./dailyDigest";

// ============================================================================
// Sector Heatmap Tests
// ============================================================================
describe("Sector Heatmap", () => {
  it("should return sector data as an array", () => {
    const sectors = getSectorHeatmap();
    expect(Array.isArray(sectors)).toBe(true);
    // May be empty if alpha engine cache not populated in test env
    for (const s of sectors) {
      expect(s).toHaveProperty("sector");
      expect(s).toHaveProperty("avgAlphaScore");
      expect(s).toHaveProperty("tickerCount");
      expect(s).toHaveProperty("topTicker");
      expect(s).toHaveProperty("topScore");
      expect(s).toHaveProperty("change24h");
      expect(typeof s.sector).toBe("string");
      expect(typeof s.avgAlphaScore).toBe("number");
      expect(s.avgAlphaScore).toBeGreaterThanOrEqual(0);
      expect(s.avgAlphaScore).toBeLessThanOrEqual(100);
    }
  });

  it("should return drilldown data with correct structure", () => {
    const drilldown = getSectorDrilldown("Technology");
    expect(drilldown).toHaveProperty("sector", "Technology");
    expect(drilldown).toHaveProperty("tickers");
    expect(Array.isArray(drilldown.tickers)).toBe(true);
    for (const t of drilldown.tickers) {
      expect(t).toHaveProperty("ticker");
      expect(t).toHaveProperty("alphaScore");
      expect(t).toHaveProperty("change24h");
    }
  });

  it("should return empty tickers for unknown sector", () => {
    const drilldown = getSectorDrilldown("NonExistentSector");
    expect(drilldown.tickers).toEqual([]);
  });

  it("should return heatmap status", () => {
    const status = getSectorHeatmapStatus();
    expect(status).toHaveProperty("name");
    expect(status).toHaveProperty("status");
    expect(status).toHaveProperty("sectorsTracked");
    expect(typeof status.sectorsTracked).toBe("number");
  });
});

// ============================================================================
// Backtesting Tests
// ============================================================================
describe("Alpha Score Backtesting", () => {
  it("should return backtest results with required fields", () => {
    const results = getBacktestResults();
    expect(results).toHaveProperty("correlation");
    expect(results).toHaveProperty("tierAnalysis");
    expect(results).toHaveProperty("componentAnalysis");
    expect(results).toHaveProperty("cumulativeReturns");
    expect(results).toHaveProperty("summary");
    expect(results).toHaveProperty("generatedAt");
  });

  it("should have valid correlation value", () => {
    const results = getBacktestResults();
    expect(typeof results.correlation).toBe("number");
    expect(results.correlation).toBeGreaterThanOrEqual(-1);
    expect(results.correlation).toBeLessThanOrEqual(1);
  });

  it("should have tier analysis with valid structure", () => {
    const results = getBacktestResults();
    expect(Array.isArray(results.tierAnalysis)).toBe(true);
    expect(results.tierAnalysis.length).toBeGreaterThan(0);
    for (const tier of results.tierAnalysis) {
      expect(tier).toHaveProperty("tier");
      expect(tier).toHaveProperty("winRate");
      expect(tier).toHaveProperty("avgReturn");
      expect(tier).toHaveProperty("totalTrades");
      expect(tier).toHaveProperty("wins");
      expect(tier.winRate).toBeGreaterThanOrEqual(0);
      expect(tier.winRate).toBeLessThanOrEqual(100);
    }
  });

  it("should have component analysis data", () => {
    const results = getBacktestResults();
    expect(Array.isArray(results.componentAnalysis)).toBe(true);
    for (const comp of results.componentAnalysis) {
      expect(comp).toHaveProperty("component");
      expect(comp).toHaveProperty("label");
      expect(comp).toHaveProperty("correlation");
      expect(comp).toHaveProperty("avgContribution");
      expect(comp).toHaveProperty("bestPerforming");
    }
  });

  it("should have cumulative returns data with both strategies", () => {
    const results = getBacktestResults();
    expect(results.cumulativeReturns).toHaveProperty("alphaStrategy");
    expect(results.cumulativeReturns).toHaveProperty("sp500");
    expect(results.cumulativeReturns).toHaveProperty("alphaStrategyReturn");
    expect(results.cumulativeReturns).toHaveProperty("sp500Return");
    expect(results.cumulativeReturns).toHaveProperty("outperformance");
    expect(Array.isArray(results.cumulativeReturns.alphaStrategy)).toBe(true);
    expect(Array.isArray(results.cumulativeReturns.sp500)).toBe(true);
    expect(results.cumulativeReturns.alphaStrategy.length).toBeGreaterThan(0);
    for (const point of results.cumulativeReturns.alphaStrategy) {
      expect(point).toHaveProperty("date");
      expect(point).toHaveProperty("value");
      expect(typeof point.value).toBe("number");
    }
  });

  it("should compute cumulative returns for alpha strategy vs S&P 500", () => {
    const results = getBacktestResults();
    expect(typeof results.cumulativeReturns.alphaStrategyReturn).toBe("number");
    expect(typeof results.cumulativeReturns.sp500Return).toBe("number");
    expect(typeof results.cumulativeReturns.outperformance).toBe("number");
  });

  it("should have higher win rates for higher score tiers", () => {
    const results = getBacktestResults();
    const tiers = [...results.tierAnalysis].sort((a, b) => a.minScore - b.minScore);
    if (tiers.length >= 2) {
      const lowest = tiers[0];
      const highest = tiers[tiers.length - 1];
      expect(highest.winRate).toBeGreaterThanOrEqual(lowest.winRate);
    }
  });

  it("should have valid summary stats", () => {
    const results = getBacktestResults();
    expect(results.summary).toHaveProperty("totalPredictions");
    expect(results.summary).toHaveProperty("overallWinRate");
    expect(results.summary).toHaveProperty("sharpeRatio");
    expect(results.summary).toHaveProperty("maxDrawdown");
    expect(results.summary).toHaveProperty("profitFactor");
    expect(results.summary.totalPredictions).toBeGreaterThan(0);
    expect(results.summary.overallWinRate).toBeGreaterThanOrEqual(0);
    expect(results.summary.overallWinRate).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// Daily Digest Tests
// ============================================================================
describe("Daily Digest", () => {
  it("should return digest config with all fields", () => {
    const config = getDigestConfig();
    expect(config).toHaveProperty("enabled");
    expect(config).toHaveProperty("sendHour");
    expect(config).toHaveProperty("includeTopMovers");
    expect(config).toHaveProperty("includeArbitrageSignals");
    expect(config).toHaveProperty("includeJournalResults");
    expect(config).toHaveProperty("includeSectorSummary");
    expect(config).toHaveProperty("includeTopOpportunities");
    expect(typeof config.enabled).toBe("boolean");
    expect(typeof config.sendHour).toBe("number");
    expect(config.sendHour).toBeGreaterThanOrEqual(0);
    expect(config.sendHour).toBeLessThan(24);
  });

  it("should return a valid digest preview", () => {
    const preview = previewDigest();
    expect(preview).toHaveProperty("topMovers");
    expect(preview).toHaveProperty("arbitrageSignals");
    expect(preview).toHaveProperty("journalSummary");
    expect(preview).toHaveProperty("topOpportunities");
    expect(preview).toHaveProperty("summaryLine");
    expect(Array.isArray(preview.topMovers)).toBe(true);
    expect(Array.isArray(preview.arbitrageSignals)).toBe(true);
    expect(Array.isArray(preview.topOpportunities)).toBe(true);
    expect(typeof preview.summaryLine).toBe("string");
    expect(preview.summaryLine.length).toBeGreaterThan(0);
  });

  it("should have valid journal summary in preview", () => {
    const preview = previewDigest();
    expect(preview.journalSummary).toHaveProperty("totalResolved");
    expect(preview.journalSummary).toHaveProperty("correctPredictions");
    expect(preview.journalSummary).toHaveProperty("winRate");
    expect(preview.journalSummary).toHaveProperty("avgReturn");
    expect(typeof preview.journalSummary.winRate).toBe("number");
    expect(preview.journalSummary.winRate).toBeGreaterThanOrEqual(0);
    expect(preview.journalSummary.winRate).toBeLessThanOrEqual(100);
  });

  it("should return digest history as an array", () => {
    const history = getDigestHistory(10);
    expect(Array.isArray(history)).toBe(true);
    for (const entry of history) {
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("generatedAt");
      expect(entry).toHaveProperty("content");
      expect(typeof entry.id).toBe("string");
      expect(typeof entry.generatedAt).toBe("number");
    }
  });

  it("should return daily digest status", () => {
    const status = getDailyDigestStatus();
    expect(status).toHaveProperty("name", "Daily Digest");
    expect(status).toHaveProperty("status");
    expect(status).toHaveProperty("enabled");
    expect(status).toHaveProperty("sendHour");
    expect(status).toHaveProperty("totalSent");
    expect(["running", "stopped"]).toContain(status.status);
  });

  it("should have top movers with valid structure", () => {
    const preview = previewDigest();
    for (const mover of preview.topMovers) {
      expect(mover).toHaveProperty("ticker");
      expect(mover).toHaveProperty("score");
      expect(mover).toHaveProperty("change24h");
      expect(mover).toHaveProperty("direction");
      expect(typeof mover.ticker).toBe("string");
      expect(typeof mover.score).toBe("number");
    }
  });
});
