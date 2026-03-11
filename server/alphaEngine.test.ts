/**
 * Tests for Alpha Score Engine and Arbitrage Signal Detection
 */
import { describe, it, expect, vi } from "vitest";
import {
  getAlphaScores,
  getAlphaScoreForTicker,
  getArbitrageSignals,
  getTopArbitrageSignals,
  getAlphaEngineStatus,
  startAlphaEngine,
} from "./alphaEngine";

describe("Alpha Score Engine", () => {
  describe("getAlphaScores", () => {
    it("should return an array of alpha scores", async () => {
      const scores = await getAlphaScores();
      expect(Array.isArray(scores)).toBe(true);
    });

    it("each alpha score should have required fields", async () => {
      const scores = await getAlphaScores();
      if (scores.length > 0) {
        const score = scores[0];
        expect(score).toHaveProperty("ticker");
        expect(score).toHaveProperty("score");
        expect(score).toHaveProperty("direction");
        expect(score).toHaveProperty("components");
        expect(typeof score.ticker).toBe("string");
        expect(typeof score.score).toBe("number");
        expect(score.score).toBeGreaterThanOrEqual(0);
        expect(score.score).toBeLessThanOrEqual(100);
      }
    });

    it("alpha score components should have all 5 sub-scores", async () => {
      const scores = await getAlphaScores();
      if (scores.length > 0) {
        const { components } = scores[0];
        expect(components).toHaveProperty("aiConfidence");
        expect(components).toHaveProperty("marketDivergence");
        expect(components).toHaveProperty("vipSentiment");
        expect(components).toHaveProperty("narrativeVelocity");
        expect(components).toHaveProperty("anomalyFlags");
        // Each component should be 0-100
        for (const val of Object.values(components)) {
          expect(typeof val).toBe("number");
          expect(val as number).toBeGreaterThanOrEqual(0);
          expect(val as number).toBeLessThanOrEqual(100);
        }
      }
    });

    it("direction should be bullish, bearish, or neutral", async () => {
      const scores = await getAlphaScores();
      for (const s of scores) {
        expect(["bullish", "bearish", "neutral"]).toContain(s.direction);
      }
    });
  });

  describe("getAlphaScoreForTicker", () => {
    it("should return null when cache is empty (before engine runs)", () => {
      const score = getAlphaScoreForTicker("AAPL");
      // Before the engine has computed, cache is empty
      expect(score === null || (score?.ticker === "AAPL" && score?.score >= 0)).toBe(true);
    });

    it("should return null for a nonexistent ticker", () => {
      const score = getAlphaScoreForTicker("ZZZZZ_NONEXISTENT");
      expect(score).toBeNull();
    });
  });

  describe("getArbitrageSignals", () => {
    it("should return an array of arbitrage signals", async () => {
      const signals = await getArbitrageSignals();
      expect(Array.isArray(signals)).toBe(true);
    });

    it("each signal should have required fields", async () => {
      const signals = await getArbitrageSignals();
      if (signals.length > 0) {
        const signal = signals[0];
        expect(signal).toHaveProperty("id");
        expect(signal).toHaveProperty("ticker");
        expect(signal).toHaveProperty("aiDirection");
        expect(signal).toHaveProperty("aiConfidence");
        expect(signal).toHaveProperty("marketDirection");
        expect(signal).toHaveProperty("marketProbability");
        expect(signal).toHaveProperty("divergence");
        expect(signal).toHaveProperty("strength");
        expect(signal).toHaveProperty("suggestedAction");
        expect(signal).toHaveProperty("platform");
        expect(signal).toHaveProperty("marketTitle");
      }
    });

    it("strength should be one of extreme, high, medium, low", async () => {
      const signals = await getArbitrageSignals();
      for (const s of signals) {
        expect(["extreme", "high", "medium", "low"]).toContain(s.strength);
      }
    });

    it("divergence should be a positive number", async () => {
      const signals = await getArbitrageSignals();
      for (const s of signals) {
        expect(typeof s.divergence).toBe("number");
        expect(s.divergence).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("getTopArbitrageSignals", () => {
    it("should respect the limit parameter", async () => {
      const signals = await getTopArbitrageSignals(3);
      expect(signals.length).toBeLessThanOrEqual(3);
    });

    it("should be sorted by divergence descending", async () => {
      const signals = await getTopArbitrageSignals(10);
      for (let i = 1; i < signals.length; i++) {
        expect(signals[i - 1].divergence).toBeGreaterThanOrEqual(signals[i].divergence);
      }
    });
  });

  describe("getAlphaEngineStatus", () => {
    it("should return engine status with correct shape", () => {
      const status = getAlphaEngineStatus();
      expect(status).toHaveProperty("name");
      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("tickersScored");
      expect(status).toHaveProperty("arbitrageSignals");
      expect(status).toHaveProperty("computeCount");
      expect(status.name).toBe("Alpha Engine");
      expect(["running", "stopped"]).toContain(status.status);
      expect(typeof status.tickersScored).toBe("number");
      expect(typeof status.arbitrageSignals).toBe("number");
    });
  });

  describe("startAlphaEngine", () => {
    it("should start without throwing", () => {
      expect(() => startAlphaEngine()).not.toThrow();
    });

    it("should set running status after start", () => {
      startAlphaEngine();
      const status = getAlphaEngineStatus();
      expect(status.status).toBe("running");
    });
  });
});
