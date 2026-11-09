import { actionValue } from "./use-account";

const PURCHASE = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"];
const LEAD = ["lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"];

export type Metrics = { spend: number; impressions: number; reach: number; clicks: number; linkClicks: number; purchases: number; leads: number; revenue: number; ctr: number; cpc: number; cpm: number; cpa: number; roas: number };

export function metricsOf(insights: any): Metrics {
  const i = insights ?? {};
  const spend = Number(i.spend ?? 0), impressions = Number(i.impressions ?? 0), clicks = Number(i.clicks ?? 0);
  const purchases = actionValue(i.actions, PURCHASE), leads = actionValue(i.actions, LEAD), revenue = actionValue(i.action_values, PURCHASE);
  return {
    spend, impressions, reach: Number(i.reach ?? 0), clicks, linkClicks: Number(i.inline_link_clicks ?? 0), purchases, leads, revenue,
    ctr: impressions ? (clicks / impressions) * 100 : 0, cpc: clicks ? spend / clicks : 0, cpm: impressions ? (spend / impressions) * 1000 : 0,
    cpa: purchases || leads ? spend / (purchases || leads) : 0, roas: spend ? revenue / spend : 0,
  };
}

export function sumMetrics(list: Metrics[]): Metrics {
  const s = list.reduce((a, m) => ({ ...a, spend: a.spend + m.spend, impressions: a.impressions + m.impressions, reach: a.reach + m.reach, clicks: a.clicks + m.clicks, linkClicks: a.linkClicks + m.linkClicks, purchases: a.purchases + m.purchases, leads: a.leads + m.leads, revenue: a.revenue + m.revenue }), metricsOf(null));
  return { ...s, ctr: s.impressions ? (s.clicks / s.impressions) * 100 : 0, cpc: s.clicks ? s.spend / s.clicks : 0, cpm: s.impressions ? (s.spend / s.impressions) * 1000 : 0, cpa: s.purchases || s.leads ? s.spend / (s.purchases || s.leads) : 0, roas: s.spend ? s.revenue / s.spend : 0 };
}

/** Percent change; null when the previous value is zero (no meaningful comparison). */
export const delta = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : null);

/** The same-length period immediately before [since, until]. */
export function previousRange(since: string, until: string) {
  const a = new Date(`${since}T00:00:00Z`), b = new Date(`${until}T00:00:00Z`);
  const days = Math.round((b.getTime() - a.getTime()) / 864e5) + 1;
  const pu = new Date(a.getTime() - 864e5), ps = new Date(pu.getTime() - (days - 1) * 864e5);
  const f = (d: Date) => d.toISOString().slice(0, 10);
  return { since: f(ps), until: f(pu) };
}
