import { describe, it, expect } from "vitest";
import {
  getSecEdgarStatus, getFredStatus, getPolymarketStatus,
  getStockTwitsStatus, getCboeVixStatus, getGoogleTrendsStatus,
  getCongressionalStatus,
} from "./realDataSources";

describe("Real Data Sources", () => {
  describe("SEC EDGAR", () => {
    it("should return a status object with correct structure", async () => {
      const status = await getSecEdgarStatus();
      expect(status).toHaveProperty("name");
      expect(status).toHaveProperty("source", "sec_edgar");
      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("description");
      expect(status).toHaveProperty("apiKeyRequired", false);
      expect(status).toHaveProperty("recentSignalCount");
      expect(typeof status.recentSignalCount).toBe("number");
    });

    it("should have the correct name", async () => {
      const status = await getSecEdgarStatus();
      expect(status.name).toBe("SEC EDGAR (Insider Trading)");
    });
  });

  describe("Polymarket", () => {
    it("should return a status object with correct structure", async () => {
      const status = await getPolymarketStatus();
      expect(status).toHaveProperty("name");
      expect(status).toHaveProperty("source", "polymarket");
      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("apiKeyRequired", false);
    });

    it("should have the correct name", async () => {
      const status = await getPolymarketStatus();
      expect(status.name).toBe("Polymarket (Prediction Markets)");
    });
  });

  describe("StockTwits", () => {
    it("should return a status object with correct structure", async () => {
      const status = await getStockTwitsStatus();
      expect(status).toHaveProperty("name");
      expect(status).toHaveProperty("source", "stocktwits");
      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("apiKeyRequired", false);
    });
  });

  describe("CBOE VIX", () => {
    it("should return a status object with correct structure", async () => {
      const status = await getCboeVixStatus();
      expect(status).toHaveProperty("name");
      expect(status).toHaveProperty("source", "cboe_vix");
      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("apiKeyRequired", false);
    });
  });

  describe("Google Trends", () => {
    it("should return a status object with correct structure", async () => {
      const status = await getGoogleTrendsStatus();
      expect(status).toHaveProperty("name");
      expect(status).toHaveProperty("source", "google_trends");
      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("apiKeyRequired", false);
    });
  });

  describe("FRED Macro", () => {
    it("should return a status object indicating needs_api_key when no key set", async () => {
      const status = await getFredStatus();
      expect(status).toHaveProperty("name");
      expect(status).toHaveProperty("source", "fred_macro");
      expect(status).toHaveProperty("apiKeyRequired", true);
      expect(status).toHaveProperty("apiKeyName", "FRED_API_KEY");
    });
  });

  describe("Congressional Trading", () => {
    it("should return a status object", async () => {
      const status = await getCongressionalStatus();
      expect(status).toHaveProperty("name");
      expect(status).toHaveProperty("source", "congressional");
      expect(status).toHaveProperty("status");
    });
  });
});
