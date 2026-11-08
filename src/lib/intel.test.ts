import { describe, expect, it } from "vitest";
import { evaluate, type IntelRule, type CampaignStats } from "./intel";

const rule: IntelRule = { id: "r", name: "Teste", profile: "teste", campaignId: "*", maxSpendNoSale: 30, maxCpa: 0, minRoasToScale: 0, scalePercent: 20, maxDailyBudget: 0, maxFrequency: 0, hours: [0, 24], autonomy: "auto", active: true };
const c: CampaignStats = { id: "1", name: "X", spend: 31, purchases: 0, revenue: 0, frequency: 1, dailyBudget: 3000, status: "ACTIVE" };

describe("campaign watch", () => {
  it("pauses after spending more than R$30 without a sale", () => expect(evaluate(rule, c, 12)?.kind).toBe("pausar"));
  it("keeps running under R$30", () => expect(evaluate(rule, { ...c, spend: 29 }, 12)).toBeNull());
  it("keeps running when it sold", () => expect(evaluate(rule, { ...c, purchases: 1, revenue: 97 }, 12)).toBeNull());
  it("scales budget by percent capped at max", () => {
    const d = evaluate({ ...rule, profile: "escala", maxSpendNoSale: 0, minRoasToScale: 2, maxDailyBudget: 3300 }, { ...c, purchases: 2, revenue: 100, spend: 40 }, 12);
    expect(d?.newBudget).toBe(3300);
  });
  it("respects the time window", () => expect(evaluate({ ...rule, hours: [8, 18] }, c, 20)).toBeNull());
});
