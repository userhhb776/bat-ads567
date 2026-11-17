import type { CampaignStats, IntelRule } from "./intel";

/** Decisions an AI strategy agent may take; anything else is discarded. */
export type AiDecision = { kind: "pausar" | "ativar" | "escalar" | "reduzir" | "alerta"; campaignId: string; reason: string; newBudget?: number };

/** Budget memory per campaign: the first budget seen (base) and the last changes, so "volte ao anterior" works. */
export type BudgetChange = { at: string; from: number; to: number; by: string };
export type BudgetHistory = Record<string, { base: number; changes: BudgetChange[] }>;

export function recordBudget(map: BudgetHistory, id: string, from: number, to: number, by: string, at = new Date().toISOString()): BudgetHistory {
  const cur = map[id] ?? { base: from, changes: [] };
  return { ...map, [id]: { base: cur.base, changes: [...cur.changes, { at, from, to, by }].slice(-12) } };
}

/** Remembers the first budget of campaigns never seen before (doesn't touch known ones). */
export function seedBudgets(map: BudgetHistory, stats: { id: string; dailyBudget: number }[]): BudgetHistory {
  let out = map;
  for (const c of stats) if (c.dailyBudget > 0 && !out[c.id]) out = { ...out, [c.id]: { base: c.dailyBudget, changes: [] } };
  return out;
}

/** True when the agent should run now (active and past its review interval; agents work 24h). */
export function aiDue(rule: IntelRule, _hour: number, lastRunMs: number, now = Date.now()) {
  if (!rule.active || !rule.strategy?.trim()) return false;
  return now - lastRunMs >= Math.max(15, rule.everyMinutes ?? 30) * 60_000;
}

const r2 = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? undefined : Math.round(v * 100) / 100);
const hoursSince = (iso: string | undefined, now: number) => (iso && Date.parse(iso) ? Math.max(0, Math.round((now - Date.parse(iso)) / 36e5)) : undefined);

export function aiPrompt(rule: IntelRule, stats: CampaignStats[], hour: number, history: BudgetHistory = {}, now = Date.now()) {
  const scope = stats.filter((c) => rule.campaignId === "*" || c.id === rule.campaignId);
  const rows = scope.map((c) => {
    const h = history[c.id];
    const last = h?.changes[h.changes.length - 1];
    return {
      id: c.id, nome: c.name, status: c.status, orcamentoDiario: c.dailyBudget / 100,
      orcamentoBase: h ? h.base / 100 : undefined, orcamentoAnterior: last ? last.from / 100 : undefined, ultimaMudancaHaHoras: last ? hoursSince(last.at, now) : undefined,
      gastoHoje: c.spend, comprasHoje: c.purchases, receitaHoje: c.revenue,
      impressoesHoje: c.impressions, cliquesLinkHoje: c.linkClicks, ctrHoje: r2(c.ctr), cpcHoje: r2(c.cpc), cpmHoje: r2(c.cpm),
      visualizacoesPaginaHoje: c.lpv, carrinhoHoje: c.addToCart, checkoutsHoje: c.checkouts,
      horasNoAr: hoursSince(c.startedAt ?? c.createdAt, now),
      gastoTotal: r2(c.totalSpend), comprasTotal: c.totalPurchases, receitaTotal: r2(c.totalRevenue),
    };
  });
  const system = `Você é um gestor de tráfego executando a estratégia do chefe nas campanhas abaixo. Hora local: ${hour}h.
Responda SOMENTE com JSON: {"decisoes":[{"tipo":"pausar|ativar|escalar|reduzir|alerta","id":"<id da campanha>","novoOrcamento":<número na moeda da conta, só para escalar/reduzir>,"motivo":"frase curta e simples"}]}.
Use apenas ids da lista. Se nada precisa mudar, responda {"decisoes":[]}. Não invente números. Siga a estratégia à risca; na dúvida, não mexa.
Cada campanha é decidida sozinha: o que vale para uma não se aplica às outras. "orcamentoBase" é o primeiro orçamento conhecido e "orcamentoAnterior" o valor antes da última mudança — use-os quando a estratégia mandar voltar ao orçamento anterior. "horasNoAr" é o tempo desde que a campanha começou.
Limites: mudança de orçamento de no máximo ${rule.maxChangePercent ?? 30}% por decisão${rule.maxDailyBudget ? `; orçamento diário nunca acima de ${rule.maxDailyBudget / 100}` : ""}.`;
  return { system, user: `Estratégia do chefe:\n${rule.strategy}\n\nCampanhas (valores de hoje):\n${JSON.stringify(rows)}` };
}

/** Parses and clamps the AI answer: only known campaigns, allowed kinds and budget changes within the agent limits. */
export function validateAiDecisions(raw: string, rule: IntelRule, stats: CampaignStats[]): AiDecision[] {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  let list: unknown;
  try { list = json ? (JSON.parse(json) as { decisoes?: unknown }).decisoes : null; } catch { return []; }
  if (!Array.isArray(list)) return [];
  const max = Math.min(100, Math.max(1, rule.maxChangePercent ?? 30)) / 100;
  const out: AiDecision[] = [];
  for (const d of list.slice(0, 10) as Record<string, unknown>[]) {
    const kind = String(d?.["tipo"] ?? "") as AiDecision["kind"];
    const c = stats.find((x) => x.id === String(d?.["id"] ?? ""));
    if (!c || (rule.campaignId !== "*" && c.id !== rule.campaignId)) continue;
    const reason = String(d?.["motivo"] ?? "Estratégia do agente").slice(0, 300);
    if (kind === "alerta") { out.push({ kind, campaignId: c.id, reason }); continue; }
    if (kind === "pausar" && c.status === "ACTIVE") { out.push({ kind, campaignId: c.id, reason }); continue; }
    if (kind === "ativar" && c.status === "PAUSED") { out.push({ kind, campaignId: c.id, reason }); continue; }
    if ((kind === "escalar" || kind === "reduzir") && c.dailyBudget > 0) {
      const wanted = Math.round(Number(d?.["novoOrcamento"]) * 100);
      if (!Number.isFinite(wanted) || wanted <= 0) continue;
      let next = kind === "escalar" ? Math.min(wanted, Math.round(c.dailyBudget * (1 + max))) : Math.max(wanted, Math.round(c.dailyBudget * (1 - max)));
      if (kind === "escalar" && rule.maxDailyBudget) next = Math.min(next, rule.maxDailyBudget);
      if ((kind === "escalar" && next > c.dailyBudget) || (kind === "reduzir" && next < c.dailyBudget)) out.push({ kind, campaignId: c.id, reason, newBudget: next });
    }
  }
  return out.slice(0, 5);
}
