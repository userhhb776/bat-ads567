import { describe, expect, it } from "vitest";
import { CATALOG, CATEGORIES, catalogByKind, createCustomItem, resolveItem, searchCatalog } from "./catalog";
import { simulate } from "./simulate";
import type { FunnelNode } from "./types";
const node = (kind: string, patch: Partial<FunnelNode["data"]> = {}): FunnelNode => ({ id: kind, type: "step", position: { x: 0, y: 0 }, data: { kind, label: kind, conversionRate: 100, ...patch } });
describe("FunilFlow library rules", () => {
  it("includes all twelve requested categories with their complete element counts", () => {
    expect(CATEGORIES.map((g) => CATALOG.filter((c) => c.groupId === g.id).length)).toEqual([38, 31, 20, 31, 28, 39, 16, 21, 22, 21, 23, 7]);
    expect(new Set(CATALOG.map((c) => c.kind)).size).toBe(CATALOG.length);
  });
  it("searches across every category ignoring accents", () => {
    expect(searchCatalog("pagina de captura").map((c) => c.label)).toContain("Página de Captura");
    expect(new Set(searchCatalog("whatsapp").map((c) => c.groupId))).toEqual(new Set(["traffic", "sales", "automation"]));
  });
  it("provides an icon, identifying color and editable property schema for every element", () => {
    expect(CATALOG.every((c) => !!c.icon && !!c.color && c.fields.length > 0)).toBe(true);
  });
  it("persists custom names, icons, colors and properties in node definitions", () => {
    const custom = createCustomItem("Meu evento", "Star", "sale", [{ key: "score", label: "Pontuação", type: "number" }]);
    const n = node(custom.kind, { definition: { label: custom.label, iconName: custom.iconName, color: custom.color, fields: custom.fields }, properties: { score: 12 } });
    const restored = JSON.parse(JSON.stringify(n)) as FunnelNode;
    expect(resolveItem(restored.data).iconName).toBe("Star");
    expect(resolveItem(restored.data).color).toBe("sale");
    expect(resolveItem(restored.data).fields[0]?.key).toBe("score");
    expect(restored.data.properties?.['score']).toBe(12);
  });
  it("keeps unpaid source volume distinct from ad budget", () => {
    const organic = CATALOG.find((c) => c.label === "Tráfego Orgânico");
    if (!organic) throw new Error("Missing organic source");
    const result = simulate([node(organic.kind, { volume: 200, budget: 999 })], [], 2);
    expect(result.totals.visitors).toBe(400);
    expect(result.totals.cost).toBe(0);
  });
  it("visual annotations do not generate simulated sales or conversions", () => {
    const text = CATALOG.find((c) => c.groupId === "visual" && c.label === "Texto");
    if (!text) throw new Error("Missing text");
    const result = simulate([node("meta-ads", { budget: 100, cpc: 1 }), node(text.kind)], [{ id: "edge", source: "meta-ads", target: text.kind, type: "conversion", data: { share: 100 } }]);
    expect(result.nodes[text.kind]?.conversions).toBe(0);
    expect(result.totals.sales).toBe(0);
  });
  it("retains original kinds and tolerates stale custom kinds", () => {
    expect(catalogByKind("checkout").sellable).toBe(true);
    expect(catalogByKind("whatsapp").groupId).toBe("automation");
    expect(() => simulate([node("old-custom-kind")], [])).not.toThrow();
  });
});
