import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-watchlist",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
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

describe("watchlist router", () => {
  it("add returns success with uppercase ticker", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.watchlist.add({ ticker: "aapl" });
    expect(result).toEqual({ success: true, ticker: "AAPL" });
  });

  it("list returns array of watchlist items", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const items = await caller.watchlist.list();
    expect(Array.isArray(items)).toBe(true);
    if (items.length > 0) {
      expect(items[0]).toHaveProperty("ticker");
      expect(items[0]).toHaveProperty("addedAt");
      expect(typeof items[0].ticker).toBe("string");
      expect(typeof items[0].addedAt).toBe("number");
    }
  });

  it("remove returns success with uppercase ticker", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.watchlist.remove({ ticker: "aapl" });
    expect(result).toEqual({ success: true, ticker: "AAPL" });
  });
});

describe("portfolio router", () => {
  it("portfolioUpsert returns success with ticker and shares", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.watchlist.portfolioUpsert({
      ticker: "msft",
      shares: 25,
    });
    expect(result).toEqual({ success: true, ticker: "MSFT", shares: 25 });
  });

  it("portfolioList returns array of holdings", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const items = await caller.watchlist.portfolioList();
    expect(Array.isArray(items)).toBe(true);
    if (items.length > 0) {
      expect(items[0]).toHaveProperty("ticker");
      expect(items[0]).toHaveProperty("shares");
      expect(items[0]).toHaveProperty("addedAt");
      expect(items[0]).toHaveProperty("updatedAt");
      expect(typeof items[0].shares).toBe("number");
    }
  });

  it("portfolioRemove returns success with uppercase ticker", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.watchlist.portfolioRemove({ ticker: "msft" });
    expect(result).toEqual({ success: true, ticker: "MSFT" });
  });
});
