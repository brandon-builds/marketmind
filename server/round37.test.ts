import { describe, it, expect } from "vitest";
import {
  createStrategy,
  getStrategies,
  backtestStrategy,
  getStrategyBuilderStatus,
} from "./strategyBuilder";
import {
  computeCorrelationMatrix,
  getCorrelationMatrixStatus,
} from "./correlationMatrix";

describe("Strategy Builder", () => {
  describe("createStrategy", () => {
    it("should create a strategy with valid entry rules", () => {
      const strategy = createStrategy({
        name: "High Alpha Momentum",
        description: "Buy when alpha is high and smart money agrees",
        entryRules: {
          id: "entry-1",
          logic: "AND",
          rules: [
            { id: "r1", type: "alpha_score", operator: "above", value: 75, ticker: null, handle: null },
            { id: "r2", type: "smart_money", operator: "equals", value: "strong_buy", ticker: null, handle: null },
          ],
        },
        exitRules: null,
        action: "buy",
      });
      expect(strategy).toBeDefined();
      expect(strategy.name).toBe("High Alpha Momentum");
      expect(strategy.entryRules.rules.length).toBe(2);
      expect(strategy.id).toBeDefined();
      expect(strategy.createdAt).toBeDefined();
      expect(strategy.action).toBe("buy");
    });

    it("should assign unique IDs to strategies", () => {
      const s1 = createStrategy({
        name: "Strategy A",
        description: "Test",
        entryRules: { id: "e1", logic: "AND", rules: [{ id: "r1", type: "alpha_score", operator: "above", value: 50, ticker: null, handle: null }] },
        exitRules: null,
        action: "buy",
      });
      const s2 = createStrategy({
        name: "Strategy B",
        description: "Test",
        entryRules: { id: "e2", logic: "AND", rules: [{ id: "r1", type: "alpha_score", operator: "above", value: 60, ticker: null, handle: null }] },
        exitRules: null,
        action: "sell",
      });
      expect(s1.id).not.toBe(s2.id);
    });
  });

  describe("getStrategies", () => {
    it("should return an array of strategies", () => {
      const strategies = getStrategies();
      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
    });
  });

  describe("backtestStrategy", () => {
    it("should return backtest results with required fields", () => {
      const strategy = createStrategy({
        name: "Backtest Target",
        description: "For testing",
        entryRules: { id: "e1", logic: "AND", rules: [{ id: "r1", type: "alpha_score", operator: "above", value: 70, ticker: null, handle: null }] },
        exitRules: null,
        action: "buy",
      });
      const result = backtestStrategy(strategy.id, 30);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("totalTrades");
      expect(result).toHaveProperty("winRate");
      expect(result).toHaveProperty("totalReturn");
      expect(result).toHaveProperty("sharpeRatio");
      expect(result).toHaveProperty("maxDrawdown");
      expect(typeof result.totalTrades).toBe("number");
      expect(typeof result.winRate).toBe("number");
      expect(result.winRate).toBeGreaterThanOrEqual(0);
      expect(result.winRate).toBeLessThanOrEqual(100);
    });

    it("should return trades array in backtest results", () => {
      const strategy = createStrategy({
        name: "Trade List Test",
        description: "For testing trades",
        entryRules: { id: "e1", logic: "AND", rules: [{ id: "r1", type: "alpha_score", operator: "above", value: 60, ticker: null, handle: null }] },
        exitRules: null,
        action: "buy",
      });
      const result = backtestStrategy(strategy.id, 30);
      expect(result).toHaveProperty("tradeLog");
      expect(Array.isArray(result!.tradeLog)).toBe(true);
    });
  });

  describe("getStrategyBuilderStatus", () => {
    it("should return status with required fields", () => {
      const status = getStrategyBuilderStatus();
      expect(status).toBeDefined();
      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("totalStrategies");
      expect(typeof status.totalStrategies).toBe("number");
    });
  });
});

describe("Correlation Matrix", () => {
  describe("computeCorrelationMatrix", () => {
    it("should return a matrix with tickers and correlation values", () => {
      const result = computeCorrelationMatrix(30);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("tickers");
      expect(result).toHaveProperty("matrix");
      expect(result).toHaveProperty("diversificationScore");
      expect(result).toHaveProperty("clusters");
      expect(result).toHaveProperty("contagionRisks");
      expect(Array.isArray(result.tickers)).toBe(true);
      expect(Array.isArray(result.matrix)).toBe(true);
    });

    it("should return a square matrix matching ticker count", () => {
      const result = computeCorrelationMatrix(30);
      const n = result.tickers.length;
      expect(result.matrix.length).toBe(n);
      if (n > 0) {
        result.matrix.forEach((row: number[]) => {
          expect(row.length).toBe(n);
        });
      }
    });

    it("should have diagonal values of 1.0 (self-correlation)", () => {
      const result = computeCorrelationMatrix(30);
      for (let i = 0; i < result.tickers.length; i++) {
        expect(result.matrix[i][i]).toBeCloseTo(1.0, 1);
      }
    });

    it("should have symmetric correlation values", () => {
      const result = computeCorrelationMatrix(30);
      for (let i = 0; i < result.tickers.length; i++) {
        for (let j = 0; j < result.tickers.length; j++) {
          expect(result.matrix[i][j]).toBeCloseTo(result.matrix[j][i], 5);
        }
      }
    });

    it("should have correlation values between -1 and 1", () => {
      const result = computeCorrelationMatrix(30);
      for (let i = 0; i < result.tickers.length; i++) {
        for (let j = 0; j < result.tickers.length; j++) {
          expect(result.matrix[i][j]).toBeGreaterThanOrEqual(-1);
          expect(result.matrix[i][j]).toBeLessThanOrEqual(1);
        }
      }
    });

    it("should have diversification score between 0 and 100", () => {
      const result = computeCorrelationMatrix(30);
      expect(result.diversificationScore).toBeGreaterThanOrEqual(0);
      expect(result.diversificationScore).toBeLessThanOrEqual(100);
    });

    it("should return clusters as an array", () => {
      const result = computeCorrelationMatrix(30);
      expect(Array.isArray(result.clusters)).toBe(true);
      if (result.clusters.length > 0) {
        const cluster = result.clusters[0];
        expect(cluster).toHaveProperty("name");
        expect(cluster).toHaveProperty("tickers");
        expect(cluster).toHaveProperty("avgCorrelation");
        expect(cluster).toHaveProperty("riskLevel");
      }
    });

    it("should return contagion risks as an array", () => {
      const result = computeCorrelationMatrix(30);
      expect(Array.isArray(result.contagionRisks)).toBe(true);
      if (result.contagionRisks.length > 0) {
        const risk = result.contagionRisks[0];
        expect(risk).toHaveProperty("sourceTicker");
        expect(risk).toHaveProperty("affectedTickers");
        expect(risk).toHaveProperty("riskDescription");
      }
    });
  });

  describe("getCorrelationMatrixStatus", () => {
    it("should return status with required fields", () => {
      const status = getCorrelationMatrixStatus();
      expect(status).toBeDefined();
      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("tickersTracked");
      expect(typeof status.tickersTracked).toBe("number");
    });
  });
});
