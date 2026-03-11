import { describe, it, expect } from "vitest";
import {
  getMultiTimeframeScores,
  getMultiTimeframeForTicker,
  getSmartMoneyFlows,
  getSmartMoneyForTicker,
  getMultiTimeframeStatus,
} from "./multiTimeframeAlpha";
import {
  getRebalanceSuggestions,
  getRebalanceSuggestionsByPriority,
  dismissSuggestion,
  getRebalanceStatus,
} from "./rebalanceSuggestions";

// ============================================================================
// Multi-Timeframe Alpha Score Engine
// ============================================================================

describe("Multi-Timeframe Alpha Score Engine", () => {
  it("getMultiTimeframeScores returns an array", () => {
    const scores = getMultiTimeframeScores();
    expect(Array.isArray(scores)).toBe(true);
  });

  it("each MTF score has required fields", () => {
    const scores = getMultiTimeframeScores();
    if (scores.length > 0) {
      const first = scores[0];
      expect(first).toHaveProperty("ticker");
      expect(first).toHaveProperty("timeframes");
      expect(first).toHaveProperty("tradeType");
      expect(first.timeframes).toHaveProperty("1h");
      expect(first.timeframes).toHaveProperty("4h");
      expect(first.timeframes).toHaveProperty("1w");
    }
  });

  it("each timeframe has score, direction, and change", () => {
    const scores = getMultiTimeframeScores();
    if (scores.length > 0) {
      const tf = scores[0].timeframes["1h"];
      expect(tf).toHaveProperty("score");
      expect(tf).toHaveProperty("direction");
      expect(tf).toHaveProperty("change");
      expect(typeof tf.score).toBe("number");
      expect(tf.score).toBeGreaterThanOrEqual(0);
      expect(tf.score).toBeLessThanOrEqual(100);
    }
  });

  it("tradeType is one of conviction, momentum, swing, mixed", () => {
    const scores = getMultiTimeframeScores();
    const validTypes = ["conviction", "momentum", "swing", "mixed"];
    for (const s of scores) {
      expect(validTypes).toContain(s.tradeType);
    }
  });

  it("getMultiTimeframeForTicker returns null for unknown ticker", () => {
    const result = getMultiTimeframeForTicker("ZZZZZ_UNKNOWN");
    expect(result).toBeNull();
  });

  it("getMultiTimeframeForTicker returns data for known ticker if cache populated", () => {
    const scores = getMultiTimeframeScores();
    if (scores.length > 0) {
      const result = getMultiTimeframeForTicker(scores[0].ticker);
      if (result) {
        expect(result.ticker).toBe(scores[0].ticker);
        expect(result).toHaveProperty("timeframes");
        expect(result).toHaveProperty("tradeType");
      }
    }
  });

  it("getMultiTimeframeStatus returns valid status object", () => {
    const status = getMultiTimeframeStatus();
    expect(status).toHaveProperty("name");
    expect(status).toHaveProperty("status");
    expect(["running", "stopped"]).toContain(status.status);
    expect(status).toHaveProperty("tickersTracked");
    expect(typeof status.tickersTracked).toBe("number");
    expect(status).toHaveProperty("smartMoneySignals");
  });
});

// ============================================================================
// Smart Money Flow
// ============================================================================

describe("Smart Money Flow", () => {
  it("getSmartMoneyFlows returns an array", () => {
    const flows = getSmartMoneyFlows();
    expect(Array.isArray(flows)).toBe(true);
  });

  it("each flow has required fields", () => {
    const flows = getSmartMoneyFlows();
    if (flows.length > 0) {
      const first = flows[0];
      expect(first).toHaveProperty("ticker");
      expect(first).toHaveProperty("signal");
      expect(first).toHaveProperty("compositeScore");
      expect(first).toHaveProperty("components");
      expect(first).toHaveProperty("confidence");
    }
  });

  it("signal is a valid smart money signal", () => {
    const flows = getSmartMoneyFlows();
    const validSignals = ["strong_buy", "buy", "neutral", "sell", "strong_sell"];
    for (const f of flows) {
      expect(validSignals).toContain(f.signal);
    }
  });

  it("compositeScore is between -100 and 100", () => {
    const flows = getSmartMoneyFlows();
    for (const f of flows) {
      expect(f.compositeScore).toBeGreaterThanOrEqual(-100);
      expect(f.compositeScore).toBeLessThanOrEqual(100);
    }
  });

  it("getSmartMoneyForTicker returns null for unknown ticker", () => {
    const result = getSmartMoneyForTicker("ZZZZZ_UNKNOWN");
    expect(result).toBeNull();
  });

  it("components include expected sub-scores", () => {
    const flows = getSmartMoneyFlows();
    if (flows.length > 0) {
      const comp = flows[0].components;
      expect(comp).toHaveProperty("vipSentiment");
      expect(comp).toHaveProperty("marketPosition");
      expect(comp).toHaveProperty("optionsFlow");
      expect(comp).toHaveProperty("institutional");
    }
  });
});

// ============================================================================
// Portfolio Rebalancing Suggestions
// ============================================================================

describe("Portfolio Rebalancing Suggestions", () => {
  it("getRebalanceSuggestions returns an array", () => {
    const suggestions = getRebalanceSuggestions();
    expect(Array.isArray(suggestions)).toBe(true);
  });

  it("each suggestion has required fields", () => {
    const suggestions = getRebalanceSuggestions();
    if (suggestions.length > 0) {
      const first = suggestions[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("ticker");
      expect(first).toHaveProperty("suggestedAction");
      expect(first).toHaveProperty("reason");
      expect(first).toHaveProperty("priority");
      expect(first).toHaveProperty("currentAlphaScore");
    }
  });

  it("priority is one of critical, high, medium, low", () => {
    const suggestions = getRebalanceSuggestions();
    const validPriorities = ["critical", "high", "medium", "low"];
    for (const s of suggestions) {
      expect(validPriorities).toContain(s.priority);
    }
  });

  it("suggestedAction is a valid action", () => {
    const suggestions = getRebalanceSuggestions();
    const validActions = ["reduce", "increase", "buy", "sell", "watch", "hedge"];
    for (const s of suggestions) {
      expect(validActions).toContain(s.suggestedAction);
    }
  });

  it("getRebalanceSuggestionsByPriority filters correctly", () => {
    const all = getRebalanceSuggestions();
    const critical = getRebalanceSuggestionsByPriority("critical");
    expect(critical.length).toBeLessThanOrEqual(all.length);
    for (const s of critical) {
      expect(s.priority).toBe("critical");
    }
  });

  it("dismissSuggestion returns false for unknown id", () => {
    const result = dismissSuggestion("nonexistent-id-12345");
    expect(result).toBe(false);
  });

  it("dismissSuggestion removes a suggestion", () => {
    const before = getRebalanceSuggestions();
    if (before.length > 0) {
      const id = before[0].id;
      const result = dismissSuggestion(id);
      expect(result).toBe(true);
      const after = getRebalanceSuggestions();
      expect(after.find(s => s.id === id)).toBeUndefined();
    }
  });

  it("getRebalanceStatus returns valid status object", () => {
    const status = getRebalanceStatus();
    expect(status).toHaveProperty("name");
    expect(status).toHaveProperty("status");
    expect(["running", "stopped"]).toContain(status.status);
    expect(status).toHaveProperty("activeSuggestions");
    expect(typeof status.activeSuggestions).toBe("number");
    expect(status).toHaveProperty("holdingsTracked");
  });
});
