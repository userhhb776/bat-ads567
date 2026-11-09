export type Profile = "teste" | "escala" | "manutencao";
export type Autonomy = "auto" | "aprovar" | "avisar";
export type IntelRule = {
  id: string;
  name: string;
  profile: Profile;
  campaignId: string; // "*" = todas
  accountId?: string;
  maxSpendNoSale: number; // pausa se gastar >= isso sem venda (0 = desligado)
  maxCpa: number; // pausa se CPA acima (0 = desligado)
  minRoasToScale: number; // escala se ROAS >= (0 = desligado)
  scalePercent: number; // % de aumento de orçamento
  maxDailyBudget: number; // teto de orçamento ao escalar
  maxFrequency: number; // alerta se frequência acima (0 = desligado)
  hours: [number, number]; // janela de atuação
  autonomy: Autonomy;
  active: boolean;
};
export type CampaignStats = { id: string; name: string; spend: number; purchases: number; revenue: number; frequency: number; dailyBudget: number; status: string };
export type Decision = { kind: "pausar" | "escalar" | "alerta"; reason: string; newBudget?: number };

export function evaluate(rule: IntelRule, c: CampaignStats, hour: number): Decision | null {
  if (!rule.active || c.status !== "ACTIVE") return null;
  if (rule.campaignId !== "*" && rule.campaignId !== c.id) return null;
  const [from, to] = rule.hours;
  if (!(from <= to ? hour >= from && hour < to : hour >= from || hour < to)) return null;
  if (rule.maxSpendNoSale > 0 && c.purchases === 0 && c.spend >= rule.maxSpendNoSale)
    return { kind: "pausar", reason: `Gastou ${c.spend.toFixed(2)} sem vender (limite ${rule.maxSpendNoSale}).` };
  const cpa = c.purchases ? c.spend / c.purchases : Infinity;
  if (rule.maxCpa > 0 && c.purchases > 0 && cpa > rule.maxCpa)
    return { kind: "pausar", reason: `CPA ${cpa.toFixed(2)} acima do limite ${rule.maxCpa}.` };
  const roas = c.spend ? c.revenue / c.spend : 0;
  if (rule.profile === "escala" && rule.minRoasToScale > 0 && roas >= rule.minRoasToScale && c.dailyBudget > 0) {
    const next = Math.min(rule.maxDailyBudget || Infinity, Math.round(c.dailyBudget * (1 + rule.scalePercent / 100)));
    if (next > c.dailyBudget) return { kind: "escalar", reason: `ROAS ${roas.toFixed(2)} ≥ ${rule.minRoasToScale}.`, newBudget: next };
  }
  if (rule.maxFrequency > 0 && c.frequency > rule.maxFrequency)
    return { kind: "alerta", reason: `Frequência ${c.frequency.toFixed(2)} acima de ${rule.maxFrequency}.` };
  return null;
}
