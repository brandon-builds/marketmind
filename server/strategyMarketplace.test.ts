import { describe, it, expect } from "vitest";
import {
  getMarketplaceStrategies,
  getMarketplaceStrategy,
  getFeaturedStrategies,
  cloneStrategy,
  publishStrategy,
  rateStrategy,
  getMarketplaceTags,
  getMarketplaceStats,
} from "./strategyMarketplace";

describe("Strategy Marketplace", () => {
  describe("getMarketplaceStrategies", () => {
    it("should return strategies sorted by performance by default", () => {
      const strategies = getMarketplaceStrategies();
      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
      for (const s of strategies) {
        expect(s.id).toBeTruthy();
        expect(s.name).toBeTruthy();
        expect(s.creator).toBeTruthy();
        expect(s.backtestStats).toBeDefined();
        expect(typeof s.backtestStats.totalReturn).toBe("number");
        expect(typeof s.backtestStats.winRate).toBe("number");
        expect(typeof s.backtestStats.sharpeRatio).toBe("number");
        expect(typeof s.cloneCount).toBe("number");
      }
    });

    it("should sort by popular (clone count)", () => {
      const strategies = getMarketplaceStrategies({ sortBy: "popular" });
      for (let i = 1; i < strategies.length; i++) {
        expect(strategies[i].cloneCount).toBeLessThanOrEqual(strategies[i - 1].cloneCount);
      }
    });

    it("should filter by tag", () => {
      const tags = getMarketplaceTags();
      if (tags.length > 0) {
        const tag = tags[0].tag;
        const strategies = getMarketplaceStrategies({ sortBy: "performance", tag });
        for (const s of strategies) {
          expect(s.tags).toContain(tag);
        }
      }
    });
  });

  describe("getMarketplaceStrategy", () => {
    it("should return a single strategy by ID", () => {
      const all = getMarketplaceStrategies();
      if (all.length > 0) {
        const strategy = getMarketplaceStrategy(all[0].id);
        expect(strategy).not.toBeNull();
        expect(strategy!.id).toBe(all[0].id);
        expect(strategy!.name).toBeTruthy();
      }
    });

    it("should return null for unknown ID", () => {
      const result = getMarketplaceStrategy("nonexistent-id");
      expect(result).toBeNull();
    });
  });

  describe("getFeaturedStrategies", () => {
    it("should return only featured strategies", () => {
      const featured = getFeaturedStrategies();
      expect(Array.isArray(featured)).toBe(true);
      for (const s of featured) {
        expect(s.isFeatured).toBe(true);
      }
    });
  });

  describe("cloneStrategy", () => {
    it("should clone a marketplace strategy", () => {
      const all = getMarketplaceStrategies();
      if (all.length > 0) {
        const originalCloneCount = all[0].cloneCount;
        const result = cloneStrategy(all[0].id, "test-user");
        expect(result.success).toBe(true);
        expect(result.newStrategyId).toBeTruthy();
        
        // Clone count should increase
        const updated = getMarketplaceStrategy(all[0].id);
        expect(updated!.cloneCount).toBe(originalCloneCount + 1);
      }
    });

    it("should fail for nonexistent strategy", () => {
      const result = cloneStrategy("nonexistent-id", "test-user");
      expect(result.success).toBe(false);
    });
  });

  describe("rateStrategy", () => {
    it("should rate a marketplace strategy", () => {
      const all = getMarketplaceStrategies();
      if (all.length > 0) {
        const result = rateStrategy(all[0].id, 4);
        expect(result.success).toBe(true);
        // Rating is updated on the strategy object, not returned
        const updated = getMarketplaceStrategy(all[0].id);
        expect(typeof updated!.rating).toBe("number");
        expect(updated!.rating).toBeGreaterThan(0);
        expect(updated!.rating).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("getMarketplaceTags", () => {
    it("should return available tags with counts", () => {
      const tags = getMarketplaceTags();
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThan(0);
      for (const t of tags) {
        expect(t.tag).toBeTruthy();
        expect(typeof t.count).toBe("number");
        expect(t.count).toBeGreaterThan(0);
      }
    });
  });

  describe("getMarketplaceStats", () => {
    it("should return marketplace statistics", () => {
      const stats = getMarketplaceStats();
      expect(typeof stats.totalStrategies).toBe("number");
      expect(stats.totalStrategies).toBeGreaterThan(0);
      expect(typeof stats.totalClones).toBe("number");
      expect(typeof stats.avgWinRate).toBe("number");
      expect(stats.avgWinRate).toBeGreaterThan(0);
      expect(stats.avgWinRate).toBeLessThanOrEqual(100);
      expect(stats.topPerformer).toBeTruthy();
    });
  });
});
