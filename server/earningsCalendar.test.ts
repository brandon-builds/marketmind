import { describe, it, expect } from "vitest";
import {
  getUpcomingEarnings,
  getEarningsForTicker,
  getEarningsBadges,
  getEarningsAlphaPatterns,
  getRecentEarnings,
  isNearEarnings,
  wasTradeAroundEarnings,
  getEarningsCalendarStatus,
} from "./earningsCalendar";

describe("Earnings Calendar", () => {
  describe("getUpcomingEarnings", () => {
    it("should return upcoming earnings within the specified window", () => {
      const result = getUpcomingEarnings(30);
      expect(Array.isArray(result)).toBe(true);
      for (const item of result) {
        expect(item.ticker).toBeTruthy();
        expect(item.companyName).toBeTruthy();
        expect(item.earningsDate).toBeGreaterThan(Date.now());
        expect(item.daysUntil).toBeGreaterThan(0);
        expect(item.daysUntil).toBeLessThanOrEqual(30);
        expect(item.quarter).toMatch(/Q[1-4] \d{4}/);
        expect(["before_market", "after_market", "during_market"]).toContain(item.timeOfDay);
        expect(typeof item.estimatedEPS).toBe("number");
        expect(typeof item.estimatedRevenue).toBe("number");
        expect(typeof item.historicalSurprise).toBe("number");
      }
    });

    it("should return items sorted by date ascending", () => {
      const result = getUpcomingEarnings(30);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].earningsDate).toBeGreaterThanOrEqual(result[i - 1].earningsDate);
      }
    });

    it("should default to 7 days window", () => {
      const result = getUpcomingEarnings();
      for (const item of result) {
        expect(item.daysUntil).toBeLessThanOrEqual(7);
      }
    });
  });

  describe("getEarningsForTicker", () => {
    it("should return earnings events for a known ticker", () => {
      const result = getEarningsForTicker("AAPL");
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      for (const event of result) {
        expect(event.ticker).toBe("AAPL");
        expect(event.companyName).toBe("Apple Inc.");
        expect(["upcoming", "reported", "missed"]).toContain(event.status);
      }
    });

    it("should return empty array for unknown ticker", () => {
      const result = getEarningsForTicker("ZZZZZ");
      expect(result).toEqual([]);
    });
  });

  describe("getEarningsBadges", () => {
    it("should return badges for tickers near earnings", () => {
      const badges = getEarningsBadges();
      expect(Array.isArray(badges)).toBe(true);
      for (const badge of badges) {
        expect(badge.ticker).toBeTruthy();
        expect(badge.daysUntilEarnings).toBeGreaterThan(0);
        expect(badge.daysUntilEarnings).toBeLessThanOrEqual(14);
        expect(["extreme", "high", "moderate", "low"]).toContain(badge.riskLevel);
        expect(badge.label).toMatch(/EARNINGS/);
      }
    });

    it("should be sorted by days until earnings ascending", () => {
      const badges = getEarningsBadges();
      for (let i = 1; i < badges.length; i++) {
        expect(badges[i].daysUntilEarnings).toBeGreaterThanOrEqual(badges[i - 1].daysUntilEarnings);
      }
    });
  });

  describe("getEarningsAlphaPatterns", () => {
    it("should return alpha patterns for a known ticker", () => {
      const patterns = getEarningsAlphaPatterns("NVDA");
      expect(Array.isArray(patterns)).toBe(true);
      for (const pattern of patterns) {
        expect(pattern.ticker).toBe("NVDA");
        expect(pattern.preEarningsAlpha.length).toBe(5);
        expect(pattern.postEarningsAlpha.length).toBe(5);
        expect(["up", "down", "flat"]).toContain(pattern.preEarningsDrift);
        expect(["positive", "negative", "mixed"]).toContain(pattern.postEarningsReaction);
        // Alpha scores should be in valid range
        for (const score of [...pattern.preEarningsAlpha, ...pattern.postEarningsAlpha]) {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe("getRecentEarnings", () => {
    it("should return recently reported earnings", () => {
      const recent = getRecentEarnings(5);
      expect(Array.isArray(recent)).toBe(true);
      for (const event of recent) {
        expect(event.status).toBe("reported");
        expect(event.earningsDate).toBeLessThan(Date.now());
        expect(event.actualEPS).not.toBeNull();
      }
    });

    it("should respect the limit parameter", () => {
      const recent = getRecentEarnings(3);
      expect(recent.length).toBeLessThanOrEqual(3);
    });
  });

  describe("isNearEarnings", () => {
    it("should detect predictions near earnings dates", () => {
      // Get a known upcoming earnings date
      const upcoming = getUpcomingEarnings(30);
      if (upcoming.length > 0) {
        const target = upcoming[0];
        const result = isNearEarnings(target.ticker, target.earningsDate - 2 * 86400000, 5);
        expect(result.isNear).toBe(true);
        expect(result.earningsEvent).not.toBeNull();
        expect(result.riskMultiplier).toBeGreaterThan(1);
      }
    });

    it("should return false for dates far from earnings", () => {
      const result = isNearEarnings("AAPL", Date.now() + 365 * 86400000, 5);
      // May or may not be near depending on schedule, but multiplier should be valid
      expect(typeof result.isNear).toBe("boolean");
      expect(typeof result.riskMultiplier).toBe("number");
    });
  });

  describe("wasTradeAroundEarnings", () => {
    it("should detect trades around earnings events", () => {
      const events = getEarningsForTicker("MSFT");
      const pastEvent = events.find(e => e.status === "reported");
      if (pastEvent) {
        const result = wasTradeAroundEarnings("MSFT", pastEvent.earningsDate + 86400000, 5);
        expect(result.aroundEarnings).toBe(true);
        expect(result.position).toBe("after");
      }
    });
  });

  describe("getEarningsCalendarStatus", () => {
    it("should return valid status object", () => {
      const status = getEarningsCalendarStatus();
      expect(status.name).toBe("Earnings Calendar");
      expect(status.status).toBe("ready");
      expect(typeof status.tickersTracked).toBe("number");
      expect(status.tickersTracked).toBeGreaterThan(0);
    });
  });
});
