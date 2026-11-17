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
  /** @deprecated no longer used: agents watch 24h while active. Kept optional so old saved rules still load. */
  maxFrequency?: number;
  /** @deprecated no longer used: agents watch 24h while active. */
  hours?: [number, number];
  autonomy: Autonomy;
  active: boolean;
  /** Free-form strategy written by the chefe; when set, the 24h watch decides with AI inside the limits below. */
  strategy?: string;
  /** Largest budget change per decision, in % (AI strategy agents). */
  maxChangePercent?: number;
  /** Minimum minutes between AI reviews. */
  everyMinutes?: number;
};
export type CampaignStats = {
  id: string; name: string; spend: number; purchases: number; revenue: number; frequency: number; dailyBudget: number; status: string; accountId?: string;
  /** Secondary metrics of today, for strategies that don't look only at spend. */
  impressions?: number; clicks?: number; linkClicks?: number; ctr?: number; cpc?: number; cpm?: number; lpv?: number; addToCart?: number; checkouts?: number;
  createdAt?: string; startedAt?: string;
  /** Whole-life totals of the campaign. */
  totalSpend?: number; totalPurchases?: number; totalRevenue?: number;
};
export type Decision = { kind: "pausar" | "escalar" | "alerta"; reason: string; newBudget?: number };

/** Fixed-rule agents act at any hour while active (the hour argument is kept for compatibility). */
export function evaluate(rule: IntelRule, c: CampaignStats, _hour?: number): Decision | null {
  if (!rule.active || rule.strategy || c.status !== "ACTIVE") return null;
  if (rule.accountId && rule.accountId !== c.accountId) return null;
  if (rule.campaignId !== "*" && rule.campaignId !== c.id) return null;
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
  return null;
}
