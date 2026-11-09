import { actionValue } from "./use-account";

export type Creative = { id: string; name: string; kind: "image" | "video"; path: string; size: number; tags: string[]; category: string; productId: string; campaignId: string; adIds: string[]; notes: string; createdAt: number; metaHash?: string };
export type CopyItem = { id: string; name: string; kind: "texto" | "titulo" | "descricao" | "referencia"; text: string; cta: string; url: string; productId: string; tags: string[]; createdAt: number };

const PURCHASE = ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"];
const LEAD = ["lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"];

export type AdScore = { id: string; name: string; thumb: string; spend: number; impressions: number; ctr: number; purchases: number; leads: number; revenue: number; cpa: number | null; roas: number | null; verdict: "vencedor" | "ruim" | "em teste" };

/** Scores ads; verdicts need minimum spend/impressions so early data never labels a creative. */
export function scoreAds(ads: any[], opts: { minSpend: number; targetCpa?: number | undefined; minRoas?: number | undefined }): AdScore[] {
  const rows = ads.map((a) => {
    const i = a.insights ?? {};
    const spend = Number(i.spend ?? 0), impressions = Number(i.impressions ?? 0);
    const purchases = actionValue(i.actions, PURCHASE), leads = actionValue(i.actions, LEAD), revenue = actionValue(i.action_values, PURCHASE);
    const results = purchases || leads;
    return { id: a.id, name: a.name, thumb: a.creative?.thumbnail_url ?? "", spend, impressions, ctr: Number(i.ctr ?? 0), purchases, leads, revenue, cpa: results ? spend / results : null, roas: spend && revenue ? revenue / spend : null, verdict: "em teste" as AdScore["verdict"] };
  });
  const mature = rows.filter((r) => r.spend >= opts.minSpend && r.impressions >= 500);
  const ctrs = mature.map((r) => r.ctr).sort((a, b) => a - b);
  const medianCtr = ctrs.length ? ctrs[Math.floor(ctrs.length / 2)]! : 0;
  for (const r of mature) {
    const good = (opts.minRoas && r.roas !== null && r.roas >= opts.minRoas) || (opts.targetCpa && r.cpa !== null && r.cpa <= opts.targetCpa);
    const bad = r.cpa === null || (opts.targetCpa && r.cpa > opts.targetCpa * 1.5) || (opts.minRoas && (r.roas ?? 0) < opts.minRoas * 0.5) || (!opts.targetCpa && !opts.minRoas && r.ctr < medianCtr * 0.6);
    r.verdict = good ? "vencedor" : bad ? "ruim" : "em teste";
  }
  return rows;
}
