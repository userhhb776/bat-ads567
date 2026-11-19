import { describe, expect, it } from "vitest";
import { mergeSnap, pace, trend, type PageStats } from "./spy-trend";
import { domainOf, normalizeTraffic } from "./spy-traffic";

const stats = (s: Partial<PageStats>): PageStats => ({ key: "1", pageName: "P", active: 0, launched7: 0, launched30: 0, newestDays: Infinity, ...s });

describe("ad trend per page", () => {
  it("200 → 180 → 130 shows the page going down", () => {
    const t = trend([{ day: "2026-11-17", active: 200 }, { day: "2026-11-18", active: 180 }, { day: "2026-11-19", active: 130 }], "2026-11-19");
    expect(t.kind).toBe("descendo");
    expect(t.d1).toMatchObject({ from: 180, to: 130 });
    expect(t.d30).toMatchObject({ from: 200, to: 130, pct: -35 });
  });
  it("ignores snapshots older than 30 days", () => {
    const t = trend([{ day: "2026-09-01", active: 10 }, { day: "2026-11-19", active: 50 }], "2026-11-19");
    expect(t.kind).toBe("sem-historico");
  });
  it("exact counts win over search counts on the same day", () => {
    expect(mergeSnap({ day: "d", active: 90 }, { day: "d", active: 40, exact: true }).active).toBe(40);
    expect(mergeSnap({ day: "d", active: 40, exact: true }, { day: "d", active: 90 }).active).toBe(40);
  });
  it("many launches in 7 days = acelerando; none in 20+ days = desacelerando", () => {
    expect(pace(stats({ active: 80, launched7: 45 }))?.kind).toBe("acelerando");
    expect(pace(stats({ active: 100, launched7: 0, newestDays: 25 }))?.kind).toBe("desacelerando");
  });
});

describe("traffic", () => {
  it("reads the free source shape", () => {
    const t = normalizeTraffic({ EstimatedMonthlyVisits: { "2026-09-01": 1000, "2026-10-01": 1500 }, Engagments: { BounceRate: "0.5" } }, "x.com");
    expect(t.visits).toBe(1500);
    expect(t.changePct).toBe(50);
    expect(t.bounce).toBe(50);
  });
  it("domain without www, empty for non-web links", () => {
    expect(domainOf("https://www.Oferta.com.br/p?x=1")).toBe("oferta.com.br");
    expect(domainOf("whatsapp://send")).toBe("");
  });
});
