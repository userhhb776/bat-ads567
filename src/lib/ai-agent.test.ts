import { describe, expect, it } from "vitest";
import { aiDue, validateAiDecisions } from "./ai-agent";
import type { CampaignStats, IntelRule } from "./intel";

const rule: IntelRule = { id: "r", name: "Estratégia", profile: "escala", campaignId: "*", maxSpendNoSale: 0, maxCpa: 0, minRoasToScale: 0, scalePercent: 0, maxDailyBudget: 30000, maxFrequency: 0, hours: [0, 24], autonomy: "auto", active: true, strategy: "Escalar o que vende", maxChangePercent: 20, everyMinutes: 30 };
const stats: CampaignStats[] = [
  { id: "c1", name: "A", spend: 50, purchases: 3, revenue: 300, frequency: 1, dailyBudget: 10000, status: "ACTIVE" },
  { id: "c2", name: "B", spend: 40, purchases: 0, revenue: 0, frequency: 1, dailyBudget: 5000, status: "PAUSED" },
];
const ask = (d: unknown[]) => validateAiDecisions(JSON.stringify({ decisoes: d }), rule, stats);

describe("AI strategy agent limits", () => {
  it("caps a budget increase at the agent's max change per decision", () => {
    expect(ask([{ tipo: "escalar", id: "c1", novoOrcamento: 500 }])[0]?.newBudget).toBe(12000);
  });
  it("never goes above the daily ceiling", () => {
    const r = { ...rule, maxChangePercent: 100, maxDailyBudget: 15000 };
    expect(validateAiDecisions(JSON.stringify({ decisoes: [{ tipo: "escalar", id: "c1", novoOrcamento: 500 }] }), r, stats)[0]?.newBudget).toBe(15000);
  });
  it("ignores campaigns outside the account list", () => {
    expect(ask([{ tipo: "pausar", id: "c999" }])).toEqual([]);
  });
  it("only pauses active and only activates paused campaigns", () => {
    expect(ask([{ tipo: "pausar", id: "c2" }, { tipo: "ativar", id: "c1" }])).toEqual([]);
    expect(ask([{ tipo: "ativar", id: "c2" }]).map((d) => d.kind)).toEqual(["ativar"]);
  });
  it("waits the review interval between runs", () => {
    const now = Date.now();
    expect(aiDue(rule, 10, now - 10 * 60_000, now)).toBe(false);
    expect(aiDue(rule, 10, now - 31 * 60_000, now)).toBe(true);
  });
});
