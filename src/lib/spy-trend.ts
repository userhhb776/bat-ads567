import type { SpyAd } from "./spy";

/** One daily count of a page's active ads ("exact" = counted on the page itself, not only what a search returned). */
export type Snap = { day: string; active: number; launched7?: number; exact?: boolean };
export type PageStats = { key: string; pageName: string; active: number; launched7: number; launched30: number; newestDays: number };

export const pageKey = (a: Pick<SpyAd, "pageId" | "pageName">) => a.pageId || a.pageName;
export const isoDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

/** Groups mined ads by page: active ads seen, how many started in the last 7/30 days and the newest launch. */
export function pageStats(ads: SpyAd[]): Map<string, PageStats> {
  const m = new Map<string, PageStats>();
  for (const a of ads) {
    const k = pageKey(a); if (!k) continue;
    const s = m.get(k) ?? { key: k, pageName: a.pageName, active: 0, launched7: 0, launched30: 0, newestDays: Infinity };
    const n = Math.max(1, a.sameCreative);
    if (a.active) s.active += n;
    if (a.days <= 7) s.launched7 += n;
    if (a.days <= 30) s.launched30 += n;
    s.newestDays = Math.min(s.newestDays, a.days);
    m.set(k, s);
  }
  return m;
}

export type Pace = { kind: "acelerando" | "estavel" | "desacelerando"; label: string };
/** Launch rhythm from the start dates alone — works on the very first search. */
export function pace(s: PageStats | undefined): Pace | null {
  if (!s || s.active <= 0) return null;
  if (s.launched7 >= 3 && s.launched7 / s.active >= 0.3) return { kind: "acelerando", label: `Acelerando · +${s.launched7} novos em 7 dias` };
  if (s.active >= 3 && s.newestDays >= 20 && Number.isFinite(s.newestDays)) return { kind: "desacelerando", label: `Sem anúncio novo há ${s.newestDays} dias` };
  return { kind: "estavel", label: s.launched30 ? `${s.launched30} novos em 30 dias` : "Ritmo estável" };
}

export type Delta = { from: number; to: number; fromDay: string; pct: number };
export type Trend = { series: Snap[]; last: Snap | null; d1: Delta | null; d3: Delta | null; d30: Delta | null; kind: "subindo" | "descendo" | "estavel" | "sem-historico"; exact: boolean };

const delta = (from: Snap, to: Snap): Delta => ({ from: from.active, to: to.active, fromDay: from.day, pct: from.active ? Math.round(((to.active - from.active) / from.active) * 100) : to.active ? 100 : 0 });
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Day-by-day change of active ads over the last 30 days; prefers exact counts when there are at least two. */
export function trend(snaps: Snap[], today = isoDay()): Trend {
  const inWindow = [...snaps].filter((s) => dayDiff(s.day, today) <= 30 && dayDiff(s.day, today) >= 0).sort((a, b) => a.day.localeCompare(b.day));
  const exactOnes = inWindow.filter((s) => s.exact);
  const series = exactOnes.length >= 2 ? exactOnes : inWindow;
  const last = series.at(-1) ?? null;
  if (!last || series.length < 2) return { series, last, d1: null, d3: null, d30: null, kind: "sem-historico", exact: exactOnes.length >= 2 };
  const before = (days: number) => [...series].reverse().find((s) => dayDiff(s.day, last.day) >= days) ?? null;
  const p1 = series.at(-2)!, p3 = before(3), first = series[0]!;
  const d1 = delta(p1, last), d3 = p3 ? delta(p3, last) : null, d30 = first !== last ? delta(first, last) : null;
  const ref = d30 ?? d3 ?? d1;
  return { series, last, d1, d3, d30, kind: ref.pct >= 10 ? "subindo" : ref.pct <= -10 ? "descendo" : "estavel", exact: exactOnes.length >= 2 };
}

/** Merges today's counts into an existing same-day snapshot: exact counts win, otherwise keep the highest seen. */
export function mergeSnap(prev: Snap | undefined, next: Snap): Snap {
  if (!prev) return next;
  if (next.exact && !prev.exact) return next;
  if (prev.exact && !next.exact) return prev;
  return { ...next, active: Math.max(prev.active, next.active), launched7: Math.max(prev.launched7 ?? 0, next.launched7 ?? 0) };
}
