import { describe, it, expect } from "vitest";
import {
  exportTradeJournalCsv,
  exportTradeJournalJson,
  exportLeaderboardCsv,
  exportLeaderboardJson,
  exportBacktestCsv,
  exportBacktestJson,
} from "./exportService";

describe("Export Service", () => {
  describe("exportTradeJournalCsv", () => {
    it("should return CSV data with proper headers", () => {
      const result = exportTradeJournalCsv();
      expect(result.data).toBeTruthy();
      expect(result.filename).toMatch(/trade-journal.*\.csv/);
      expect(result.contentType).toBe("text/csv");
      // Check CSV has headers
      const lines = result.data.split("\n");
      expect(lines.length).toBeGreaterThan(1);
      const headers = lines[0];
      expect(headers).toContain("Ticker");
      expect(headers).toContain("Direction");
    });
  });

  describe("exportTradeJournalJson", () => {
    it("should return valid JSON data", () => {
      const result = exportTradeJournalJson();
      expect(result.data).toBeTruthy();
      expect(result.filename).toMatch(/trade-journal.*\.json/);
      expect(result.contentType).toBe("application/json");
      const parsed = JSON.parse(result.data);
      expect(parsed).toBeDefined();
      expect(parsed.entries).toBeDefined();
      expect(parsed.stats).toBeDefined();
      expect(parsed.exportedAt).toBeTruthy();
    });
  });

  describe("exportLeaderboardCsv", () => {
    it("should return CSV data with proper headers", () => {
      const result = exportLeaderboardCsv();
      expect(result.data).toBeTruthy();
      expect(result.filename).toMatch(/alpha-leaderboard.*\.csv/);
      expect(result.contentType).toBe("text/csv");
      const lines = result.data.split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(1); // At least header row
      const headers = lines[0];
      expect(headers).toContain("Ticker");
      expect(headers).toContain("Alpha Score");
    });
  });

  describe("exportLeaderboardJson", () => {
    it("should return valid JSON data", () => {
      const result = exportLeaderboardJson();
      expect(result.data).toBeTruthy();
      expect(result.filename).toMatch(/alpha-leaderboard.*\.json/);
      const parsed = JSON.parse(result.data);
      expect(parsed).toBeDefined();
      expect(parsed.leaderboard).toBeDefined();
      expect(parsed.exportedAt).toBeTruthy();
    });
  });

  describe("exportBacktestCsv", () => {
    it("should return CSV data for backtest results", () => {
      // Test with some mock backtest data
      const mockBacktest = {
        summary: {
          totalPredictions: 100,
          overallWinRate: 62.5,
          avgReturn: 3.2,
          sharpeRatio: 1.45,
          maxDrawdown: -8.3,
        },
        tierAnalysis: [
          { tier: "High Alpha (75+)", winRate: 72, avgReturn: 5.1, totalTrades: 30 },
          { tier: "Medium Alpha (50-74)", winRate: 58, avgReturn: 2.1, totalTrades: 45 },
        ],
      };
      const result = exportBacktestCsv(mockBacktest);
      expect(result.data).toBeTruthy();
      expect(result.filename).toMatch(/backtest.*\.csv/);
    });

    it("should handle null backtest data gracefully", () => {
      const result = exportBacktestCsv(null);
      expect(result.data).toBeTruthy();
      expect(result.data).toContain("No backtest");
    });
  });

  describe("exportBacktestJson", () => {
    it("should return valid JSON for backtest results", () => {
      const mockBacktest = {
        summary: { totalPredictions: 50, overallWinRate: 55 },
        tierAnalysis: [],
      };
      const result = exportBacktestJson(mockBacktest);
      expect(result.data).toBeTruthy();
      const parsed = JSON.parse(result.data);
      expect(parsed).toBeDefined();
    });

    it("should handle null backtest data", () => {
      const result = exportBacktestJson(null);
      expect(result.data).toBeTruthy();
    });
  });
});
