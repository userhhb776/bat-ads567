/** Normalized website traffic estimate (Similarweb-style data), shown in the Bat Spy offer detail. */
export type Traffic = {
  domain: string; available: boolean; month: string;
  visits: number; prevVisits: number; changePct: number | null;
  history: { month: string; visits: number }[];
  bounce: number | null; pagesPerVisit: number | null; timeOnSite: number | null;
  globalRank: number | null; countryRank: number | null; countryCode: string;
  countries: { code: string; name: string; pct: number }[];
  sources: { label: string; pct: number }[];
};

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const num = (v: unknown): number | null => { const n = typeof v === "string" ? Number(v) : v; return typeof n === "number" && Number.isFinite(n) ? n : null; };
/** Reads a key in PascalCase or camelCase. */
const g = (x: Obj, k: string): unknown => x[k] ?? x[k[0]!.toLowerCase() + k.slice(1)] ?? x[k[0]!.toUpperCase() + k.slice(1)];

/** Domain of an offer link, without "www." — empty for non-web links. */
export function domainOf(url: string): string {
  try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, "").toLowerCase() : ""; } catch { return ""; }
}

const SOURCE_LABELS: [string, string][] = [["Direct", "Direto"], ["Search", "Busca"], ["Social", "Redes sociais"], ["Paid Referrals", "Anúncios"], ["Referrals", "Indicações"], ["Mail", "E-mail"]];

/** Accepts the free Similarweb endpoint shape or the traffic actor's shape and returns one format. */
export function normalizeTraffic(raw: unknown, domain: string): Traffic {
  const r = o(Array.isArray(raw) ? raw[0] : raw);
  const monthly = o(g(r, "EstimatedMonthlyVisits"));
  const hist = Array.isArray(g(r, "trafficHistory"))
    ? (g(r, "trafficHistory") as unknown[]).map((h) => ({ month: String(g(o(h), "month") ?? g(o(h), "date") ?? "").slice(0, 7), visits: num(g(o(h), "visits")) ?? 0 }))
    : Object.entries(monthly).map(([k, v]) => ({ month: k.slice(0, 7), visits: num(v) ?? 0 }));
  const history = hist.filter((h) => h.month).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  const eng = o(g(r, "Engagments") ?? g(r, "engagement"));
  const visits = num(g(r, "latestMonthlyVisits")) ?? history.at(-1)?.visits ?? num(g(eng, "Visits")) ?? 0;
  const prevVisits = num(g(r, "previousMonthlyVisits")) ?? history.at(-2)?.visits ?? 0;
  const bounceRaw = num(g(r, "bounceRatePercent")) ?? ((): number | null => { const b = num(g(eng, "BounceRate")); return b === null ? null : b * 100; })();
  const cr = o(g(r, "CountryRank"));
  const countries = (Array.isArray(g(r, "TopCountryShares")) ? (g(r, "TopCountryShares") as unknown[]) : []).map((c) => {
    const x = o(c); const share = num(g(x, "Value") ?? g(x, "share")) ?? 0;
    return { code: String(g(x, "CountryCode") ?? ""), name: String(g(x, "CountryName") ?? g(x, "CountryCode") ?? ""), pct: Math.round(share * 1000) / 10 };
  }).filter((c) => c.code || c.name).slice(0, 5);
  const src = o(g(r, "TrafficSources"));
  const sources = SOURCE_LABELS.map(([k, label]) => ({ label, pct: Math.round((num(src[k] ?? src[k[0]!.toLowerCase() + k.slice(1).replace(" ", "")]) ?? 0) * 1000) / 10 })).filter((s) => s.pct > 0).sort((a, b) => b.pct - a.pct);
  const month = String(g(r, "snapshotDate") ?? (g(eng, "Year") ? `${g(eng, "Year")}-${String(g(eng, "Month")).padStart(2, "0")}` : history.at(-1)?.month ?? "")).slice(0, 7);
  return {
    domain, available: visits > 0, month, visits: Math.round(visits), prevVisits: Math.round(prevVisits),
    changePct: num(g(r, "trafficChangePercent")) ?? (prevVisits ? Math.round(((visits - prevVisits) / prevVisits) * 100) : null),
    history, bounce: bounceRaw === null ? null : Math.round(bounceRaw * 10) / 10,
    pagesPerVisit: (() => { const p = num(g(r, "pagesPerVisit")) ?? num(g(eng, "PagePerVisit")); return p === null ? null : Math.round(p * 10) / 10; })(),
    timeOnSite: (() => { const t = num(g(r, "timeOnSiteSeconds")) ?? num(g(eng, "TimeOnSite")); return t === null ? null : Math.round(t); })(),
    globalRank: num(g(o(g(r, "GlobalRank")), "Rank")) ?? num(g(r, "globalRank")),
    countryRank: num(g(cr, "Rank")) ?? num(g(r, "countryRankValue")), countryCode: String(g(cr, "CountryCode") ?? g(r, "countryCode") ?? ""),
    countries, sources,
  };
}

export const fmtVisits = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")} mi` : n >= 1e3 ? `${Math.round(n / 1e3)} mil` : String(n));
