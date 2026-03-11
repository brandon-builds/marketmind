import { describe, it, expect } from "vitest";
import {
  scorePrediction,
  getImprovementDelta,
  getBaseline,
  EVALUATION_LOOKBACK_DAYS,
  NEUTRAL_THRESHOLD,
} from "./evaluationHarness";

describe("Evaluation Harness (Locked)", () => {
  describe("scorePrediction", () => {
    it("should return a PredictionEvaluation object with correct fields", () => {
      const result = scorePrediction("up", 100, 110, 0.8);
      expect(result).toHaveProperty("predictedDirection", "up");
      expect(result).toHaveProperty("actualDirection");
      expect(result).toHaveProperty("isCorrect");
      expect(result).toHaveProperty("confidence", 0.8);
      expect(result).toHaveProperty("priceAtPrediction", 100);
      expect(result).toHaveProperty("priceAtResolution", 110);
      expect(result).toHaveProperty("returnPercent");
      expect(result).toHaveProperty("horizonDays");
    });

    it("should mark correct direction as correct", () => {
      const result = scorePrediction("up", 100, 110, 0.8);
      expect(result.isCorrect).toBe(true);
      expect(result.actualDirection).toBe("up");
    });

    it("should mark incorrect direction as incorrect", () => {
      const result = scorePrediction("up", 100, 90, 0.8);
      expect(result.isCorrect).toBe(false);
      expect(result.actualDirection).toBe("down");
    });

    it("should detect correct down direction", () => {
      const result = scorePrediction("down", 100, 90, 0.7);
      expect(result.isCorrect).toBe(true);
      expect(result.actualDirection).toBe("down");
    });

    it("should handle neutral predictions when price barely moves", () => {
      const result = scorePrediction("neutral", 100, 100.005, 0.5);
      expect(result).toHaveProperty("isCorrect");
      expect(result).toHaveProperty("actualDirection");
      // Price moved less than NEUTRAL_THRESHOLD, so actual is neutral
      expect(result.actualDirection).toBe("neutral");
      expect(result.isCorrect).toBe(true);
    });

    it("should calculate return percent correctly", () => {
      const result = scorePrediction("up", 100, 110, 0.8);
      expect(result.returnPercent).toBeCloseTo(0.1, 4);
    });

    it("should handle zero-movement prices", () => {
      const result = scorePrediction("up", 100, 100, 0.6);
      expect(result.returnPercent).toBeCloseTo(0, 4);
      expect(result.actualDirection).toBe("neutral");
      expect(result.isCorrect).toBe(false); // predicted up, actual neutral
    });
  });

  describe("constants", () => {
    it("should have a 7-day lookback window", () => {
      expect(EVALUATION_LOOKBACK_DAYS).toBe(7);
    });

    it("should have a neutral threshold", () => {
      expect(typeof NEUTRAL_THRESHOLD).toBe("number");
      expect(NEUTRAL_THRESHOLD).toBeGreaterThan(0);
    });
  });

  describe("getImprovementDelta", () => {
    it("should return a delta object with required fields", async () => {
      const delta = await getImprovementDelta(0.65);
      expect(delta).toHaveProperty("currentAccuracy");
      expect(delta).toHaveProperty("baselineAccuracy");
      expect(delta).toHaveProperty("delta");
      expect(delta).toHaveProperty("hasBaseline");
      expect(delta).toHaveProperty("versionsPublished");
      expect(typeof delta.currentAccuracy).toBe("number");
      expect(typeof delta.delta).toBe("number");
    });
  });

  describe("getBaseline", () => {
    it("should return null or a baseline object with weights", async () => {
      const baseline = await getBaseline();
      if (baseline !== null) {
        expect(baseline).toHaveProperty("weights");
        expect(baseline).toHaveProperty("accuracy");
        expect(baseline).toHaveProperty("recordedAt");
      } else {
        expect(baseline).toBeNull();
      }
    });
  });
});
