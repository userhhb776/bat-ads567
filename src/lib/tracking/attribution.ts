export type TrackEvent = {
  visitor_id: string; session_id: string; event: string; url: string | null;
  utm: Record<string, string>; source: string | null; email: string | null; phone: string | null; created_at: string;
};

export type Journey = { visitor: string; first: string; last: string; sessions: number; events: number; email: string | null; phone: string | null; converted: boolean };

const CONVERSION = new Set(['lead', 'checkout', 'purchase']);

/** Groups events per visitor and resolves first-click and last-click source (oldest/newest event with a source). */
export function buildJourneys(events: TrackEvent[]): Journey[] {
  const by = new Map<string, TrackEvent[]>();
  for (const e of events) (by.get(e.visitor_id) ?? by.set(e.visitor_id, []).get(e.visitor_id)!).push(e);
  return [...by.entries()].map(([visitor, list]) => {
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const tagged = sorted.filter((e) => e.source && e.source !== 'direct');
    return {
      visitor,
      first: tagged[0]?.source ?? 'direct',
      last: tagged[tagged.length - 1]?.source ?? 'direct',
      sessions: new Set(sorted.map((e) => e.session_id)).size,
      events: sorted.length,
      email: [...sorted].reverse().find((e) => e.email)?.email ?? null,
      phone: [...sorted].reverse().find((e) => e.phone)?.phone ?? null,
      converted: sorted.some((e) => CONVERSION.has(e.event)),
    };
  });
}

/** Counts visitors and conversions per source for the chosen attribution model. */
export function bySource(journeys: Journey[], model: 'first' | 'last') {
  const out: Record<string, { visitors: number; conversions: number }> = {};
  for (const j of journeys) { const k = j[model]; out[k] ??= { visitors: 0, conversions: 0 }; out[k].visitors++; if (j.converted) out[k].conversions++; }
  return Object.entries(out).sort((a, b) => b[1].visitors - a[1].visitors);
}

/** Source label from UTMs, click ids or referrer. */
export function sourceOf(utm: Record<string, string>, referrer: string | null): string {
  if (utm['fbclid'] || /facebook|fb|instagram|ig|meta/i.test(utm['utm_source'] ?? '')) return 'meta';
  if (utm['gclid'] || /google/i.test(utm['utm_source'] ?? '')) return 'google';
  if (utm['ttclid'] || /tiktok/i.test(utm['utm_source'] ?? '')) return 'tiktok';
  if (utm['utm_source']) return utm['utm_source'].toLowerCase().slice(0, 40);
  if (referrer) { try { const h = new URL(referrer).hostname; if (/google|bing|yahoo/.test(h)) return 'organic'; return h.replace(/^www\./, '').slice(0, 40); } catch { /* ignore */ } }
  return 'direct';
}
