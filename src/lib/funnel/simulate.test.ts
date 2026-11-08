import { describe, expect, it } from "vitest";
import { simulate } from "./simulate";
import type { FunnelEdge, FunnelNode } from "./types";

const n = (id: string, data: FunnelNode["data"]): FunnelNode => ({ id, type: "step", position: { x: 0, y: 0 }, data });

describe("simulate", () => {
  const nodes = [
    n("ad", { kind: "meta-ads", label: "Ads", budget: 1000, cpc: 1, conversionRate: 100 }),
    n("lp", { kind: "landing", label: "LP", conversionRate: 10 }),
    n("co", { kind: "checkout", label: "CO", conversionRate: 50, price: 100 }),
  ];
  const edges: FunnelEdge[] = [
    { id: "e1", source: "ad", target: "lp", type: "conversion", data: { share: 100 } },
    { id: "e2", source: "lp", target: "co", type: "conversion", data: { share: 100 } },
  ];

  it("traffic = budget / cpc, then applies conversion rates", () => {
    const r = simulate(nodes, edges);
    expect(r.nodes["ad"]?.visitors).toBe(1000);
    expect(r.edges["e2"]).toBe(100);
    expect(r.nodes["co"]?.conversions).toBe(50);
    expect(r.totals.revenue).toBe(5000);
    expect(r.totals.roas).toBe(5);
  });

  it("traffic multiplier scales budget and sales", () => {
    const r = simulate(nodes, edges, 2);
    expect(r.totals.cost).toBe(2000);
    expect(r.totals.sales).toBe(100);
  });

  it("edge share splits outflow", () => {
    const r = simulate(nodes, [{ id: "e1", source: "ad", target: "lp", type: "conversion", data: { share: 100 } }, { id: "e2", source: "lp", target: "co", type: "conversion", data: { share: 50 } }]);
    expect(r.edges["e2"]).toBe(50);
  });
});
