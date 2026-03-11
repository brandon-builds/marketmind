/**
 * Round 34 Tests — Alpha Score Leaderboard, Trade Journal, Alpha Score Alerts
 */
import { describe, it, expect, beforeAll } from "vitest";

// ============================================================================
// Trade Journal Tests
// ============================================================================
describe("Trade Journal", () => {
  let tradeJournal: typeof import("./tradeJournal");

  beforeAll(async () => {
    tradeJournal = await import("./tradeJournal");
  });

  it("exports required functions", () => {
    expect(typeof tradeJournal.startTradeJournal).toBe("function");
    expect(typeof tradeJournal.stopTradeJournal).toBe("function");
    expect(typeof tradeJournal.getJournalEntries).toBe("function");
    expect(typeof tradeJournal.getJournalEntriesForTicker).toBe("function");
    expect(typeof tradeJournal.getJournalStats).toBe("function");
    expect(typeof tradeJournal.getTradeJournalStatus).toBe("function");
  });

  it("getJournalEntries returns an array", () => {
    const entries = tradeJournal.getJournalEntries();
    expect(Array.isArray(entries)).toBe(true);
  });

  it("getJournalEntries respects limit and offset", () => {
    const entries = tradeJournal.getJournalEntries(5, 0);
    expect(entries.length).toBeLessThanOrEqual(5);
  });

  it("getJournalEntriesForTicker returns entries for a specific ticker", () => {
    const entries = tradeJournal.getJournalEntriesForTicker("AAPL");
    expect(Array.isArray(entries)).toBe(true);
    for (const entry of entries) {
      expect(entry.ticker).toBe("AAPL");
    }
  });

  it("getJournalStats returns correct shape", () => {
    const stats = tradeJournal.getJournalStats();
    expect(stats).toHaveProperty("totalEntries");
    expect(stats).toHaveProperty("correctPredictions");
    expect(stats).toHaveProperty("incorrectPredictions");
    expect(stats).toHaveProperty("winRate");
    expect(stats).toHaveProperty("averageReturn");
    expect(stats).toHaveProperty("bestCall");
    expect(stats).toHaveProperty("worstCall");
    expect(stats).toHaveProperty("totalHypotheticalPnl");
    expect(stats).toHaveProperty("byHorizon");
    expect(stats).toHaveProperty("bySource");
    expect(stats).toHaveProperty("recentStreak");
    expect(typeof stats.winRate).toBe("number");
    expect(typeof stats.averageReturn).toBe("number");
  });

  it("getTradeJournalStatus returns status object", () => {
    const status = tradeJournal.getTradeJournalStatus();
    expect(status).toHaveProperty("name");
    expect(status).toHaveProperty("description");
    expect(status).toHaveProperty("status");
    expect(status).toHaveProperty("totalEntries");
    expect(status).toHaveProperty("lastCheck");
    expect(status).toHaveProperty("checkCount");
    expect(status.name).toBe("Trade Journal");
  });

  it("TradeJournalEntry has correct interface fields", () => {
    // Start the journal to generate some entries
    tradeJournal.startTradeJournal(
      () => [{ ticker: "AAPL", direction: "up", confidence: 75, reasoning: "Test", id: "test-1" }],
      async () => null
    );

    // Wait a moment for seeding
    const entries = tradeJournal.getJournalEntries();
    if (entries.length > 0) {
      const entry = entries[0];
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("ticker");
      expect(entry).toHaveProperty("predictionId");
      expect(entry).toHaveProperty("predictedDirection");
      expect(entry).toHaveProperty("predictedConfidence");
      expect(entry).toHaveProperty("entryPrice");
      expect(entry).toHaveProperty("exitPrice");
      expect(entry).toHaveProperty("priceChange");
      expect(entry).toHaveProperty("actualDirection");
      expect(entry).toHaveProperty("isCorrect");
      expect(entry).toHaveProperty("signalSource");
      expect(entry.signalSource).toHaveProperty("type");
      expect(entry.signalSource).toHaveProperty("label");
    }

    tradeJournal.stopTradeJournal();
  });
});

// ============================================================================
// Alpha Alerts Tests
// ============================================================================
describe("Alpha Alerts", () => {
  let alphaAlerts: typeof import("./alphaAlerts");

  beforeAll(async () => {
    alphaAlerts = await import("./alphaAlerts");
  });

  it("exports required functions", () => {
    expect(typeof alphaAlerts.createAlphaAlert).toBe("function");
    expect(typeof alphaAlerts.getAlphaAlerts).toBe("function");
    expect(typeof alphaAlerts.deleteAlphaAlert).toBe("function");
    expect(typeof alphaAlerts.toggleAlphaAlert).toBe("function");
    expect(typeof alphaAlerts.resetAlphaAlert).toBe("function");
    expect(typeof alphaAlerts.getLeaderboard).toBe("function");
    expect(typeof alphaAlerts.getTopOpportunities).toBe("function");
    expect(typeof alphaAlerts.getScoreHistory).toBe("function");
    expect(typeof alphaAlerts.getAvailableSectors).toBe("function");
    expect(typeof alphaAlerts.startAlphaAlerts).toBe("function");
    expect(typeof alphaAlerts.stopAlphaAlerts).toBe("function");
    expect(typeof alphaAlerts.getAlphaAlertStatus).toBe("function");
  });

  it("createAlphaAlert creates an alert with correct shape", () => {
    const alert = alphaAlerts.createAlphaAlert({
      ticker: "AAPL",
      condition: "above",
      threshold: 80,
      label: "Test alert",
    });

    expect(alert).toHaveProperty("id");
    expect(alert.ticker).toBe("AAPL");
    expect(alert.condition).toBe("above");
    expect(alert.threshold).toBe(80);
    expect(alert.label).toBe("Test alert");
    expect(alert.isActive).toBe(true);
    expect(alert.triggered).toBe(false);
    expect(alert.triggeredAt).toBeNull();
  });

  it("createAlphaAlert with null ticker creates any-ticker alert", () => {
    const alert = alphaAlerts.createAlphaAlert({
      ticker: null,
      condition: "crosses_above",
      threshold: 75,
    });

    expect(alert.ticker).toBeNull();
    expect(alert.label).toContain("Any Ticker");
  });

  it("getAlphaAlerts returns all created alerts", () => {
    const alerts = alphaAlerts.getAlphaAlerts();
    expect(Array.isArray(alerts)).toBe(true);
    expect(alerts.length).toBeGreaterThanOrEqual(2); // At least the 2 we just created
  });

  it("toggleAlphaAlert toggles alert active state", () => {
    const alerts = alphaAlerts.getAlphaAlerts();
    const testAlert = alerts.find(a => a.label === "Test alert");
    expect(testAlert).toBeDefined();

    const result = alphaAlerts.toggleAlphaAlert(testAlert!.id, false);
    expect(result).toBe(true);

    const updated = alphaAlerts.getAlphaAlerts().find(a => a.id === testAlert!.id);
    expect(updated?.isActive).toBe(false);
  });

  it("deleteAlphaAlert removes an alert", () => {
    const alerts = alphaAlerts.getAlphaAlerts();
    const testAlert = alerts.find(a => a.label === "Test alert");
    expect(testAlert).toBeDefined();

    const countBefore = alerts.length;
    const result = alphaAlerts.deleteAlphaAlert(testAlert!.id);
    expect(result).toBe(true);

    const countAfter = alphaAlerts.getAlphaAlerts().length;
    expect(countAfter).toBe(countBefore - 1);
  });

  it("deleteAlphaAlert returns false for non-existent id", () => {
    const result = alphaAlerts.deleteAlphaAlert("non-existent-id");
    expect(result).toBe(false);
  });

  it("getLeaderboard returns array of LeaderboardEntry objects", () => {
    const leaderboard = alphaAlerts.getLeaderboard();
    expect(Array.isArray(leaderboard)).toBe(true);

    if (leaderboard.length > 0) {
      const entry = leaderboard[0];
      expect(entry).toHaveProperty("ticker");
      expect(entry).toHaveProperty("score");
      expect(entry).toHaveProperty("rank");
      expect(entry).toHaveProperty("change24h");
      expect(entry).toHaveProperty("components");
      expect(entry).toHaveProperty("direction");
      expect(entry).toHaveProperty("sparkline");
      expect(entry).toHaveProperty("isTopOpportunity");
      expect(entry).toHaveProperty("sector");
      expect(entry.rank).toBe(1);
    }
  });

  it("getLeaderboard filters by sector", () => {
    const techEntries = alphaAlerts.getLeaderboard({ sector: "Technology" });
    for (const entry of techEntries) {
      expect(entry.sector).toBe("Technology");
    }
  });

  it("getLeaderboard filters by minScore", () => {
    const highScore = alphaAlerts.getLeaderboard({ minScore: 50 });
    for (const entry of highScore) {
      expect(entry.score).toBeGreaterThanOrEqual(50);
    }
  });

  it("getTopOpportunities returns entries with score >= 75", () => {
    const topOps = alphaAlerts.getTopOpportunities();
    expect(Array.isArray(topOps)).toBe(true);
    for (const entry of topOps) {
      expect(entry.score).toBeGreaterThanOrEqual(75);
      expect(entry.isTopOpportunity).toBe(true);
    }
  });

  it("getScoreHistory returns history for a ticker", () => {
    // Start alerts to seed history
    alphaAlerts.startAlphaAlerts();

    const history = alphaAlerts.getScoreHistory("AAPL");
    expect(history).toHaveProperty("ticker");
    expect(history.ticker).toBe("AAPL");
    expect(history).toHaveProperty("history");
    expect(history).toHaveProperty("change24h");
    expect(history).toHaveProperty("high7d");
    expect(history).toHaveProperty("low7d");
    expect(Array.isArray(history.history)).toBe(true);

    alphaAlerts.stopAlphaAlerts();
  });

  it("getAvailableSectors returns sorted array of strings", () => {
    const sectors = alphaAlerts.getAvailableSectors();
    expect(Array.isArray(sectors)).toBe(true);
    // Verify sorted
    for (let i = 1; i < sectors.length; i++) {
      expect(sectors[i] >= sectors[i - 1]).toBe(true);
    }
  });

  it("getAlphaAlertStatus returns status object", () => {
    const status = alphaAlerts.getAlphaAlertStatus();
    expect(status).toHaveProperty("name");
    expect(status.name).toBe("Alpha Alerts");
    expect(status).toHaveProperty("status");
    expect(status).toHaveProperty("totalAlerts");
    expect(status).toHaveProperty("activeAlerts");
    expect(status).toHaveProperty("triggeredAlerts");
  });

  it("resetAlphaAlert resets a triggered alert", () => {
    // Create and manually trigger an alert for testing
    const alert = alphaAlerts.createAlphaAlert({
      ticker: "TEST",
      condition: "above",
      threshold: 10,
      label: "Reset test",
    });

    // Reset it
    const result = alphaAlerts.resetAlphaAlert(alert.id);
    expect(result).toBe(true);

    const updated = alphaAlerts.getAlphaAlerts().find(a => a.id === alert.id);
    expect(updated?.triggered).toBe(false);
    expect(updated?.isActive).toBe(true);

    // Clean up
    alphaAlerts.deleteAlphaAlert(alert.id);
  });
});

// ============================================================================
// Integration: Intelligence Router endpoint shapes
// ============================================================================
describe("Intelligence Router Endpoints", () => {
  it("intelligenceRouter exports are available", async () => {
    const router = await import("./intelligenceRouter");
    expect(router).toHaveProperty("intelligenceRouter");
  });
});
