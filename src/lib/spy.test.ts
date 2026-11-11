import { describe, it, expect } from "vitest";
import { libraryUrl, normalizeAd, advertisers, applyMinActive, heat, DEFAULT_FILTERS } from "./spy";
const now = Date.parse("2026-11-11T00:00:00Z");
const raw = (id: string, page: string, n: number, days: number) => ({ ad_archive_id: id, page_id: page, page_name: page, is_active: true, collation_count: n, start_date: (now - days * 86400000) / 1000, snapshot: { body: { text: "x" }, link_url: "https://o.com/" + page } });
describe("bat spy", () => {
  it("builds library url with country and keyword", () => { const u = libraryUrl({ ...DEFAULT_FILTERS, q: "emagrecer", country: "US" }); expect(u).toContain("country=US"); expect(u).toContain("q=emagrecer"); });
  it("normalizes days running", () => expect(normalizeAd(raw("1", "p", 1, 12), now)?.days).toBe(12));
  it("filters advertisers below the minimum active ads", () => { const ads = [raw("1", "a", 12, 3), raw("2", "b", 2, 3)].map((r) => normalizeAd(r, now)!); expect(applyMinActive(ads, 10).map((a) => a.pageId)).toEqual(["a"]); });
  it("ranks advertiser with more active ads first", () => { const ads = [raw("1", "a", 2, 3), raw("2", "b", 20, 3)].map((r) => normalizeAd(r, now)!); expect(advertisers(ads)[0]?.pageId).toBe("b"); });
  it("marks 30+ days as quente", () => expect(heat(normalizeAd(raw("1", "a", 1, 30), now)!)).toBe("quente"));
});
