import { describe, it, expect } from "vitest";
import { delta, metricsOf, previousRange, sumMetrics } from "./reports";

describe("reports", () => {
  it("previous period has the same length and ends the day before", () => {
    expect(previousRange("2026-11-03", "2026-11-09")).toEqual({ since: "2026-10-27", until: "2026-11-02" });
  });
  it("percent change and no comparison against zero", () => {
    expect(delta(150, 100)).toBe(50);
    expect(delta(10, 0)).toBeNull();
  });
  it("sums then recomputes ratios (not averaging ratios)", () => {
    const a = metricsOf({ spend: "100", impressions: "1000", clicks: "10", actions: [{ action_type: "purchase", value: "2" }], action_values: [{ action_type: "purchase", value: "300" }] });
    const b = metricsOf({ spend: "100", impressions: "3000", clicks: "30" });
    const s = sumMetrics([a, b]);
    expect(s.cpa).toBe(100);
    expect(s.roas).toBe(1.5);
    expect(s.ctr).toBe(1);
  });
});
