import { resolveItem } from "./catalog";
import type { FunnelEdge, FunnelNode, NodeMetrics, SimulationResult } from "./types";

/**
 * Propagates traffic through the funnel graph.
 * Sources generate visitors = budget / cpc * trafficMultiplier.
 * Each node forwards visitors * conversionRate, split across outgoing edges by `share`.
 */
export function simulate(nodes: FunnelNode[], edges: FunnelEdge[], trafficMultiplier = 1): SimulationResult {
  const metrics: Record<string, NodeMetrics> = {};
  const edgeVol: Record<string, number> = {};
  const incoming: Record<string, FunnelEdge[]> = {};
  for (const n of nodes) incoming[n.id] = [];
  for (const e of edges) incoming[e.target]?.push(e);

  const visited = new Set<string>();
  const visiting = new Set<string>();

  const compute = (id: string): NodeMetrics => {
    if (metrics[id]) return metrics[id];
    const node = nodes.find((n) => n.id === id);
    const empty = { visitors: 0, conversions: 0, revenue: 0, cost: 0 };
    if (!node || visiting.has(id)) return empty; // cycle guard
    visiting.add(id);
    const d = node.data;
    const item = resolveItem(d);
    let visitors = 0;
    let cost = 0;
    if (item.isSource) {
      const budget = (d.budget ?? 0) * trafficMultiplier;
      visitors = item.paid ? (d.cpc && d.cpc > 0 ? budget / d.cpc : 0) : (d.volume ?? 0) * trafficMultiplier;
      cost = item.paid ? budget : 0;
    }
    for (const e of incoming[id] ?? []) {
      const src = compute(e.source);
      const share = (e.data?.share ?? 100) / 100;
      const vol = src.conversions * share;
      edgeVol[e.id] = vol;
      visitors += vol;
    }
    const conversions = item.visual ? 0 : visitors * (d.conversionRate / 100);
    const revenue = item.sellable && !item.visual ? conversions * (d.price ?? 0) : 0;
    visiting.delete(id);
    visited.add(id);
    metrics[id] = { visitors, conversions, revenue, cost };
    return metrics[id];
  };

  nodes.forEach((n) => compute(n.id));

  const all = Object.entries(metrics);
  const revenue = all.reduce((s, [, m]) => s + m.revenue, 0);
  const cost = all.reduce((s, [, m]) => s + m.cost, 0);
  const sales = nodes
    .filter((n) => resolveItem(n.data).sellable)
    .reduce((s, n) => s + (metrics[n.id]?.conversions ?? 0), 0);
  const visitors = nodes
    .filter((n) => resolveItem(n.data).isSource)
    .reduce((s, n) => s + (metrics[n.id]?.visitors ?? 0), 0);

  return {
    nodes: metrics,
    edges: edgeVol,
    totals: { visitors, sales, revenue, cost, profit: revenue - cost, roas: cost > 0 ? revenue / cost : 0 },
  };
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");
export const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
