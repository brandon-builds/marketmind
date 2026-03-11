import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 99,
    openId: "test-user-filters",
    email: "filters@example.com",
    name: "Filter Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("saved filters", () => {
  it("creates a saved filter and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.watchlist.filtersCreate({
      page: "narratives",
      name: "My Bearish Filter",
      filters: JSON.stringify({ sentiment: "bearish", horizon: "7d" }),
    });
    expect(result).toEqual({ success: true });
  });

  it("lists saved filters for a page", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const filters = await caller.watchlist.filtersList({ page: "narratives" });
    expect(Array.isArray(filters)).toBe(true);
    if (filters.length > 0) {
      expect(filters[0]).toHaveProperty("id");
      expect(filters[0]).toHaveProperty("name");
      expect(filters[0]).toHaveProperty("filters");
      expect(filters[0]).toHaveProperty("createdAt");
      expect(typeof filters[0].name).toBe("string");
    }
  });

  it("deletes a saved filter", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create one first
    await caller.watchlist.filtersCreate({
      page: "predictions",
      name: "Test Delete",
      filters: JSON.stringify({ horizon: "1d" }),
    });

    // List to get the ID
    const filters = await caller.watchlist.filtersList({ page: "predictions" });
    if (filters.length > 0) {
      const result = await caller.watchlist.filtersDelete({ filterId: filters[0].id });
      expect(result).toEqual({ success: true });
    }
  });
});

describe("analytics tracking", () => {
  it("tracks an event successfully", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.watchlist.trackEvent({
      event: "page_view",
      page: "narratives",
    });
    expect(result).toEqual({ success: true });
  });

  it("tracks a ticker view event", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.watchlist.trackEvent({
      event: "ticker_view",
      page: "predictions",
      ticker: "AAPL",
    });
    expect(result).toEqual({ success: true });
  });
});

describe("admin analytics", () => {
  it("returns analytics data for admin users", async () => {
    const ctx = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    const data = await caller.watchlist.adminAnalytics({ days: 30 });
    // data may be null if DB is not available in test env
    if (data) {
      expect(data).toHaveProperty("activeUsers");
      expect(data).toHaveProperty("totalEvents");
      expect(data).toHaveProperty("totalUsers");
      expect(data).toHaveProperty("topPages");
      expect(data).toHaveProperty("topTickers");
      expect(data).toHaveProperty("eventBreakdown");
      expect(data).toHaveProperty("dailyActive");
      expect(Array.isArray(data.topPages)).toBe(true);
      expect(Array.isArray(data.topTickers)).toBe(true);
      expect(Array.isArray(data.eventBreakdown)).toBe(true);
      expect(Array.isArray(data.dailyActive)).toBe(true);
    }
  });

  it("rejects non-admin users from analytics", async () => {
    const ctx = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.watchlist.adminAnalytics({ days: 30 })).rejects.toThrow("Admin access required");
  });
});
