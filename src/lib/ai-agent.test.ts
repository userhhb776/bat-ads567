import { describe, expect, it } from "vitest";
import { aiDue, aiPrompt, recordBudget, seedBudgets, validateAiDecisions } from "./ai-agent";
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
  it("runs at 3h in the morning too (no time window)", () => {
    const now = Date.now();
    expect(aiDue({ ...rule, hours: [8, 18] }, 3, now - 31 * 60_000, now)).toBe(true);
  });
  it("remembers the budget before a raise so it can go back to 30", () => {
    let h = seedBudgets({}, [{ id: "c1", dailyBudget: 3000 }]);
    h = recordBudget(h, "c1", 3000, 3900, "agente");
    h = recordBudget(h, "c1", 3900, 5070, "agente");
    expect(h["c1"]!.base).toBe(3000);
    expect(h["c1"]!.changes.at(-1)!.from).toBe(3900);
    const p = aiPrompt(rule, [{ id: "c1", name: "A", spend: 10, purchases: 1, revenue: 97, frequency: 1, dailyBudget: 5070, status: "ACTIVE", ctr: 1.234, checkouts: 3 }], 0, h);
    expect(p.user).toContain('"orcamentoBase":30');
    expect(p.user).toContain('"orcamentoAnterior":39');
    expect(p.user).toContain('"checkoutsHoje":3');
  });
});
