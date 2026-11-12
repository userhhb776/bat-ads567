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

import { normalizeAd as nz } from "./spy";
test("reads camelCase actor output (video, text, link)", () => {
  const a = nz({ adArchiveId: "9", pageName: "P", isActive: true, startDate: 1700000000, snapshot: { body: { text: "oi" }, linkUrl: "https://x.com", videos: [{ videoHdUrl: "https://v.mp4", videoPreviewImageUrl: "https://c.jpg" }] } });
  expect(a?.id).toBe("9"); expect(a?.video).toBe("https://v.mp4"); expect(a?.image).toBe("https://c.jpg"); expect(a?.text).toBe("oi"); expect(a?.link).toBe("https://x.com");
});

import { mergeAds, reachedEnd, applyScale, scaleOf, isBigBrand, checkoutFromUrl, checkoutFromHtml, sentinelDue, sentinelHits, formatOf } from "./spy";
describe("bat spy pro", () => {
  const ad = (id: string, page: string, n: number, days: number, link = "https://o.com/" + page) => normalizeAd({ ...raw(id, page, n, days), snapshot: { body: { text: "x" }, link_url: link } }, now)!;
  it("minerar mais keeps old ads and adds only new ones", () => { const m = mergeAds([ad("1", "a", 1, 1)], [ad("1", "a", 1, 1), ad("2", "b", 1, 1)]); expect(m.ads.map((a) => a.id)).toEqual(["1", "2"]); expect(m.added).toBe(1); });
  it("stops when nothing new came back", () => expect(reachedEnd(100, 100, 0)).toBe(true));
  it("stops when the library returned fewer than asked", () => expect(reachedEnd(100, 60, 10)).toBe(true));
  it("keeps going when a full batch of new ads came", () => expect(reachedEnd(100, 100, 50)).toBe(false));
  it("stops at 1000 per search", () => expect(reachedEnd(1000, 1000, 50)).toBe(true));
  it("super escala is 20+ active, validando 5-19, teste 1-4", () => { expect(scaleOf(20)).toBe("super"); expect(scaleOf(19)).toBe("validando"); expect(scaleOf(5)).toBe("validando"); expect(scaleOf(4)).toBe("teste"); });
  it("filters advertisers by scale", () => expect(applyScale([ad("1", "a", 25, 1), ad("2", "b", 3, 1)], "super").map((a) => a.pageId)).toEqual(["a"]));
  it("hides big marketplaces by name or domain", () => { expect(isBigBrand({ ...ad("1", "Shopee", 1, 1) })).toBe(true); expect(isBigBrand(ad("2", "x", 1, 1, "https://www.mercadolivre.com.br/p"))).toBe(true); expect(isBigBrand(ad("3", "Chá da Ana", 1, 1))).toBe(false); });
  it("detects checkout from link and page", () => { expect(checkoutFromUrl("https://pay.kiwify.com.br/abc")).toBe("kiwify"); expect(checkoutFromUrl("https://pay.hotmart.com/X")).toBe("hotmart"); expect(checkoutFromHtml('<script src="https://cdn.shopify.com/s.js">')).toBe("shopify"); expect(checkoutFromHtml("<html></html>")).toBe("proprio"); });
  it("reads carousel format", () => expect(formatOf(normalizeAd({ ...raw("1", "p", 1, 1), snapshot: { display_format: "CAROUSEL", cards: [{}, {}] } }, now)!)).toBe("carrossel"));
  const sen = { id: "s", label: "", q: "x", pageUrl: "", country: "BR", minDays: 15, everyHours: 24, whatsapp: "", active: true };
  it("sentinel runs again only after its interval", () => { expect(sentinelDue(sen, new Date(now - 23 * 3600e3).toISOString(), now)).toBe(false); expect(sentinelDue(sen, new Date(now - 25 * 3600e3).toISOString(), now)).toBe(true); });
  it("sentinel alerts only ads with 15+ days never alerted", () => expect(sentinelHits([ad("1", "a", 1, 20), ad("2", "b", 1, 10), ad("3", "c", 1, 30)], 15, ["3"]).map((a) => a.id)).toEqual(["1"]));
});
