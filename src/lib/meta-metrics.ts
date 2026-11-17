/** Catalog of Meta metrics the campaign table can show; the chefe picks which columns to see. */
export type Act = { action_type: string; value: string };
export type Ins = any;
export type MetricFormat = "money" | "int" | "pct" | "ratio" | "sec" | "text";
export type Metric = { key: string; label: string; group: string; format: MetricFormat; value: (i: Ins) => number | string | null; additive?: boolean };

export const PURCHASE = ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"];
export const IC = ["initiate_checkout", "omni_initiated_checkout", "offsite_conversion.fb_pixel_initiate_checkout"];
const LPV = ["landing_page_view", "omni_landing_page_view"];
const ATC = ["add_to_cart", "omni_add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"];
const VC = ["view_content", "omni_view_content", "offsite_conversion.fb_pixel_view_content"];
const LEAD = ["lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped", "leadgen_grouped"];
const REG = ["complete_registration", "omni_complete_registration", "offsite_conversion.fb_pixel_complete_registration"];
const API = ["add_payment_info", "offsite_conversion.fb_pixel_add_payment_info"];
const MSG = ["onsite_conversion.messaging_conversation_started_7d"];
const V3 = ["video_view"];

/** First matching action type wins (Meta repeats the same event under several names). */
export function act(list: Act[] | undefined, types: string[]) {
  if (!list?.length) return 0;
  for (const t of types) { const f = list.find((a) => a.action_type === t); if (f) return Number(f.value) || 0; }
  return 0;
}
const n = (v: unknown) => (v === undefined || v === null || v === "" ? 0 : Number(v) || 0);
const div = (a: number, b: number) => (b ? a / b : null);
const vid = (i: Ins, f: string) => act(i?.[f], ["video_view"]) || n(i?.[f]?.[0]?.value);

const spend = (i: Ins) => n(i?.spend);
const sales = (i: Ins) => act(i?.actions, PURCHASE);
const revenue = (i: Ins) => act(i?.action_values, PURCHASE);
const linkClicks = (i: Ins) => n(i?.inline_link_clicks);
const impr = (i: Ins) => n(i?.impressions);
const count = (types: string[]) => (i: Ins) => act(i?.actions, types);
const costOf = (types: string[]) => (i: Ins) => div(spend(i), act(i?.actions, types));

export const METRICS: Metric[] = [
  // Resultado
  { key: "sales", label: "Vendas", group: "Resultado", format: "int", value: sales, additive: true },
  { key: "cpa", label: "CPA", group: "Resultado", format: "money", value: (i) => div(spend(i), sales(i)) },
  { key: "spend", label: "Gastos", group: "Resultado", format: "money", value: spend, additive: true },
  { key: "revenue", label: "Faturamento (Meta)", group: "Resultado", format: "money", value: revenue, additive: true },
  { key: "profit", label: "Lucro (fat. − gasto)", group: "Resultado", format: "money", value: (i) => revenue(i) - spend(i), additive: true },
  { key: "roas", label: "ROAS", group: "Resultado", format: "ratio", value: (i) => div(revenue(i), spend(i)) },
  { key: "ticket", label: "Ticket médio", group: "Resultado", format: "money", value: (i) => div(revenue(i), sales(i)) },
  { key: "conv", label: "Conversão (vendas/cliques)", group: "Resultado", format: "pct", value: (i) => { const d = div(sales(i), linkClicks(i)); return d === null ? null : d * 100; } },
  // Funil
  { key: "lpv", label: "Visualizações da página", group: "Funil", format: "int", value: count(LPV), additive: true },
  { key: "cost_lpv", label: "Custo/visualização da página", group: "Funil", format: "money", value: costOf(LPV) },
  { key: "connect", label: "Taxa de carregamento (LPV/cliques)", group: "Funil", format: "pct", value: (i) => { const d = div(act(i?.actions, LPV), linkClicks(i)); return d === null ? null : d * 100; } },
  { key: "vc", label: "Visualizações de conteúdo", group: "Funil", format: "int", value: count(VC), additive: true },
  { key: "atc", label: "Adições ao carrinho", group: "Funil", format: "int", value: count(ATC), additive: true },
  { key: "cost_atc", label: "Custo/adição ao carrinho", group: "Funil", format: "money", value: costOf(ATC) },
  { key: "ic", label: "Checkouts iniciados (IC)", group: "Funil", format: "int", value: count(IC), additive: true },
  { key: "cost_ic", label: "Custo/IC", group: "Funil", format: "money", value: costOf(IC) },
  { key: "ic_rate", label: "IC → venda", group: "Funil", format: "pct", value: (i) => { const d = div(sales(i), act(i?.actions, IC)); return d === null ? null : d * 100; } },
  { key: "api", label: "Pagamento adicionado", group: "Funil", format: "int", value: count(API), additive: true },
  // Tráfego
  { key: "link_clicks", label: "Cliques no link", group: "Tráfego", format: "int", value: linkClicks, additive: true },
  { key: "unique_link_clicks", label: "Cliques únicos no link", group: "Tráfego", format: "int", value: (i) => n(i?.unique_inline_link_clicks), additive: true },
  { key: "clicks", label: "Cliques (todos)", group: "Tráfego", format: "int", value: (i) => n(i?.clicks), additive: true },
  { key: "outbound", label: "Cliques de saída", group: "Tráfego", format: "int", value: (i) => act(i?.outbound_clicks, ["outbound_click"]), additive: true },
  { key: "cpc_link", label: "CPC (link)", group: "Tráfego", format: "money", value: (i) => div(spend(i), linkClicks(i)) },
  { key: "cpc", label: "CPC (todos)", group: "Tráfego", format: "money", value: (i) => div(spend(i), n(i?.clicks)) },
  { key: "ctr_link", label: "CTR (link)", group: "Tráfego", format: "pct", value: (i) => { const d = div(linkClicks(i), impr(i)); return d === null ? null : d * 100; } },
  { key: "ctr", label: "CTR (todos)", group: "Tráfego", format: "pct", value: (i) => { const d = div(n(i?.clicks), impr(i)); return d === null ? null : d * 100; } },
  { key: "cpm", label: "CPM", group: "Tráfego", format: "money", value: (i) => { const d = div(spend(i), impr(i)); return d === null ? null : d * 1000; } },
  { key: "impressions", label: "Impressões", group: "Tráfego", format: "int", value: impr, additive: true },
  { key: "reach", label: "Alcance", group: "Tráfego", format: "int", value: (i) => n(i?.reach) },
  { key: "frequency", label: "Frequência", group: "Tráfego", format: "ratio", value: (i) => div(impr(i), n(i?.reach)) },
  // Leads e mensagens
  { key: "leads", label: "Leads", group: "Leads e mensagens", format: "int", value: count(LEAD), additive: true },
  { key: "cpl", label: "Custo por lead", group: "Leads e mensagens", format: "money", value: costOf(LEAD) },
  { key: "reg", label: "Cadastros completos", group: "Leads e mensagens", format: "int", value: count(REG), additive: true },
  { key: "msgs", label: "Conversas iniciadas", group: "Leads e mensagens", format: "int", value: count(MSG), additive: true },
  { key: "cost_msg", label: "Custo por conversa", group: "Leads e mensagens", format: "money", value: costOf(MSG) },
  // Vídeo
  { key: "v3", label: "Visualizações de 3s", group: "Vídeo", format: "int", value: count(V3), additive: true },
  { key: "hook", label: "Hook rate (3s/impressões)", group: "Vídeo", format: "pct", value: (i) => { const d = div(act(i?.actions, V3), impr(i)); return d === null ? null : d * 100; } },
  { key: "thruplay", label: "ThruPlays", group: "Vídeo", format: "int", value: (i) => vid(i, "video_thruplay_watched_actions"), additive: true },
  { key: "hold", label: "Hold rate (ThruPlay/3s)", group: "Vídeo", format: "pct", value: (i) => { const d = div(vid(i, "video_thruplay_watched_actions"), act(i?.actions, V3)); return d === null ? null : d * 100; } },
  { key: "p25", label: "Vídeo 25%", group: "Vídeo", format: "int", value: (i) => vid(i, "video_p25_watched_actions"), additive: true },
  { key: "p50", label: "Vídeo 50%", group: "Vídeo", format: "int", value: (i) => vid(i, "video_p50_watched_actions"), additive: true },
  { key: "p75", label: "Vídeo 75%", group: "Vídeo", format: "int", value: (i) => vid(i, "video_p75_watched_actions"), additive: true },
  { key: "p95", label: "Vídeo 95%", group: "Vídeo", format: "int", value: (i) => vid(i, "video_p95_watched_actions"), additive: true },
  { key: "p100", label: "Vídeo 100%", group: "Vídeo", format: "int", value: (i) => vid(i, "video_p100_watched_actions"), additive: true },
  { key: "avg_watch", label: "Tempo médio assistido", group: "Vídeo", format: "sec", value: (i) => n(i?.video_avg_time_watched_actions?.[0]?.value) || null },
  // Engajamento
  { key: "engagement", label: "Engajamento com a publicação", group: "Engajamento", format: "int", value: count(["post_engagement"]), additive: true },
  { key: "reactions", label: "Reações", group: "Engajamento", format: "int", value: count(["post_reaction"]), additive: true },
  { key: "comments", label: "Comentários", group: "Engajamento", format: "int", value: count(["comment"]), additive: true },
  { key: "shares", label: "Compartilhamentos", group: "Engajamento", format: "int", value: count(["post"]), additive: true },
  { key: "saves", label: "Salvamentos", group: "Engajamento", format: "int", value: count(["onsite_conversion.post_save"]), additive: true },
  { key: "follows", label: "Curtidas na página", group: "Engajamento", format: "int", value: count(["like"]), additive: true },
  // Qualidade (só anúncios)
  { key: "quality", label: "Classificação de qualidade", group: "Qualidade (anúncios)", format: "text", value: (i) => rank(i?.quality_ranking) },
  { key: "eng_rank", label: "Classificação de engajamento", group: "Qualidade (anúncios)", format: "text", value: (i) => rank(i?.engagement_rate_ranking) },
  { key: "conv_rank", label: "Classificação de conversão", group: "Qualidade (anúncios)", format: "text", value: (i) => rank(i?.conversion_rate_ranking) },
];

function rank(v: unknown) {
  const s = String(v ?? "");
  if (!s || s === "UNKNOWN") return null;
  if (s.startsWith("ABOVE")) return "Acima da média";
  if (s === "AVERAGE") return "Na média";
  if (s.includes("BOTTOM_10")) return "Abaixo (10% piores)";
  if (s.includes("BOTTOM_20")) return "Abaixo (20% piores)";
  if (s.includes("BOTTOM_35")) return "Abaixo (35% piores)";
  return s;
}

export const DEFAULT_COLUMNS = ["sales", "cpa", "spend", "profit", "roas", "ic", "cost_ic", "lpv", "cpc_link", "ctr_link", "cpm", "impressions"];
export const COLUMN_PRESETS: { label: string; cols: string[] }[] = [
  { label: "Vendas", cols: DEFAULT_COLUMNS },
  { label: "Funil", cols: ["spend", "link_clicks", "lpv", "connect", "vc", "atc", "ic", "ic_rate", "sales", "cpa", "profit"] },
  { label: "Criativo", cols: ["spend", "impressions", "ctr_link", "cpc_link", "v3", "hook", "thruplay", "hold", "p50", "p100", "sales", "cpa"] },
  { label: "Leads", cols: ["spend", "leads", "cpl", "msgs", "cost_msg", "reg", "ctr_link", "cpm"] },
];

/** Keeps only known columns, in the chefe's order. */
export const cleanColumns = (cols: unknown) => {
  const known = new Set(METRICS.map((m) => m.key));
  const list = Array.isArray(cols) ? cols.filter((c): c is string => typeof c === "string" && known.has(c)) : [];
  return list.length ? [...new Set(list)] : DEFAULT_COLUMNS;
};

/** Adds rows into one synthetic insights object, so totals use the same formulas (ratios recomputed, not averaged). */
export function sumInsights(list: Ins[]): Record<string, any> {
  const out: Record<string, any> = {};
  const lists = ["actions", "action_values", "outbound_clicks", "video_thruplay_watched_actions", "video_p25_watched_actions", "video_p50_watched_actions", "video_p75_watched_actions", "video_p95_watched_actions", "video_p100_watched_actions"];
  for (const i of list) {
    if (!i) continue;
    for (const k of ["spend", "impressions", "clicks", "inline_link_clicks", "unique_inline_link_clicks"]) out[k] = n(out[k]) + n(i[k]);
    for (const k of lists) {
      const acc: Act[] = (out[k] ??= []);
      for (const a of (i[k] ?? []) as Act[]) {
        const f = acc.find((x) => x.action_type === a.action_type);
        if (f) f.value = String(n(f.value) + n(a.value)); else acc.push({ action_type: a.action_type, value: String(n(a.value)) });
      }
    }
  }
  return out;
}

export const metricByKey = (k: string) => METRICS.find((m) => m.key === k);

/** Metrics that can't be summed across rows (unique people, averages, rankings): totals show a dash. */
export const NO_TOTAL = new Set(["reach", "frequency", "unique_link_clicks", "avg_watch", "quality", "eng_rank", "conv_rank"]);

export function formatMetric(m: Metric, v: number | string | null, money: (n: number) => string) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return v;
  if (!Number.isFinite(v)) return "—";
  switch (m.format) {
    case "money": return money(v);
    case "pct": return `${v.toFixed(2)}%`;
    case "ratio": return v.toFixed(2);
    case "sec": return `${v.toFixed(1)}s`;
    case "int": return Math.round(v).toLocaleString("pt-BR");
    default: return String(v);
  }
}
