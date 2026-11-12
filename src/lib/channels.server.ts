/** Server-only delivery through WhatsApp (Render), Telegram, e-mail (Resend) or webhook. Keys never leave the server. */
export type Channel = "whatsapp" | "telegram" | "email" | "webhook";

export async function deliver(channel: Channel, to: string, text: string): Promise<{ ok: boolean; error: string }> {
  try {
    if (channel === "whatsapp") {
      const [inst, phone] = to.includes("|") ? to.split("|") as [string, string] : ["", to];
      const instance = inst || (await firstOpenInstance());
      if (!instance) return { ok: false, error: "Nenhum WhatsApp conectado no servidor." };
      const r = await evo(`/message/sendText/${encodeURIComponent(instance)}`, { method: "POST", body: JSON.stringify({ number: phone.replace(/\D/g, ""), text }) });
      if (!r.ok) return { ok: false, error: `WhatsApp respondeu ${r.status}: ${(await r.text()).slice(0, 200)}` };
      return { ok: true, error: "" };
    }
    if (channel === "telegram" && to.startsWith("bot:")) {
      const [botId, chat] = to.slice(4).split("|") as [string, string];
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: bot } = await supabaseAdmin.from("support_bots").select("token").eq("id", botId).maybeSingle();
      const token = bot?.token;
      if (!token || !chat) return { ok: false, error: "Bot do agente não encontrado." };
      const { telegramSend } = await import("./support-ai.server");
      return telegramSend(token, chat, text);
    }
    if (channel === "telegram") {
      const token = process.env["TELEGRAM_BOT_TOKEN"];
      if (!token) return { ok: false, error: "Bot do Telegram ainda não cadastrado." };
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: to, text }),
      });
      return r.ok ? { ok: true, error: "" } : { ok: false, error: `Telegram respondeu ${r.status}.` };
    }
    if (channel === "webhook") {
      if (!/^https:\/\//.test(to)) return { ok: false, error: "O webhook precisa começar com https://" };
      const r = await fetch(to, { method: "POST", headers: { "Content-Type": "application/json" }, body: text });
      return r.ok ? { ok: true, error: "" } : { ok: false, error: `Webhook respondeu ${r.status}.` };
    }
    const key = process.env["RESEND_API_KEY"];
    const from = process.env["EMAIL_FROM"];
    if (!key || !from) return { ok: false, error: "Envio de e-mail ainda não configurado." };
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: text.split("\n")[0]!.slice(0, 80), text }),
    });
    return r.ok ? { ok: true, error: "" } : { ok: false, error: `E-mail respondeu ${r.status}.` };
  } catch {
    return { ok: false, error: "Falha de conexão com o canal." };
  }
}

export type WaServer = { slot: string; name: string; url: string; key: string; primary: boolean; source: "painel" | "reserva" | "sistema" };
export const WA_SLOTS = ["wa-1", "wa-2", "wa-3", "wa-4", "wa-5", "wa-6"] as const;

/** Panel servers store token = JSON {url,name,primary}; legacy reserve (render-2) and the system server stay as fallbacks. */
export function parseWaToken(token: string): { url: string; name: string; primary: boolean } {
  try { const j = JSON.parse(token) as { url?: string; name?: string; primary?: boolean }; return { url: String(j.url ?? ""), name: String(j.name ?? ""), primary: !!j.primary }; }
  catch { return { url: token, name: "", primary: false }; }
}

let cache: { at: number; list: WaServer[] } | null = null;
export function clearWaCache() { cache = null; }

/** Every WhatsApp server in priority order: main panel server, other panel servers, old reserve, system server. */
export async function waServers(userId?: string): Promise<WaServer[]> {
  if (!userId && cache && Date.now() - cache.at < 30000) return cache.list;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin.from("gateway_credentials" as never).select("platform, token, secret").in("platform", [...WA_SLOTS, "render-2"]);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  const rows = (data ?? []) as { platform: string; token: string; secret: string }[];
  const panel = rows.filter((r) => r.platform.startsWith("wa-")).map((r) => { const t = parseWaToken(r.token); return { slot: r.platform, name: t.name || `Servidor ${r.platform.slice(3)}`, url: t.url, key: r.secret, primary: t.primary, source: "painel" as const }; })
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.slot.localeCompare(b.slot));
  const list: WaServer[] = [...panel];
  const old = rows.find((r) => r.platform === "render-2");
  if (old?.token) list.push({ slot: "render-2", name: "Reserva antiga", url: old.token, key: old.secret, primary: false, source: "reserva" });
  const envUrl = process.env["RENDER_WHATSAPP_URL"];
  if (envUrl) list.push({ slot: "sistema", name: "Servidor original", url: envUrl, key: process.env["RENDER_WHATSAPP_KEY"] ?? "", primary: false, source: "sistema" });
  const seen = new Set<string>();
  const out = list.filter((s) => { const k = s.url.replace(/\/$/, "").toLowerCase(); if (!s.url || seen.has(k)) return false; seen.add(k); return true; });
  if (!userId) cache = { at: Date.now(), list: out };
  return out;
}

export function waCall(server: Pick<WaServer, "url" | "key">, path: string, init: RequestInit = {}, ms = 60000): Promise<Response> {
  return fetch(server.url.replace(/\/$/, "") + path, { ...init, headers: { "Content-Type": "application/json", apikey: server.key, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(ms) });
}

/** Calls the Evolution API, trying the next server when one is down, rejects the key or doesn't have the number. Pass a slot to use only that server. */
export async function evo(path: string, init: RequestInit = {}, slot?: string): Promise<Response> {
  const all = await waServers();
  const list = slot ? all.filter((s) => s.slot === slot) : all;
  if (!list.length) throw new Error(slot ? "Esse servidor de WhatsApp não existe mais." : "Servidor de WhatsApp ainda não cadastrado.");
  let last: Response | null = null; let err: unknown = null;
  for (const s of list) {
    try {
      const res = await waCall(s, path, init);
      if (res.status < 500 && ![401, 403, 404].includes(res.status)) return res;
      last = res;
    } catch (e) { err = e; }
  }
  if (last) return last;
  throw err instanceof Error ? err : new Error("Servidor de WhatsApp não respondeu.");
}

export async function waConfigured(): Promise<boolean> { return (await waServers()).length > 0; }

export async function firstOpenInstance(): Promise<string> {
  const pref = process.env["RENDER_WHATSAPP_INSTANCE"];
  if (pref) return pref;
  const r = await evo("/instance/fetchInstances");
  if (!r.ok) return "";
  const list = (await r.json()) as { name: string; connectionStatus: string }[];
  return list.find((i) => i.connectionStatus === "open")?.name ?? "";
}
