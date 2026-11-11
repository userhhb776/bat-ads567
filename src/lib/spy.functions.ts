import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { libraryUrl, normalizeAd, type SpyAd } from "./spy";

const API = "https://api.apify.com/v2";
const ACTOR = "curious_coder~facebook-ads-library-scraper";
const SLOTS = ["apify", "apify-2", "apify-3", "apify-4"] as const;

async function keys(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("gateway_credentials" as never).select("platform, token").eq("user_id", userId).in("platform", SLOTS as never);
  const rows = (data ?? []) as { platform: string; token: string }[];
  return SLOTS.map((s) => rows.find((r) => r.platform === s)).filter((r): r is { platform: string; token: string } => !!r?.token);
}

/** Balance per saved key (slot) so the chefe sees when to renew or swap. */
export const apifyStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const list = await keys(context.userId);
  return Promise.all(list.map(async (k) => {
    try {
      const h = { Authorization: `Bearer ${k.token}` };
      const [me, lim] = await Promise.all([fetch(`${API}/users/me`, { headers: h }), fetch(`${API}/users/me/limits`, { headers: h })]);
      if (!me.ok) return { slot: k.platform, ok: false, error: me.status === 401 ? "Chave inválida ou expirada." : `Apify respondeu ${me.status}.`, plan: "", used: 0, limit: 0, resetAt: "" };
      const u = ((await me.json()) as { data?: { username?: string; plan?: { id?: string } } }).data;
      const l = lim.ok ? ((await lim.json()) as { data?: { current?: { monthlyUsageUsd?: number }; limits?: { maxMonthlyUsageUsd?: number }; monthlyUsageCycle?: { endAt?: string } } }).data : undefined;
      return { slot: k.platform, ok: true, error: "", plan: `${u?.plan?.id ?? "?"} · ${u?.username ?? ""}`, used: l?.current?.monthlyUsageUsd ?? 0, limit: l?.limits?.maxMonthlyUsageUsd ?? 0, resetAt: l?.monthlyUsageCycle?.endAt ?? "" };
    } catch { return { slot: k.platform, ok: false, error: "Apify não respondeu.", plan: "", used: 0, limit: 0, resetAt: "" }; }
  }));
});

const filters = z.object({ q: z.string().max(200), country: z.string().max(4), media: z.enum(["all", "video", "image"]), status: z.enum(["active", "all"]), minActive: z.number().int().min(0).max(500), since: z.string().max(10), pageUrl: z.string().max(1000), limit: z.number().int().min(10).max(300), lang: z.string().max(5), minDays: z.number().int().min(0).max(365).optional() });

/** Runs the Ad Library actor, rotating to the next saved key when one is out of credit. */
export const spySearch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => filters.parse(d))
  .handler(async ({ data, context }): Promise<{ ads: SpyAd[]; error: string; slot: string }> => {
    if (!data.q.trim() && !data.pageUrl.trim()) return { ads: [], error: "Digite um termo, nicho ou link da página.", slot: "" };
    const list = await keys(context.userId);
    if (!list.length) return { ads: [], error: "Cadastre a chave da Apify em Configurações → Bat Spy.", slot: "" };
    const url = /^https?:\/\//.test(data.pageUrl) && !/ads\/library/.test(data.pageUrl) ? data.pageUrl.trim() : libraryUrl(data);
    const fails: string[] = [];
    for (const k of list) {
      try {
        const r = await fetch(`${API}/acts/${ACTOR}/run-sync-get-dataset-items?timeout=240&limit=${data.limit}`, {
          method: "POST", headers: { Authorization: `Bearer ${k.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ urls: [{ url }], count: data.limit, "scrapePageAds.activeStatus": data.status, period: "" }),
        });
        if (r.status === 402 || r.status === 403 || r.status === 429) { fails.push(`${k.platform}: sem crédito (${r.status})`); continue; }
        if (!r.ok) { const t = (await r.text()).slice(0, 200); console.error("apify", r.status, t); return { ads: [], error: `Apify respondeu ${r.status}: ${t}`, slot: k.platform }; }
        const items = (await r.json()) as unknown[];
        const ads = (Array.isArray(items) ? items : []).map((i) => normalizeAd(i)).filter((a): a is SpyAd => !!a);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "bat-spy", action: "minerar", target: data.q || data.pageUrl, after: { found: ads.length, slot: k.platform } as never, result: "ok" });
        return { ads, error: ads.length ? "" : "Nada encontrado com esses filtros.", slot: k.platform };
      } catch { fails.push(`${k.platform}: sem resposta`); }
    }
    return { ads: [], error: `Todas as chaves falharam — ${fails.join("; ")}`, slot: "" };
  });
