import { describe, expect, it } from "vitest";
import { metricByKey, sumInsights, cleanColumns, DEFAULT_COLUMNS } from "./meta-metrics";

const a = { spend: "60", impressions: "1000", inline_link_clicks: "20", actions: [{ action_type: "purchase", value: "2" }, { action_type: "landing_page_view", value: "15" }], action_values: [{ action_type: "purchase", value: "194" }] };
const b = { spend: "40", impressions: "3000", inline_link_clicks: "20", actions: [{ action_type: "landing_page_view", value: "5" }] };

describe("campaign metrics", () => {
  it("profit is Meta revenue minus spend", () => expect(metricByKey("profit")!.value(a)).toBe(134));
  it("totals recompute ratios instead of averaging them", () => {
    const t = sumInsights([a, b]);
    expect(metricByKey("cpa")!.value(t)).toBe(50); // 100 spent / 2 sales
    expect(metricByKey("lpv")!.value(t)).toBe(20);
    expect(metricByKey("ctr_link")!.value(t)).toBe(1); // 40 / 4000
  });
  it("unknown saved columns fall back to the default set", () => {
    expect(cleanColumns(["nope"])).toEqual(DEFAULT_COLUMNS);
    expect(cleanColumns(["spend", "spend", "lpv"])).toEqual(["spend", "lpv"]);
  });
});
