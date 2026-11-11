import type { CampaignStats, IntelRule } from "./intel";

/** Decisions an AI strategy agent may take; anything else is discarded. */
export type AiDecision = { kind: "pausar" | "ativar" | "escalar" | "reduzir" | "alerta"; campaignId: string; reason: string; newBudget?: number };

const inWindow = (rule: IntelRule, hour: number) => {
  const [from, to] = rule.hours;
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
};

/** True when the agent should run now (active, inside its hours and past its review interval). */
export function aiDue(rule: IntelRule, hour: number, lastRunMs: number, now = Date.now()) {
  if (!rule.active || !rule.strategy?.trim() || !inWindow(rule, hour)) return false;
  return now - lastRunMs >= Math.max(15, rule.everyMinutes ?? 30) * 60_000;
}

export function aiPrompt(rule: IntelRule, stats: CampaignStats[], hour: number) {
  const scope = stats.filter((c) => rule.campaignId === "*" || c.id === rule.campaignId);
  const rows = scope.map((c) => ({ id: c.id, nome: c.name, status: c.status, orcamentoDiario: c.dailyBudget / 100, gastoHoje: c.spend, comprasHoje: c.purchases, receitaHoje: c.revenue, frequencia: c.frequency }));
  const system = `Você é um gestor de tráfego executando a estratégia do chefe nas campanhas abaixo. Hora local: ${hour}h.
Responda SOMENTE com JSON: {"decisoes":[{"tipo":"pausar|ativar|escalar|reduzir|alerta","id":"<id da campanha>","novoOrcamento":<número na moeda da conta, só para escalar/reduzir>,"motivo":"frase curta e simples"}]}.
Use apenas ids da lista. Se nada precisa mudar, responda {"decisoes":[]}. Não invente números. Siga a estratégia à risca; na dúvida, não mexa.
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
