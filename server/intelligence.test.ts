import { describe, it, expect } from "vitest";

// ============================================================================
// VIP Account Monitor Tests
// ============================================================================

describe("VIP Account Monitor", () => {
  it("should export all required functions", async () => {
    const mod = await import("./vipAccountMonitor");
    expect(typeof mod.startVipMonitor).toBe("function");
    expect(typeof mod.getVipMonitorStatus).toBe("function");
    // generateCamilloSignal is inline logic in the monitor, not a separate export
    expect(typeof mod.seedDefaultAccounts).toBe("function");
    expect(typeof mod.getWatchedAccounts).toBe("function");
    expect(typeof mod.addWatchedAccount).toBe("function");
    expect(typeof mod.updateWatchedAccount).toBe("function");
    expect(typeof mod.removeWatchedAccount).toBe("function");
    expect(typeof mod.getRecentVipTweets).toBe("function");
    expect(typeof mod.getVipTweetsForAccount).toBe("function");
    expect(typeof mod.getVipStats).toBe("function");
  });

  it("getVipMonitorStatus returns correct shape", async () => {
    const { getVipMonitorStatus } = await import("./vipAccountMonitor");
    const status = getVipMonitorStatus();
    expect(status).toHaveProperty("isRunning");
    expect(status).toHaveProperty("lastGenerated");
    expect(status).toHaveProperty("totalGenerated");
    expect(status).toHaveProperty("intervalActive");
    expect(typeof status.isRunning).toBe("boolean");
    expect(typeof status.totalGenerated).toBe("number");
    expect(typeof status.intervalActive).toBe("boolean");
  });

  it("DEFAULT_VIP_ACCOUNTS has curated accounts", async () => {
    const { DEFAULT_VIP_ACCOUNTS } = await import("./vipAccountMonitor");
    expect(Array.isArray(DEFAULT_VIP_ACCOUNTS)).toBe(true);
    expect(DEFAULT_VIP_ACCOUNTS.length).toBeGreaterThan(10);

    // Check key accounts exist
    const handles = DEFAULT_VIP_ACCOUNTS.map((a: any) => a.handle);
    expect(handles).toContain("chriscamillo");
    expect(handles).toContain("elonmusk");
    expect(handles).toContain("CathieDWood");
    expect(handles).toContain("BillAckman");
    expect(handles).toContain("jimcramer");
    expect(handles).toContain("unusual_whales");
  });

  it("VIP accounts have 3-5x weight multiplier", async () => {
    const { DEFAULT_VIP_ACCOUNTS } = await import("./vipAccountMonitor");
    for (const account of DEFAULT_VIP_ACCOUNTS) {
      expect((account as any).weightMultiplier).toBeGreaterThanOrEqual(3);
      expect((account as any).weightMultiplier).toBeLessThanOrEqual(5);
    }
  });

  it("accounts have proper categories", async () => {
    const { DEFAULT_VIP_ACCOUNTS } = await import("./vipAccountMonitor");
    const validCategories = ["investor_trader", "economist_fed", "politician_policy", "tech_leader", "financial_media"];
    for (const account of DEFAULT_VIP_ACCOUNTS) {
      expect(validCategories).toContain((account as any).category);
    }
  });
});

// ============================================================================
// Trending Topics Tests
// ============================================================================

describe("Trending Topics", () => {
  it("should export all required functions", async () => {
    const mod = await import("./trendingTopics");
    expect(typeof mod.startTrendingIngestion).toBe("function");
    expect(typeof mod.stopTrendingIngestion).toBe("function");
    expect(typeof mod.getTrendingIngestionStatus).toBe("function");
    expect(typeof mod.getCurrentTrending).toBe("function");
    expect(typeof mod.getTrendingHistory).toBe("function");
    expect(typeof mod.getTrendingStats).toBe("function");
  });

  it("getTrendingIngestionStatus returns correct shape", async () => {
    const { getTrendingIngestionStatus } = await import("./trendingTopics");
    const status = getTrendingIngestionStatus();
    expect(status).toHaveProperty("isActive");
    expect(status).toHaveProperty("lastRefresh");
    expect(status).toHaveProperty("cycleCount");
    expect(typeof status.isActive).toBe("boolean");
    expect(typeof status.cycleCount).toBe("number");
  });
});

// ============================================================================
// Prediction Markets Tests
// ============================================================================

describe("Prediction Markets", () => {
  it("should export all required functions", async () => {
    const mod = await import("./predictionMarkets");
    expect(typeof mod.startPredictionMarketIngestion).toBe("function");
    expect(typeof mod.stopPredictionMarketIngestion).toBe("function");
    expect(typeof mod.getPredictionMarketIngestionStatus).toBe("function");
    expect(typeof mod.getActiveMarkets).toBe("function");
    expect(typeof mod.getHotMarkets).toBe("function");
    expect(typeof mod.getMarketsForTicker).toBe("function");
    expect(typeof mod.getMarketStats).toBe("function");
  });

  it("getPredictionMarketIngestionStatus returns correct shape", async () => {
    const { getPredictionMarketIngestionStatus } = await import("./predictionMarkets");
    const status = getPredictionMarketIngestionStatus();
    expect(status).toHaveProperty("isActive");
    expect(status).toHaveProperty("lastFetch");
    expect(status).toHaveProperty("fetchCycleCount");
    expect(status).toHaveProperty("realDataAvailable");
    expect(typeof status.isActive).toBe("boolean");
    expect(typeof status.fetchCycleCount).toBe("number");
    expect(typeof status.realDataAvailable).toBe("boolean");
  });
});

// ============================================================================
// Intelligence Router Tests
// ============================================================================

describe("Intelligence Router", () => {
  it("should export intelligenceRouter", async () => {
    const mod = await import("./intelligenceRouter");
    expect(mod.intelligenceRouter).toBeDefined();
  });
});

// ============================================================================
// Schema Tests
// ============================================================================

describe("Database Schema - New Tables", () => {
  it("should export signal_sources table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.signalSources).toBeDefined();
  });

  it("should export vip_tweets table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.vipTweets).toBeDefined();
  });

  it("should export trending_topics table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.trendingTopics).toBeDefined();
  });

  it("should export prediction_markets table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.predictionMarkets).toBeDefined();
  });
});

// ============================================================================
// Integration: Agent Status Aggregation
// ============================================================================

describe("Agent Status Aggregation", () => {
  it("all agent status functions return consistent shape with name and status", async () => {
    const { getResearchAgentStatus } = await import("./researchAgent");
    const { getImprovementStatus } = await import("./improvementAgent");
    const { getIngestionStatus } = await import("./realIngestion");

    const statuses = [
      getResearchAgentStatus(),
      getImprovementStatus(),
      getIngestionStatus(),
    ];

    for (const s of statuses) {
      // These all have isRunning
      expect(typeof (s as any).isRunning === "boolean" || typeof (s as any).isTraining === "boolean").toBe(true);
    }
  });

  it("VIP monitor status is consistent", async () => {
    const { getVipMonitorStatus } = await import("./vipAccountMonitor");
    const status = getVipMonitorStatus();
    expect(typeof status.isRunning).toBe("boolean");
    expect(typeof status.totalGenerated).toBe("number");
  });

  it("Trending status is consistent", async () => {
    const { getTrendingIngestionStatus } = await import("./trendingTopics");
    const status = getTrendingIngestionStatus();
    expect(typeof status.isActive).toBe("boolean");
    expect(typeof status.cycleCount).toBe("number");
  });

  it("Prediction market status is consistent", async () => {
    const { getPredictionMarketIngestionStatus } = await import("./predictionMarkets");
    const status = getPredictionMarketIngestionStatus();
    expect(typeof status.isActive).toBe("boolean");
    expect(typeof status.fetchCycleCount).toBe("number");
  });
});
