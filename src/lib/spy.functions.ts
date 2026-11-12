import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_PER_SEARCH, type SpyAd } from "./spy";

const API = "https://api.apify.com/v2";
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

/** Balance per saved key (slot) so the chefe sees when to renew or swap. */
export const apifyStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { apifyKeys } = await import("./spy.server");
  const list = await apifyKeys(await admin(), context.userId);
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

const filters = z.object({ q: z.string().max(200), country: z.string().max(4), media: z.enum(["all", "video", "image"]), status: z.enum(["active", "all"]), minActive: z.number().int().min(0).max(500), since: z.string().max(10), pageUrl: z.string().max(1000), limit: z.number().int().min(10).max(MAX_PER_SEARCH), lang: z.string().max(5), minDays: z.number().int().min(0).max(365).optional() });

/** Runs the Ad Library actor ("Minerar" and "Minerar mais"), rotating keys when one is out of credit. */
export const spySearch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => filters.parse(d))
  .handler(async ({ data, context }): Promise<{ ads: SpyAd[]; error: string; slot: string }> => {
    if (!data.q.trim() && !data.pageUrl.trim()) return { ads: [], error: "Digite um termo, nicho ou link da página.", slot: "" };
    const { runSpy } = await import("./spy.server");
    const db = await admin();
    const r = await runSpy(db, context.userId, data);
    if (r.slot && !r.error) await db.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "bat-spy", action: "minerar", target: data.q || data.pageUrl, after: { found: r.ads.length, asked: data.limit, slot: r.slot } as never, result: "ok" });
    return { ...r, error: r.error || (r.ads.length ? "" : "Nada encontrado com esses filtros.") };
  });

/** Free check of which checkout/store each landing page uses (reads the page, no Apify credit). */
export const spyTech = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ urls: z.array(z.string().url().max(1000)).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { detectTech } = await import("./spy.server");
    const out: Record<string, string> = {};
    const urls = [...new Set(data.urls)];
    for (let i = 0; i < urls.length; i += 8) await Promise.all(urls.slice(i, i + 8).map(async (u) => { out[u] = await detectTech(u); }));
    return out;
  });

const xrayAd = z.object({ pageName: z.string().max(200), title: z.string().max(500), text: z.string().max(3000), link: z.string().max(1000), days: z.number(), cta: z.string().max(100), sameCreative: z.number() });
/** Crowley's Raio-X: hook, pain, unique mechanism, promise, offer and how to model — from the longest-running ads. */
export const spyXray = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ niche: z.string().max(200), ads: z.array(xrayAd).min(1).max(8) }).parse(d))
  .handler(async ({ data, context }) => {
    const { askAgentAi } = await import("./ai-agent.server");
    const { parseXray } = await import("./spy.server");
    const system = `Você é o Crowley, estrategista de tráfego direto. Analise anúncios que estão há muito tempo no ar (sinal de que vendem) e responda SÓ em JSON:
{"gancho":"a frase de abertura mais forte, adaptada","dor":"a dor principal do público","mecanismo":"o mecanismo único / porque funciona diferente","promessa":"a promessa central","oferta":"como a oferta é apresentada (preço, bônus, garantia, urgência) — só o que aparece","angulos":["3 a 5 ângulos de copy para testar"],"modelar":["3 a 5 passos práticos para eu modelar sem copiar"]}
Português do Brasil, linguagem simples e direta, sem termos técnicos. Não invente números ou dados que não estão nos anúncios.`;
    const user = `Nicho/busca: ${data.niche || "não informado"}\n\n` + data.ads.map((a, i) => `Anúncio ${i + 1} — ${a.pageName} · ${a.days} dias no ar · ${a.sameCreative} anúncio(s) com o criativo\nTítulo: ${a.title}\nBotão: ${a.cta}\nTexto: ${a.text}\nDestino: ${a.link}`).join("\n\n");
    const ai = await askAgentAi(system, user);
    if (ai.error) return { xray: null, error: `A IA não respondeu: ${ai.error}` };
    const xray = parseXray(ai.text);
    await (await admin()).from("audit_log").insert({ user_id: context.userId, actor: "crowley", module: "bat-spy", action: "raio-x", target: data.niche || data.ads[0]!.pageName, after: { ads: data.ads.length } as never, result: xray ? "ok" : "erro" });
    return xray ? { xray, error: "" } : { xray: null, error: "A IA respondeu fora do formato. Tente de novo." };
  });

/** What each sentinel found on its last checks (state kept server-side by the 24h watch). */
export const spySentinelStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data } = await context.supabase.from("app_state").select("key,value").eq("user_id", context.userId).like("key", "srv.spy-sentinel.%");
  const out: Record<string, { at: string; checked: string; running: boolean; error: string; hits: SpyAd[] }> = {};
  for (const r of data ?? []) {
    const v = (r.value ?? {}) as { at?: string; checked?: string; runId?: string; error?: string; hits?: SpyAd[] };
    out[String(r.key).slice("srv.spy-sentinel.".length)] = { at: v.at ?? "", checked: v.checked ?? "", running: !!v.runId, error: v.error ?? "", hits: v.hits ?? [] };
  }
  return out;
});
