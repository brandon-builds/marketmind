import { describe, it, expect } from "vitest";
import { getVipTwitterStatus, VIP_ACCOUNTS } from "./realTwitterVip";

describe("Real Twitter VIP Scraper", () => {
  it("should have VIP accounts defined", () => {
    expect(VIP_ACCOUNTS).toBeDefined();
    expect(Array.isArray(VIP_ACCOUNTS)).toBe(true);
    expect(VIP_ACCOUNTS.length).toBeGreaterThan(0);
  });

  it("should include key accounts like elonmusk and CathieDWood", () => {
    const handles = VIP_ACCOUNTS.map((a: any) => a.handle);
    expect(handles).toContain("elonmusk");
    expect(handles).toContain("CathieDWood");
  });

  it("should have weight multipliers for each account", () => {
    for (const account of VIP_ACCOUNTS) {
      expect(account).toHaveProperty("weightMultiplier");
      expect(typeof account.weightMultiplier).toBe("number");
      expect(account.weightMultiplier).toBeGreaterThan(0);
    }
  });

  it("should return a valid status object", async () => {
    const status = await getVipTwitterStatus();
    expect(status).toHaveProperty("totalAccounts");
    expect(status).toHaveProperty("status");
    expect(status).toHaveProperty("recentTweetCount");
    expect(typeof status.totalAccounts).toBe("number");
    expect(status.totalAccounts).toBe(VIP_ACCOUNTS.length);
  });
});
