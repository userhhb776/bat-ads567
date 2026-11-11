/** Bat Spy: Meta Ad Library filters → library URL, and Apify item normalization. Shared by client and server. */
export type SpyFilters = { q: string; country: string; media: "all" | "video" | "image"; status: "active" | "all"; minActive: number; since: string; pageUrl: string; limit: number; lang: string };
export const DEFAULT_FILTERS: SpyFilters = { q: "", country: "BR", media: "all", status: "active", minActive: 0, since: "", pageUrl: "", limit: 50, lang: "" };
export const COUNTRIES: [string, string][] = [["BR", "Brasil"], ["US", "EUA"], ["PT", "Portugal"], ["MX", "México"], ["ES", "Espanha"], ["AR", "Argentina"], ["CO", "Colômbia"], ["CL", "Chile"], ["GB", "Reino Unido"], ["CA", "Canadá"], ["DE", "Alemanha"], ["FR", "França"], ["IT", "Itália"], ["ALL", "Todos os países"]];
export const NICHES = ["emagrecimento", "renda extra", "relacionamento", "saúde masculina", "beleza", "skincare", "pets", "fitness", "espiritualidade", "finanças", "concurso", "idiomas", "dropshipping", "suplemento", "diabetes", "dor nas articulações", "infoproduto", "curso online"];

export type SpyAd = { id: string; pageId: string; pageName: string; pageUrl: string; avatar: string; text: string; title: string; cta: string; link: string; image: string; video: string; start: string; days: number; active: boolean; platforms: string[]; sameCreative: number; libraryUrl: string };

export function libraryUrl(f: SpyFilters): string {
  if (/facebook\.com\/ads\/library/.test(f.pageUrl)) return f.pageUrl.trim();
  const u = new URL("https://www.facebook.com/ads/library/");
  u.searchParams.set("active_status", f.status);
  u.searchParams.set("ad_type", "all");
  u.searchParams.set("country", f.country || "ALL");
  u.searchParams.set("media_type", f.media);
  if (f.q.trim()) { u.searchParams.set("q", f.q.trim()); u.searchParams.set("search_type", "keyword_unordered"); }
  if (f.since) u.searchParams.set("start_date[min]", f.since);
  if (f.lang) u.searchParams.set("content_languages[0]", f.lang);
  return u.toString();
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

export function normalizeAd(raw: unknown, now = Date.now()): SpyAd | null {
  const r = o(raw), s = o(r["snapshot"]);
  const id = str(r["ad_archive_id"] ?? r["adArchiveID"] ?? r["id"]);
  if (!id) return null;
  const card = o((s["cards"] as unknown[] | undefined)?.[0]);
  const img = o((s["images"] as unknown[] | undefined)?.[0]), vid = o((s["videos"] as unknown[] | undefined)?.[0]);
  const startRaw = r["start_date"] ?? r["startDate"];
  const start = typeof startRaw === "number" ? new Date(startRaw * 1000).toISOString() : str(startRaw);
  const t = Date.parse(start);
  const pageId = str(r["page_id"] ?? s["page_id"]);
  return {
    id, pageId, pageName: str(r["page_name"] ?? s["page_name"]) || "Anunciante",
    pageUrl: str(s["page_profile_uri"]) || (pageId ? `https://www.facebook.com/${pageId}` : ""),
    avatar: str(s["page_profile_picture_url"]),
    text: str(o(s["body"])["text"]) || str(card["body"]),
    title: str(s["title"]) || str(card["title"]), cta: str(s["cta_text"]) || str(card["cta_text"]),
    link: str(s["link_url"]) || str(card["link_url"]),
    image: str(img["original_image_url"] ?? img["resized_image_url"]) || str(card["original_image_url"] ?? card["resized_image_url"]) || str(vid["video_preview_image_url"] ?? card["video_preview_image_url"]),
    video: str(vid["video_hd_url"] ?? vid["video_sd_url"]) || str(card["video_hd_url"] ?? card["video_sd_url"]),
    start, days: Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86400000)) : 0,
    active: r["is_active"] !== false, platforms: Array.isArray(r["publisher_platform"]) ? (r["publisher_platform"] as unknown[]).map(str) : [],
    sameCreative: Number(r["collation_count"] ?? 1) || 1,
    libraryUrl: `https://www.facebook.com/ads/library/?id=${id}`,
  };
}

export type Advertiser = { pageId: string; pageName: string; avatar: string; pageUrl: string; ads: number; active: number; oldestDays: number; links: string[]; score: number };

/** Groups ads by page; score favors many active ads running for many days (validated offer). */
export function advertisers(ads: SpyAd[]): Advertiser[] {
  const m = new Map<string, Advertiser>();
  for (const a of ads) {
    const k = a.pageId || a.pageName;
    const v = m.get(k) ?? { pageId: a.pageId, pageName: a.pageName, avatar: a.avatar, pageUrl: a.pageUrl, ads: 0, active: 0, oldestDays: 0, links: [], score: 0 };
    v.ads += a.sameCreative; if (a.active) v.active += a.sameCreative;
    v.oldestDays = Math.max(v.oldestDays, a.days);
    if (a.link && !v.links.includes(a.link)) v.links.push(a.link);
    m.set(k, v);
  }
  return [...m.values()].map((v) => ({ ...v, score: v.active * 2 + Math.min(v.oldestDays, 90) })).sort((a, b) => b.score - a.score);
}

export function applyMinActive(ads: SpyAd[], min: number): SpyAd[] {
  if (min <= 0) return ads;
  const ok = new Set(advertisers(ads).filter((a) => a.active >= min).map((a) => a.pageId || a.pageName));
  return ads.filter((a) => ok.has(a.pageId || a.pageName));
}

/** "Quente" when the same creative runs many times or for a long period. */
export const heat = (a: SpyAd) => (a.sameCreative >= 10 || a.days >= 30 ? "quente" : a.sameCreative >= 3 || a.days >= 7 ? "validando" : "novo");
