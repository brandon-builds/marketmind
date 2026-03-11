import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("onboarding router", () => {
  it("track mutation accepts valid event types", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    // Should not throw for valid event types
    const result = await caller.onboarding.track({
      sessionId: "test_session_123",
      eventType: "tour_start",
    });
    expect(result).toEqual({ success: true });
  });

  it("track mutation accepts step events with step number", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.onboarding.track({
      sessionId: "test_session_456",
      eventType: "tour_step",
      stepNumber: 3,
      featureName: "Activity Feed",
    });
    expect(result).toEqual({ success: true });
  });

  it("track mutation accepts tooltip dismiss events", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.onboarding.track({
      sessionId: "test_session_789",
      eventType: "tooltip_dismiss",
      featureName: "backtest",
    });
    expect(result).toEqual({ success: true });
  });

  it("track mutation accepts feature first use events", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.onboarding.track({
      sessionId: "test_session_abc",
      eventType: "feature_first_use",
      featureName: "model_weights",
      metadata: JSON.stringify({ source: "nav" }),
    });
    expect(result).toEqual({ success: true });
  });

  it("summary query requires admin role", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test User", role: "user", openId: "test", avatarUrl: null, createdAt: new Date() },
      req: {} as any,
      res: {} as any,
    });

    await expect(caller.onboarding.summary({ days: 30 })).rejects.toThrow("Admin access required");
  });

  it("summary query works for admin users", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Admin", role: "admin", openId: "admin_test", avatarUrl: null, createdAt: new Date() },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.onboarding.summary({ days: 30 });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("tourStarts");
    expect(result).toHaveProperty("tourCompletes");
    expect(result).toHaveProperty("tourSkips");
    expect(result).toHaveProperty("completionRate");
    expect(result).toHaveProperty("stepFunnel");
    expect(result).toHaveProperty("featureUsage");
    expect(result).toHaveProperty("tooltipDismissals");
    expect(result).toHaveProperty("daily");
  });
});
