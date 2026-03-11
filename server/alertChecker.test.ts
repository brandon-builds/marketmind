import { describe, it, expect, vi, beforeEach } from "vitest";
import { updatePrice, getLatestPrice } from "./alertChecker";

describe("alertChecker", () => {
  beforeEach(() => {
    // Clear any previous state
  });

  it("stores and retrieves prices via updatePrice/getLatestPrice", () => {
    updatePrice("AAPL", 185.50);
    updatePrice("MSFT", 420.25);

    expect(getLatestPrice("AAPL")).toBe(185.50);
    expect(getLatestPrice("MSFT")).toBe(420.25);
    expect(getLatestPrice("UNKNOWN")).toBeUndefined();
  });

  it("overwrites previous price for the same symbol", () => {
    updatePrice("TSLA", 200.00);
    expect(getLatestPrice("TSLA")).toBe(200.00);

    updatePrice("TSLA", 210.50);
    expect(getLatestPrice("TSLA")).toBe(210.50);
  });

  it("handles many symbols without issues", () => {
    const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "BRK-B", "GLD", "USO", "TLT", "SPY", "QQQ"];
    symbols.forEach((sym, i) => {
      updatePrice(sym, 100 + i * 10);
    });

    symbols.forEach((sym, i) => {
      expect(getLatestPrice(sym)).toBe(100 + i * 10);
    });
  });
});
