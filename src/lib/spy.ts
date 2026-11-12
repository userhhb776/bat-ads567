/** Bat Spy: Meta Ad Library filters → library URL, and Apify item normalization. Shared by client and server. */
export type SpyFilters = { q: string; country: string; media: "all" | "video" | "image"; status: "active" | "all"; minActive: number; since: string; pageUrl: string; limit: number; lang: string; minDays?: number | undefined; checkout?: string | undefined; scale?: string | undefined; format?: string | undefined; noBrands?: boolean | undefined };
export const DEFAULT_FILTERS: SpyFilters = { q: "", country: "BR", media: "all", status: "active", minActive: 0, since: "", pageUrl: "", limit: 50, lang: "", minDays: 0, checkout: "todos", scale: "todos", format: "todos", noBrands: false };
export const COUNTRIES: [string, string][] = [["BR", "Brasil"], ["US", "EUA"], ["PT", "Portugal"], ["MX", "México"], ["ES", "Espanha"], ["AR", "Argentina"], ["CO", "Colômbia"], ["CL", "Chile"], ["GB", "Reino Unido"], ["CA", "Canadá"], ["DE", "Alemanha"], ["FR", "França"], ["IT", "Itália"], ["ALL", "Todos os países"]];
export const NICHES = ["emagrecimento", "renda extra", "relacionamento", "saúde masculina", "beleza", "skincare", "pets", "fitness", "espiritualidade", "finanças", "concurso", "idiomas", "dropshipping", "suplemento", "diabetes", "dor nas articulações", "infoproduto", "curso online"];

export type SpyAd = { id: string; pageId: string; pageName: string; pageUrl: string; avatar: string; text: string; title: string; cta: string; link: string; image: string; video: string; start: string; days: number; active: boolean; platforms: string[]; sameCreative: number; libraryUrl: string; format?: SpyFormat; cards?: number };
export type SpyFormat = "video" | "imagem" | "carrossel" | "dinamico";

export function libraryUrl(f: SpyFilters): string {
  if (/facebook\.com\/ads\/library/.test(f.pageUrl)) return f.pageUrl.trim();
  const u = new URL("https://www.facebook.com/ads/library/");
  u.searchParams.set("active_status", f.status);
  u.searchParams.set("ad_type", "all");
  u.searchParams.set("country", f.country || "ALL");
  u.searchParams.set("media_type", f.media);
  if (f.q.trim()) { u.searchParams.set("q", f.q.trim()); u.searchParams.set("search_type", "keyword_unordered"); }
  if (f.since) u.searchParams.set("start_date[min]", f.since);
  if (f.minDays && f.minDays > 0) u.searchParams.set("start_date[max]", new Date(Date.now() - f.minDays * 86400000).toISOString().slice(0, 10));
  if (f.lang) u.searchParams.set("content_languages[0]", f.lang);
  return u.toString();
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
/** Reads a field in snake_case or camelCase — the actor returns either depending on version. */
const g = (x: Obj, k: string): unknown => x[k] ?? x[camel(k)];

export function normalizeAd(raw: unknown, now = Date.now()): SpyAd | null {
  const r = o(raw), s = o(g(r, "snapshot"));
  const id = str(g(r, "ad_archive_id") ?? r["adArchiveID"] ?? r["id"]);
  if (!id) return null;
  const first = (k: string) => o((g(s, k) as unknown[] | undefined)?.[0]);
  const card = first("cards"), img = first("images"), vid = first("videos");
  const startRaw = g(r, "start_date");
  const start = typeof startRaw === "number" ? new Date(startRaw * 1000).toISOString() : str(startRaw);
  const t = Date.parse(start);
  const pageId = str(g(r, "page_id") ?? g(s, "page_id"));
  const pick = (...vals: unknown[]) => vals.map(str).find(Boolean) ?? "";
  const plat = g(r, "publisher_platform");
  const cards = Array.isArray(g(s, "cards")) ? (g(s, "cards") as unknown[]).length : 0;
  const disp = str(g(s, "display_format")).toUpperCase();
  const hasVideo = !!pick(g(vid, "video_hd_url"), g(vid, "video_sd_url"), g(card, "video_hd_url"), g(card, "video_sd_url"));
  const format: SpyFormat = disp === "DCO" || disp === "DPA" ? "dinamico" : disp === "CAROUSEL" || cards > 1 ? "carrossel" : hasVideo || disp === "VIDEO" ? "video" : "imagem";
  return {
    id, pageId, pageName: pick(g(r, "page_name"), g(s, "page_name")) || "Anunciante",
    pageUrl: str(g(s, "page_profile_uri")) || (pageId ? `https://www.facebook.com/${pageId}` : ""),
    avatar: str(g(s, "page_profile_picture_url")),
    text: pick(o(g(s, "body"))["text"], g(card, "body")),
    title: pick(g(s, "title"), g(card, "title")), cta: pick(g(s, "cta_text"), g(card, "cta_text")),
    link: pick(g(s, "link_url"), g(card, "link_url")),
    image: pick(g(img, "original_image_url"), g(img, "resized_image_url"), g(card, "original_image_url"), g(card, "resized_image_url"), g(vid, "video_preview_image_url"), g(card, "video_preview_image_url")),
    video: pick(g(vid, "video_hd_url"), g(vid, "video_sd_url"), g(card, "video_hd_url"), g(card, "video_sd_url")),
    start, days: Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86400000)) : 0,
    active: g(r, "is_active") !== false, platforms: Array.isArray(plat) ? (plat as unknown[]).map(str) : [],
    sameCreative: Number(g(r, "collation_count") ?? 1) || 1,
    libraryUrl: `https://www.facebook.com/ads/library/?id=${id}`, format, cards,
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

export const MIN_DAYS = [0, 3, 7, 10, 15, 30, 60, 90];
export const applyMinDays = (ads: SpyAd[], min = 0) => (min > 0 ? ads.filter((a) => a.days >= min) : ads);
/** Proxied download link so the creative saves straight to the device. */
export const mediaDownload = (url: string, name: string) => `/api/public/spy-media?u=${encodeURIComponent(url)}&n=${encodeURIComponent(name)}`;


/** Format for ads saved before the format field existed. */
export const formatOf = (a: SpyAd): SpyFormat => a.format ?? (a.video ? "video" : "imagem");
export const FORMATS: [string, string][] = [["todos", "Todos os formatos"], ["video", "Vídeo"], ["imagem", "Imagem"], ["carrossel", "Carrossel"], ["dinamico", "Dinâmico (vários criativos)"]];

/** Checkout / store platforms, detected from the destination link or the landing page HTML. */
export const CHECKOUTS: { id: string; label: string; url: RegExp; html: RegExp }[] = [
  { id: "kiwify", label: "Kiwify", url: /kiwify\./i, html: /kiwify\.(com|app)/i },
  { id: "hotmart", label: "Hotmart", url: /hotmart\.|hotm\.art/i, html: /pay\.hotmart\.com|go\.hotmart\.com|hotm\.art/i },
  { id: "perfectpay", label: "PerfectPay", url: /perfectpay/i, html: /perfectpay\.com|checkout\.perfectpay/i },
  { id: "eduzz", label: "Eduzz", url: /eduzz\./i, html: /sun\.eduzz\.com|eduzz\.com/i },
  { id: "monetizze", label: "Monetizze", url: /monetizze/i, html: /monetizze\.com/i },
  { id: "braip", label: "Braip", url: /braip/i, html: /braip\.com/i },
  { id: "ticto", label: "Ticto", url: /ticto\./i, html: /ticto\.(com|app)/i },
  { id: "kirvano", label: "Kirvano", url: /kirvano/i, html: /kirvano\.com/i },
  { id: "cartpanda", label: "CartPanda", url: /cartpanda/i, html: /cartpanda/i },
  { id: "yampi", label: "Yampi", url: /yampi\./i, html: /yampi\.(com|io)/i },
  { id: "shopify", label: "Shopify", url: /myshopify\.com/i, html: /cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i },
  { id: "nuvemshop", label: "Nuvemshop", url: /lojavirtualnuvem|nuvemshop/i, html: /nuvemshop|tiendanube|lojavirtualnuvem/i },
  { id: "woocommerce", label: "WooCommerce", url: /\/product\/|\?add-to-cart=/i, html: /woocommerce/i },
];
export const checkoutLabel = (id: string) => CHECKOUTS.find((c) => c.id === id)?.label ?? (id === "proprio" ? "Site próprio" : id === "whatsapp" ? "WhatsApp" : "");
/** Platform from the link alone (free, no request). Returns "" when the link doesn't tell. */
export function checkoutFromUrl(url: string): string {
  if (!url) return "";
  if (/wa\.me|api\.whatsapp|whatsapp\.com/i.test(url)) return "whatsapp";
  return CHECKOUTS.find((c) => c.url.test(url))?.id ?? "";
}
/** Platform from the landing page HTML; falls back to "proprio" (own site). */
export const checkoutFromHtml = (html: string): string => CHECKOUTS.find((c) => c.html.test(html))?.id ?? "proprio";

/** Advertiser scale from active ads of the page in the mined set. */
export const SCALES: [string, string][] = [["todos", "Qualquer escala"], ["super", "Super escala (20+ ativos)"], ["validando", "Validando (5 a 19)"], ["teste", "Iniciando / teste (1 a 4)"]];
export const scaleOf = (active: number) => (active >= 20 ? "super" : active >= 5 ? "validando" : active >= 1 ? "teste" : "");
export function applyScale(ads: SpyAd[], scale = "todos"): SpyAd[] {
  if (!scale || scale === "todos") return ads;
  const ok = new Set(advertisers(ads).filter((a) => scaleOf(a.active) === scale).map((a) => a.pageId || a.pageName));
  return ads.filter((a) => ok.has(a.pageId || a.pageName));
}

/** Big marketplaces/brands that hide direct-response offers. */
export const BIG_BRANDS = ["shopee", "mercado livre", "mercadolivre", "amazon", "magalu", "magazine luiza", "americanas", "casas bahia", "aliexpress", "temu", "shein", "netshoes", "centauro", "nike", "adidas", "samsung", "apple", "ifood", "uber", "99app", "nubank", "itaú", "itau", "bradesco", "santander", "caixa", "banco do brasil", "inter", "picpay", "mercado pago", "natura", "boticário", "o boticário", "avon", "renner", "riachuelo", "c&a", "kwai", "tiktok", "google", "meta", "facebook", "instagram", "netflix", "spotify", "coca-cola", "ambev", "claro", "vivo", "tim", "carrefour", "assaí", "pão de açúcar", "drogasil", "raia", "pague menos", "kabum", "dell", "lg", "motorola", "xiaomi"];
const BRAND_HOSTS = /(^|\.)(shopee|mercadolivre|mercadolibre|amazon|magazineluiza|magalu|americanas|casasbahia|aliexpress|temu|shein|netshoes|nike|adidas|samsung|apple|ifood|nubank|kabum)\./i;
export function isBigBrand(a: SpyAd): boolean {
  const name = a.pageName.toLowerCase().trim();
  if (BIG_BRANDS.some((b) => name === b || name.startsWith(b + " ") || name.endsWith(" " + b))) return true;
  try { return !!a.link && BRAND_HOSTS.test(new URL(a.link).hostname); } catch { return false; }
}

/** Adds a new batch without duplicates; tells how many were new. */
export function mergeAds(prev: SpyAd[], fresh: SpyAd[]): { ads: SpyAd[]; added: number } {
  const seen = new Set(prev.map((a) => a.id));
  const extra = fresh.filter((a) => !seen.has(a.id) && (seen.add(a.id), true));
  return { ads: [...prev, ...extra], added: extra.length };
}
export const MAX_PER_SEARCH = 1000;
/** End of the library: nothing new came back, or fewer than asked (the library ran out), or the per-search cap. */
export const reachedEnd = (asked: number, returned: number, added: number) => added === 0 || returned < asked * 0.9 || asked >= MAX_PER_SEARCH;

/** Sentinela: a saved term/page the 24h watch re-checks and alerts on. */
export type SpySentinel = { id: string; label: string; q: string; pageUrl: string; country: string; minDays: number; everyHours: number; whatsapp: string; active: boolean };
export const sentinelDue = (s: SpySentinel, lastIso: string, now = Date.now()) => s.active && (!lastIso || now - Date.parse(lastIso) >= s.everyHours * 3600e3);
/** Ads that crossed the sentinel's minimum days and were never alerted before. */
export const sentinelHits = (ads: SpyAd[], minDays: number, seen: string[]) => {
  const old = new Set(seen);
  return ads.filter((a) => a.active && a.days >= minDays && !old.has(a.id));
};
