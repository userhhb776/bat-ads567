import type { SupabaseClient } from "@supabase/supabase-js";
import { checkoutFromHtml, libraryUrl, normalizeAd, sentinelDue, sentinelHits, DEFAULT_FILTERS, type SpyAd, type SpyFilters, type SpySentinel } from "./spy";

type Admin = SupabaseClient<any>;
const API = "https://api.apify.com/v2";
const ACTOR = "curious_coder~facebook-ads-library-scraper";
export const SLOTS = ["apify", "apify-2", "apify-3", "apify-4", "apify-5", "apify-6", "apify-7", "apify-8"] as const;
const OUT = [402, 403, 429];

export async function apifyKeys(admin: Admin, userId: string) {
  const { data } = await admin.from("gateway_credentials" as never).select("platform, token").eq("user_id", userId).in("platform", SLOTS as never);
  const rows = (data ?? []) as { platform: string; token: string }[];
  return SLOTS.map((s) => rows.find((r) => r.platform === s)).filter((r): r is { platform: string; token: string } => !!r?.token);
}

const targetUrl = (f: SpyFilters) => (/^https?:\/\//.test(f.pageUrl) && !/ads\/library/.test(f.pageUrl) ? f.pageUrl.trim() : libraryUrl(f));
const actorInput = (f: SpyFilters) => JSON.stringify({ urls: [{ url: targetUrl(f) }], count: f.limit, "scrapePageAds.activeStatus": f.status, period: "" });
const toAds = (items: unknown) => (Array.isArray(items) ? items : []).map((i) => normalizeAd(i)).filter((a): a is SpyAd => !!a);

/** Runs the Ad Library actor and waits, rotating to the next saved key when one is out of credit. */
export async function runSpy(admin: Admin, userId: string, f: SpyFilters): Promise<{ ads: SpyAd[]; error: string; slot: string }> {
  const list = await apifyKeys(admin, userId);
  if (!list.length) return { ads: [], error: "Cadastre a chave da Apify em Configurações → Bat Spy.", slot: "" };
  const fails: string[] = [];
  for (const k of list) {
    try {
      const r = await fetch(`${API}/acts/${ACTOR}/run-sync-get-dataset-items?timeout=300&limit=${f.limit + 30}`, { method: "POST", headers: { Authorization: `Bearer ${k.token}`, "Content-Type": "application/json" }, body: actorInput(f) });
      if (OUT.includes(r.status)) { fails.push(`${k.platform}: sem crédito (${r.status})`); continue; }
      if (!r.ok) { const t = (await r.text()).slice(0, 200); console.error("apify", r.status, t); return { ads: [], error: `Apify respondeu ${r.status}: ${t}`, slot: k.platform }; }
      return { ads: toAds(await r.json()), error: "", slot: k.platform };
    } catch { fails.push(`${k.platform}: sem resposta`); }
  }
  return { ads: [], error: `Todas as chaves falharam — ${fails.join("; ")}`, slot: "" };
}

const PRIVATE = /^(localhost|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[|::|metadata)/i;
/** Reads a landing page (max 400KB, 8s) to tell which checkout/store platform it uses. Public http(s) hosts only. */
export async function detectTech(url: string): Promise<string> {
  let u: URL;
  try { u = new URL(url); } catch { return ""; }
  if (!/^https?:$/.test(u.protocol) || PRIVATE.test(u.hostname) || !u.hostname.includes(".")) return "";
  try {
    const r = await fetch(u.toString(), { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36", Accept: "text/html" } });
    if (!r.ok || !r.body) return "";
    const reader = r.body.getReader(); const dec = new TextDecoder(); let html = "";
    while (html.length < 400_000) { const { done, value } = await reader.read(); if (done) break; html += dec.decode(value, { stream: true }); }
    void reader.cancel().catch(() => {});
    return checkoutFromHtml(`${r.url} ${html}`);
  } catch { return ""; }
}

export type Xray = { gancho: string; dor: string; mecanismo: string; promessa: string; oferta: string; angulos: string[]; modelar: string[] };
const s = (v: unknown, n = 400) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => s(x, 240)).filter(Boolean).slice(0, 6) : []);
export function parseXray(text: string): Xray | null {
  try {
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, unknown>;
    const x = { gancho: s(j["gancho"]), dor: s(j["dor"]), mecanismo: s(j["mecanismo"]), promessa: s(j["promessa"]), oferta: s(j["oferta"]), angulos: arr(j["angulos"]), modelar: arr(j["modelar"]) };
    return x.gancho || x.promessa ? x : null;
  } catch { return null; }
}

/** Sentinela pass for the 24h watch: starts a background actor run when due, and collects it on a later pass. */
export async function runSentinels(admin: Admin, stopped: Set<string>) {
  const { data: rows } = await admin.from("app_state").select("user_id,value").eq("key", "bg.spy-sentinels");
  let started = 0, alerts = 0;
  for (const row of rows ?? []) {
    const userId = row.user_id as string;
    if (stopped.has(userId) || !Array.isArray(row.value)) continue;
    const keys = await apifyKeys(admin, userId);
    if (!keys.length) continue;
    for (const sen of (row.value as SpySentinel[]).filter((x) => x?.id && x.active && (x.q?.trim() || x.pageUrl?.trim()))) {
      const key = `srv.spy-sentinel.${sen.id}`;
      const { data: st } = await admin.from("app_state").select("value").eq("user_id", userId).eq("key", key).maybeSingle();
      const state = (st?.value ?? {}) as { at?: string; runId?: string; slot?: string; seen?: string[]; hits?: SpyAd[]; error?: string; checked?: string };
      const save = (v: typeof state) => admin.from("app_state").upsert({ user_id: userId, key, value: v as never }, { onConflict: "user_id,key" });
      if (state.runId) {
        const token = keys.find((k) => k.platform === state.slot)?.token ?? keys[0]!.token;
        const run = await fetch(`${API}/actor-runs/${state.runId}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as { data?: { status?: string; defaultDatasetId?: string } } | null;
        const status = run?.data?.status ?? "";
        if (status === "READY" || status === "RUNNING") continue;
        if (status !== "SUCCEEDED" || !run?.data?.defaultDatasetId) { await save({ ...state, runId: "", error: `Busca terminou como ${status || "desconhecida"}.`, checked: new Date().toISOString() }); continue; }
        const items = await fetch(`${API}/datasets/${run.data.defaultDatasetId}/items?clean=true&limit=200`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
        const ads = toAds(items);
        const hits = sentinelHits(ads, sen.minDays, state.seen ?? []);
        const seen = [...new Set([...(state.seen ?? []), ...hits.map((h) => h.id)])].slice(-2000);
        await save({ ...state, runId: "", error: "", seen, hits: [...hits, ...(state.hits ?? [])].slice(0, 60), checked: new Date().toISOString() });
        if (hits.length) {
          alerts++;
          const title = `Sentinela: ${hits.length} oferta(s) com ${sen.minDays}+ dias no ar`;
          const body = `${sen.label || sen.q || "Página vigiada"} — ${hits.slice(0, 3).map((h) => h.pageName).join(", ")}`;
          const { notifyUser } = await import("./notify.server");
          await notifyUser(admin, userId, { kind: "bat-spy", title, body, link: "/bat-spy/sentinela" });
          if (sen.whatsapp?.replace(/\D/g, "").length >= 10) {
            const { deliver } = await import("./channels.server");
            await deliver("whatsapp", sen.whatsapp, `🦇 ${title}\n${body}\n\n${hits.slice(0, 5).map((h) => `• ${h.pageName} — ${h.days} dias · ${h.libraryUrl}`).join("\n")}`).catch(() => null);
          }
        }
        await admin.from("audit_log").insert({ user_id: userId, actor: "sentinela", module: "bat-spy", action: "sentinela", target: sen.label || sen.q || sen.pageUrl, after: { found: ads.length, hits: hits.length } as never, result: "ok" });
        continue;
      }
      if (!sentinelDue(sen, state.at ?? "") || started >= 6) continue;
      const f: SpyFilters = { ...DEFAULT_FILTERS, q: sen.q ?? "", pageUrl: sen.pageUrl ?? "", country: sen.country || "BR", minDays: sen.minDays, limit: 40 };
      for (const k of keys) {
        const r = await fetch(`${API}/acts/${ACTOR}/runs?timeout=600`, { method: "POST", headers: { Authorization: `Bearer ${k.token}`, "Content-Type": "application/json" }, body: actorInput(f) }).catch(() => null);
        if (r && OUT.includes(r.status)) continue;
        if (!r?.ok) { await save({ ...state, at: new Date().toISOString(), error: `Apify respondeu ${r?.status ?? "sem resposta"}.` }); break; }
        const j = (await r.json()) as { data?: { id?: string } };
        await save({ ...state, at: new Date().toISOString(), runId: j.data?.id ?? "", slot: k.platform, error: "" });
        started++;
        break;
      }
    }
  }
  return { sentinelsStarted: started, sentinelAlerts: alerts };
}
