import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-schedules",
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

describe("scheduled reports", () => {
  it("schedulesList returns an array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const schedules = await caller.watchlist.schedulesList();
    expect(Array.isArray(schedules)).toBe(true);
  });

  it("full CRUD lifecycle for scheduled reports", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create
    const createResult = await caller.watchlist.schedulesCreate({
      name: "Test Weekly Report",
      frequency: "weekly_friday",
      sections: ["watchlist", "predictions", "narratives"],
      deliveryMethod: "notification",
    });
    expect(createResult).toHaveProperty("success", true);

    // List and find the created schedule
    const schedules = await caller.watchlist.schedulesList();
    expect(schedules.length).toBeGreaterThanOrEqual(1);
    const found = schedules.find((s: any) => s.name === "Test Weekly Report");
    expect(found).toBeDefined();
    expect(found!.frequency).toBe("weekly_friday");
    expect(found!.sections).toContain("watchlist");
    expect(found!.sections).toContain("predictions");
    expect(found!.enabled).toBe(true);

    // Update (pause)
    const updateResult = await caller.watchlist.schedulesUpdate({
      scheduleId: found!.id,
      enabled: false,
    });
    expect(updateResult).toHaveProperty("success", true);

    // Verify paused
    const updated = await caller.watchlist.schedulesList();
    const paused = updated.find((s: any) => s.id === found!.id);
    expect(paused!.enabled).toBe(false);

    // Delete
    const deleteResult = await caller.watchlist.schedulesDelete({
      scheduleId: found!.id,
    });
    expect(deleteResult).toHaveProperty("success", true);

    // Verify deleted
    const remaining = await caller.watchlist.schedulesList();
    const gone = remaining.find((s: any) => s.id === found!.id);
    expect(gone).toBeUndefined();
  });

  it("creates schedule with email delivery method", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.watchlist.schedulesCreate({
      name: "Email Report",
      frequency: "daily",
      sections: ["portfolio", "market_overview"],
      deliveryMethod: "notification,email",
      deliveryEmail: "test@example.com",
    });
    expect(result).toHaveProperty("success", true);

    const schedules = await caller.watchlist.schedulesList();
    const found = schedules.find((s: any) => s.name === "Email Report");
    expect(found).toBeDefined();
    expect(found!.deliveryMethod).toBe("notification,email");
    expect(found!.deliveryEmail).toBe("test@example.com");

    // Cleanup
    await caller.watchlist.schedulesDelete({ scheduleId: found!.id });
  });

  it("creates schedule with slack delivery method", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.watchlist.schedulesCreate({
      name: "Slack Report",
      frequency: "weekly_monday",
      sections: ["predictions"],
      deliveryMethod: "slack",
      slackWebhookUrl: "https://example.com/slack-webhook-test",
    });
    expect(result).toHaveProperty("success", true);

    const schedules = await caller.watchlist.schedulesList();
    const found = schedules.find((s: any) => s.name === "Slack Report");
    expect(found).toBeDefined();
    expect(found!.deliveryMethod).toBe("slack");
    expect(found!.slackWebhookUrl).toBe("https://example.com/slack-webhook-test");

    // Update delivery method to add email
    const updateResult = await caller.watchlist.schedulesUpdate({
      scheduleId: found!.id,
      deliveryMethod: "notification,slack,email",
      deliveryEmail: "updated@example.com",
    });
    expect(updateResult).toHaveProperty("success", true);

    const updated = await caller.watchlist.schedulesList();
    const updatedSchedule = updated.find((s: any) => s.id === found!.id);
    expect(updatedSchedule!.deliveryMethod).toBe("notification,slack,email");
    expect(updatedSchedule!.deliveryEmail).toBe("updated@example.com");

    // Cleanup
    await caller.watchlist.schedulesDelete({ scheduleId: found!.id });
  });
});

describe("layout preferences (key-value store)", () => {
  it("preferences.set saves a layout config", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const layoutData = JSON.stringify({
      order: ["stream", "sentiment", "leaderboard", "overview", "narratives", "predictions", "experiments"],
      visibility: {
        stream: true,
        sentiment: true,
        leaderboard: true,
        overview: true,
        narratives: true,
        predictions: true,
        experiments: true,
      },
      widgetSizes: {
        stream: "large",
        sentiment: "small",
        leaderboard: "medium",
        overview: "medium",
        narratives: "medium",
        predictions: "medium",
        experiments: "small",
      },
      preset: "custom",
    });

    const result = await caller.preferences.set({
      key: "dashboard_layout",
      value: layoutData,
    });
    expect(result).toHaveProperty("success", true);
  });

  it("preferences.get retrieves saved layout with widgetSizes", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const pref = await caller.preferences.get({ key: "dashboard_layout" });
    expect(pref).toHaveProperty("value");
    expect(pref.value).toBeTruthy();

    const parsed = JSON.parse(pref.value!);
    expect(parsed).toHaveProperty("widgetSizes");
    expect(parsed.widgetSizes.stream).toBe("large");
    expect(parsed.widgetSizes.sentiment).toBe("small");
    expect(parsed.order).toHaveLength(7);
  });

  it("preferences.delete removes a layout config", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.preferences.delete({ key: "dashboard_layout" });
    expect(result).toHaveProperty("success", true);

    const pref = await caller.preferences.get({ key: "dashboard_layout" });
    expect(pref.value).toBeNull();
  });
});
