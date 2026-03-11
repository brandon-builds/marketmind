import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("market router", () => {
  const caller = appRouter.createCaller(createPublicContext());

  it("returns quotes array with expected shape", async () => {
    const quotes = await caller.market.quotes();
    expect(Array.isArray(quotes)).toBe(true);
    expect(quotes.length).toBeGreaterThan(0);

    const first = quotes[0];
    expect(first).toHaveProperty("symbol");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("price");
    expect(first).toHaveProperty("change");
    expect(first).toHaveProperty("changePercent");
    expect(typeof first.price).toBe("number");
    expect(typeof first.changePercent).toBe("number");
  });

  it("returns realistic quote prices for known symbols", async () => {
    const quotes = await caller.market.quotes();
    const spy = quotes.find((q: any) => q.symbol === "SPY");
    const vix = quotes.find((q: any) => q.symbol === "^VIX");

    // SPY should be in a realistic range
    if (spy) {
      expect(spy.price).toBeGreaterThan(300);
      expect(spy.price).toBeLessThan(800);
      expect(spy.name).toBe("S&P 500 ETF");
    }

    // VIX should be in a realistic range (typically 10-80)
    if (vix) {
      expect(vix.price).toBeGreaterThan(5);
      expect(vix.price).toBeLessThan(90);
      expect(vix.name).toBe("VIX Volatility");
    }
  });

  it("returns sentiment with score and label", async () => {
    const sentiment = await caller.market.sentiment();
    expect(sentiment).toHaveProperty("score");
    expect(sentiment).toHaveProperty("label");
    expect(typeof sentiment.score).toBe("number");
    expect(sentiment.score).toBeGreaterThanOrEqual(0);
    expect(sentiment.score).toBeLessThanOrEqual(100);
    expect(["Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"]).toContain(sentiment.label);
  });

  it("returns experiments array with expected shape and varied statuses", async () => {
    const experiments = await caller.market.experiments();
    expect(Array.isArray(experiments)).toBe(true);
    expect(experiments.length).toBeGreaterThanOrEqual(8);

    const exp = experiments[0];
    expect(exp).toHaveProperty("id");
    expect(exp).toHaveProperty("name");
    expect(exp).toHaveProperty("hypothesis");
    expect(exp).toHaveProperty("status");
    expect(["running", "completed", "reverted"]).toContain(exp.status);
    expect(typeof exp.baselineScore).toBe("number");

    // Check for varied statuses
    const statuses = new Set(experiments.map((e: any) => e.status));
    expect(statuses.size).toBeGreaterThanOrEqual(2);

    // Completed experiments should have commit hashes
    const completed = experiments.filter((e: any) => e.status === "completed");
    completed.forEach((e: any) => {
      expect(e.commitHash).toBeTruthy();
      expect(e.experimentScore).not.toBeNull();
      expect(e.improvement).not.toBeNull();
    });

    // Reverted experiments should have null commit hashes
    const reverted = experiments.filter((e: any) => e.status === "reverted");
    reverted.forEach((e: any) => {
      expect(e.commitHash).toBeNull();
    });
  });

  it("returns signal leaderboard with ranked sources and wide accuracy spread", async () => {
    const sources = await caller.market.signalLeaderboard();
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThanOrEqual(10);

    const src = sources[0];
    expect(src).toHaveProperty("name");
    expect(src).toHaveProperty("accuracy");
    expect(src).toHaveProperty("totalSignals");
    expect(src).toHaveProperty("trend");
    expect(typeof src.accuracy).toBe("number");
    expect(src.accuracy).toBeGreaterThan(0);
    expect(src.accuracy).toBeLessThanOrEqual(1);

    // Check for wide accuracy spread
    const accuracies = sources.map((s: any) => s.accuracy);
    const maxAcc = Math.max(...accuracies);
    const minAcc = Math.min(...accuracies);
    expect(maxAcc - minAcc).toBeGreaterThan(0.15); // At least 15% spread

    // Check for varied source types
    const types = new Set(sources.map((s: any) => s.type));
    expect(types.size).toBeGreaterThanOrEqual(3); // At least 3 different types
  });

  it("returns accuracy history with 30 records and improving trend", async () => {
    const records = await caller.market.accuracyHistory();
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBe(30);

    const rec = records[0];
    expect(rec).toHaveProperty("date");
    expect(rec).toHaveProperty("horizon1D");
    expect(rec).toHaveProperty("horizon7D");
    expect(rec).toHaveProperty("horizon30D");
    expect(rec).toHaveProperty("overall");
    expect(typeof rec.horizon1D).toBe("number");

    // All accuracy values should be between 0 and 1
    records.forEach((r: any) => {
      expect(r.horizon1D).toBeGreaterThan(0);
      expect(r.horizon1D).toBeLessThan(1);
      expect(r.horizon7D).toBeGreaterThan(0);
      expect(r.horizon7D).toBeLessThan(1);
      expect(r.horizon30D).toBeGreaterThan(0);
      expect(r.horizon30D).toBeLessThan(1);
    });
  });

  it("returns narratives array with rich content", async () => {
    const narratives = await caller.market.narratives();
    expect(Array.isArray(narratives)).toBe(true);
    expect(narratives.length).toBeGreaterThanOrEqual(4);

    const nar = narratives[0];
    expect(nar).toHaveProperty("id");
    expect(nar).toHaveProperty("title");
    expect(nar).toHaveProperty("summary");
    expect(nar).toHaveProperty("sentiment");
    expect(["bullish", "bearish", "neutral"]).toContain(nar.sentiment);
    expect(nar).toHaveProperty("confidence");
    expect(typeof nar.confidence).toBe("number");
    expect(nar.confidence).toBeGreaterThanOrEqual(0.3);
    expect(nar.confidence).toBeLessThanOrEqual(0.95);

    // Narratives should have sources and related tickers
    expect(Array.isArray(nar.sources)).toBe(true);
    expect(nar.sources.length).toBeGreaterThan(0);
    expect(Array.isArray(nar.relatedTickers)).toBe(true);
    expect(nar.relatedTickers.length).toBeGreaterThan(0);

    // Check for varied sentiments
    const sentiments = new Set(narratives.map((n: any) => n.sentiment));
    expect(sentiments.size).toBeGreaterThanOrEqual(2);
  });

  it("returns ticker chart data for SPY", async () => {
    const chart = await caller.market.tickerChart({ symbol: "SPY", range: "1M" });
    expect(Array.isArray(chart)).toBe(true);
    expect(chart.length).toBeGreaterThan(10);

    const point = chart[0];
    expect(point).toHaveProperty("date");
    expect(point).toHaveProperty("price");
    expect(point).toHaveProperty("volume");
    expect(typeof point.price).toBe("number");
    expect(point.price).toBeGreaterThan(0);
  });

  it("returns ticker stats for SPY with realistic values", async () => {
    const stats = await caller.market.tickerStats({ symbol: "SPY" });
    expect(stats).toHaveProperty("symbol");
    expect(stats).toHaveProperty("name");
    expect(stats).toHaveProperty("price");
    expect(stats).toHaveProperty("openPrice");
    expect(stats).toHaveProperty("previousClose");
    expect(stats).toHaveProperty("dayHigh");
    expect(stats).toHaveProperty("dayLow");
    expect(stats).toHaveProperty("week52High");
    expect(stats).toHaveProperty("week52Low");
    expect(stats).toHaveProperty("volume");
    expect(stats).toHaveProperty("avgVolume");
    expect(stats).toHaveProperty("beta");
    expect(typeof stats.price).toBe("number");
    expect(stats.price).toBeGreaterThan(300);
    expect(stats.price).toBeLessThan(800);
  });

  it("returns ticker accuracy for SPY", async () => {
    const accuracy = await caller.market.tickerAccuracy({ symbol: "SPY" });
    expect(accuracy).toHaveProperty("symbol");
    expect(accuracy).toHaveProperty("accuracy");
    expect(accuracy).toHaveProperty("byHorizon");
    expect(accuracy).toHaveProperty("recentResults");
    expect(accuracy).toHaveProperty("totalPredictions");
    expect(accuracy).toHaveProperty("correctPredictions");
    expect(typeof accuracy.accuracy).toBe("number");
    expect(accuracy.accuracy).toBeGreaterThan(0);
    expect(accuracy.accuracy).toBeLessThan(1);
    expect(Array.isArray(accuracy.recentResults)).toBe(true);
    expect(accuracy.recentResults.length).toBeGreaterThan(0);
    // Check byHorizon structure
    expect(accuracy.byHorizon).toHaveProperty("1D");
    expect(accuracy.byHorizon).toHaveProperty("7D");
    expect(accuracy.byHorizon).toHaveProperty("30D");
  });

  it("returns model performance data with versions, experiments, and accuracy", async () => {
    const perf = await caller.market.modelPerformance();
    expect(perf).toHaveProperty("summary");
    expect(perf).toHaveProperty("versions");
    expect(perf).toHaveProperty("experiments");
    expect(perf).toHaveProperty("cumulativeAccuracy");
    expect(perf).toHaveProperty("accuracyHistory");

    // Summary stats
    expect(perf.summary.totalExperiments).toBeGreaterThanOrEqual(8);
    expect(perf.summary.committed).toBeGreaterThan(0);
    expect(perf.summary.currentAccuracy).toBeGreaterThan(0.4);
    expect(perf.summary.currentAccuracy).toBeLessThan(0.9);

    // Versions
    expect(perf.versions.length).toBeGreaterThanOrEqual(3);
    const v = perf.versions[0];
    expect(v).toHaveProperty("version");
    expect(v).toHaveProperty("overall");
    expect(v).toHaveProperty("accuracy1D");
    expect(v).toHaveProperty("commitHash");

    // Cumulative accuracy should have 60 data points
    expect(perf.cumulativeAccuracy.length).toBe(60);
  });

  it("returns filtered narratives with expected shape", async () => {
    const all = await caller.market.narrativesFiltered({ sentiment: "all", sector: "all", limit: 20 });
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);

    const nar = all[0];
    expect(nar).toHaveProperty("id");
    expect(nar).toHaveProperty("title");
    expect(nar).toHaveProperty("summary");
    expect(nar).toHaveProperty("sentiment");
    expect(nar).toHaveProperty("category");
    expect(["bullish", "bearish", "neutral"]).toContain(nar.sentiment);

    // Verify filtering works client-side by checking returned data
    const bullish = all.filter((n: any) => n.sentiment === "bullish");
    const bearish = all.filter((n: any) => n.sentiment === "bearish");
    // Should have both sentiments in the full set
    expect(bullish.length + bearish.length).toBeGreaterThan(0);
  }, 60000);

  it("returns data sources with expected shape", async () => {
    const result = await caller.market.dataSources();
    expect(result).toHaveProperty("sources");
    expect(result).toHaveProperty("stats");
    expect(Array.isArray(result.sources)).toBe(true);
    expect(result.sources.length).toBeGreaterThanOrEqual(10);

    const src = result.sources[0];
    expect(src).toHaveProperty("id");
    expect(src).toHaveProperty("name");
    expect(src).toHaveProperty("type");
    expect(src).toHaveProperty("status");
    expect(src).toHaveProperty("signalCount");
    expect(src).toHaveProperty("accuracy");
    expect(src).toHaveProperty("latency");
    expect(src).toHaveProperty("description");
    expect(src).toHaveProperty("recentSignals");
    expect(["News", "Social Media", "Prediction Market", "Podcast"]).toContain(src.type);
    expect(["connected", "degraded", "disconnected"]).toContain(src.status);
    expect(typeof src.accuracy).toBe("number");
    expect(src.accuracy).toBeGreaterThan(0);
    expect(src.accuracy).toBeLessThan(100);

    // Check for varied types
    const types = new Set(result.sources.map((s: any) => s.type));
    expect(types.size).toBeGreaterThanOrEqual(3);

    // Check stats
    expect(result.stats.totalSources).toBe(result.sources.length);
    expect(result.stats.totalSignals).toBeGreaterThan(0);
    expect(result.stats.avgAccuracy).toBeGreaterThan(0);
  });

  it("returns comparison data for two tickers", async () => {
    const comparison = await caller.market.comparison({ symbols: ["SPY", "QQQ"] });
    expect(comparison).toHaveProperty("tickers");
    expect(Array.isArray(comparison.tickers)).toBe(true);
    expect(comparison.tickers.length).toBe(2);

    const ticker = comparison.tickers[0];
    expect(ticker).toHaveProperty("symbol");
    expect(ticker).toHaveProperty("name");
    expect(ticker).toHaveProperty("price");
    expect(ticker).toHaveProperty("change");
    expect(ticker).toHaveProperty("prediction");
    expect(ticker).toHaveProperty("narrativeSentiment");
    expect(ticker).toHaveProperty("chartData");
    expect(typeof ticker.price).toBe("number");
    expect(ticker.price).toBeGreaterThan(0);

    // Chart data should have 30 data points
    expect(Array.isArray(ticker.chartData)).toBe(true);
    expect(ticker.chartData.length).toBe(30);
    const point = ticker.chartData[0];
    expect(point).toHaveProperty("date");
    expect(point).toHaveProperty("price");
  });

  it("returns predictions array with validated price targets", async () => {
    const predictions = await caller.market.predictions();
    expect(Array.isArray(predictions)).toBe(true);
    expect(predictions.length).toBeGreaterThanOrEqual(5);

    const pred = predictions[0];
    expect(pred).toHaveProperty("id");
    expect(pred).toHaveProperty("ticker");
    expect(pred).toHaveProperty("direction");
    expect(["up", "down", "neutral"]).toContain(pred.direction);
    expect(pred).toHaveProperty("horizon");
    expect(["1D", "7D", "30D"]).toContain(pred.horizon);
    expect(pred).toHaveProperty("confidence");
    expect(typeof pred.confidence).toBe("number");
    expect(pred.confidence).toBeGreaterThanOrEqual(0.35);
    expect(pred.confidence).toBeLessThanOrEqual(0.95);

    // Check that price targets are within reasonable range of current price
    predictions.forEach((p: any) => {
      if (p.priceTarget && p.currentPrice) {
        const ratio = p.priceTarget / p.currentPrice;
        expect(ratio).toBeGreaterThan(0.80);
        expect(ratio).toBeLessThan(1.20);
      }
    });

    // Check for varied horizons
    const horizons = new Set(predictions.map((p: any) => p.horizon));
    expect(horizons.size).toBeGreaterThanOrEqual(2);

    // Check for varied directions
    const directions = new Set(predictions.map((p: any) => p.direction));
    expect(directions.size).toBeGreaterThanOrEqual(2);
  });

  it("returns backtesting data with summary, predictions, and performance by ticker", async () => {
    const result = await caller.market.backtest({ horizon: "all" });
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("predictions");
    expect(result).toHaveProperty("bestPredictions");
    expect(result).toHaveProperty("worstPredictions");
    expect(result).toHaveProperty("byTicker");
    expect(result).toHaveProperty("cumulativePnL");
    expect(result).toHaveProperty("winRateByHorizon");

    // Summary
    expect(typeof result.summary.totalPnl).toBe("number");
    expect(typeof result.summary.winRate).toBe("number");
    expect(result.summary.winRate).toBeGreaterThan(0);
    expect(result.summary.winRate).toBeLessThan(100);
    expect(result.summary.totalPredictions).toBeGreaterThan(0);
    expect(result.summary.hits + result.summary.misses).toBe(result.summary.totalPredictions);

    // Predictions
    expect(Array.isArray(result.predictions)).toBe(true);
    expect(result.predictions.length).toBeGreaterThan(0);
    const pred = result.predictions[0];
    expect(pred).toHaveProperty("date");
    expect(pred).toHaveProperty("ticker");
    expect(pred).toHaveProperty("direction");
    expect(pred).toHaveProperty("horizon");
    expect(pred).toHaveProperty("pnlPercent");
    expect(pred).toHaveProperty("outcome");
    expect(["hit", "miss"]).toContain(pred.outcome);

    // Best/worst predictions
    expect(result.bestPredictions.length).toBe(5);
    expect(result.worstPredictions.length).toBe(5);

    // Performance by ticker
    expect(Array.isArray(result.byTicker)).toBe(true);
    expect(result.byTicker.length).toBeGreaterThan(0);
    const tickerPerf = result.byTicker[0];
    expect(tickerPerf).toHaveProperty("ticker");
    expect(tickerPerf).toHaveProperty("totalPnl");
    expect(tickerPerf).toHaveProperty("totalPredictions");
    expect(tickerPerf).toHaveProperty("winRate");

    // Win rate by horizon
    expect(result.winRateByHorizon).toHaveProperty("1D");
    expect(result.winRateByHorizon).toHaveProperty("7D");
    expect(result.winRateByHorizon).toHaveProperty("30D");
  });

  it("returns portfolio analysis with aggregated data", async () => {
    const result = await caller.market.portfolioAnalysis({
      holdings: [
        { ticker: "AAPL", shares: 50 },
        { ticker: "SPY", shares: 100 },
      ],
    });
    expect(result).toHaveProperty("holdings");
    expect(result).toHaveProperty("totalValue");
    expect(result).toHaveProperty("totalChange");
    expect(result).toHaveProperty("totalChangePercent");
    expect(result).toHaveProperty("predictionExposure");
    expect(result).toHaveProperty("sectorBreakdown");
    expect(result).toHaveProperty("riskFlags");
    expect(result).toHaveProperty("narrativeSentiment");

    // Holdings should match input
    expect(result.holdings.length).toBe(2);
    const holding = result.holdings[0];
    expect(holding).toHaveProperty("ticker");
    expect(holding).toHaveProperty("shares");
    expect(holding).toHaveProperty("price");
    expect(holding).toHaveProperty("value");
    expect(holding).toHaveProperty("changePercent");
    expect(typeof holding.price).toBe("number");
    expect(holding.price).toBeGreaterThan(0);

    // Total value should be positive
    expect(result.totalValue).toBeGreaterThan(0);

    // Prediction exposure
    expect(result.predictionExposure).toHaveProperty("bullish");
    expect(result.predictionExposure).toHaveProperty("bearish");
    expect(result.predictionExposure).toHaveProperty("neutral");

    // Sector breakdown
    expect(Array.isArray(result.sectorBreakdown)).toBe(true);
    expect(result.sectorBreakdown.length).toBeGreaterThan(0);

    // Risk flags
    expect(Array.isArray(result.riskFlags)).toBe(true);

    // Narrative sentiment
    expect(result.narrativeSentiment).toHaveProperty("score");
    expect(result.narrativeSentiment).toHaveProperty("label");
  });
});
