import { describe, it, expect } from "vitest";
import { scoreAds } from "./creatives";

const ad = (id: string, spend: number, purchases: number, revenue: number, impressions = 2000) => ({
  id, name: id, insights: { spend: String(spend), impressions: String(impressions), ctr: "1.2", actions: purchases ? [{ action_type: "purchase", value: String(purchases) }] : [], action_values: revenue ? [{ action_type: "purchase", value: String(revenue) }] : [] },
});

describe("scoreAds", () => {
  it("marks winner when CPA is within the target", () => {
    const [r] = scoreAds([ad("a", 50, 3, 300)], { minSpend: 20, targetCpa: 25 });
    expect(r!.cpa).toBeCloseTo(16.67, 1);
    expect(r!.verdict).toBe("vencedor");
  });
  it("marks bad when it spent past the minimum without results", () => {
    expect(scoreAds([ad("b", 40, 0, 0)], { minSpend: 30, targetCpa: 25 })[0]!.verdict).toBe("ruim");
  });
  it("keeps testing below the minimum spend", () => {
    expect(scoreAds([ad("c", 10, 0, 0)], { minSpend: 30, targetCpa: 25 })[0]!.verdict).toBe("em teste");
  });
});
