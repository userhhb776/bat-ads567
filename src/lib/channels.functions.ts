import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Sends a message through WhatsApp (user's Render server), Telegram bot or webhook. Keys stay server-side. */
export const sendMessage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      channel: z.enum(["whatsapp", "telegram", "email", "webhook"]),
      to: z.string().min(1).max(300),
      text: z.string().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.to.startsWith("bot:")) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: own } = await supabaseAdmin.from("support_bots").select("id").eq("id", data.to.slice(4).split("|")[0]!).eq("user_id", context.userId).maybeSingle();
      if (!own) return { ok: false, error: "Esse bot não é seu." };
    }
    const { deliver } = await import("@/lib/channels.server");
    return deliver(data.channel, data.to, data.text);
  });

export const channelStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => ({
  whatsapp: await (await import("@/lib/channels.server")).waConfigured().catch(() => !!process.env["RENDER_WHATSAPP_URL"]),
  telegram: !!process.env["TELEGRAM_BOT_TOKEN"],
  email: !!process.env["RESEND_API_KEY"] && !!process.env["EMAIL_FROM"],
  deepseek: !!process.env["DEEPSEEK_API_KEY"],
  ollama: !!process.env["OLLAMA_API_KEY"],
  vercel: !!process.env["VERCEL_TOKEN"],
}));

/** Support agent reply grounded on the product knowledge base (Ollama Cloud, fast). */
export const supportReply = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      product: z.string().max(200), knowledge: z.string().max(20000),
      history: z.array(z.object({ from: z.string(), text: z.string().max(4000) })).max(30),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { generateReply } = await import("@/lib/support-ai.server");
    return generateReply(data.product, data.knowledge, data.history);
  });

export type WaInstance = { name: string; status: string; profile: string; number: string; pic: string; receiving: boolean; slot: string; server: string };
export type WaServerStatus = { slot: string; name: string; url: string; source: "painel" | "reserva" | "sistema"; primary: boolean; ok: boolean; ms: number; version: string; error: string; key: string; count: number };
/** Incoming messages must reach the published app (the preview is private), so webhooks always point there. */
const APP_URL = () => (process.env["PUBLIC_APP_URL"] || "https://bat-ads567.lovable.app").replace(/\/$/, "");
const slotSchema = z.string().regex(/^(wa-[1-6]|render-2|sistema)$/);
const nameSchema = z.string().regex(/^[a-zA-Z0-9_-]{2,60}$/);
const maskKey = (v: string) => (v ? `••••${v.slice(-4)}` : "");

/** Checks one server: is it online (version) and is the key accepted. */
async function probe(s: { url: string; key: string }) {
  const { waCall } = await import("@/lib/channels.server");
  const t = Date.now();
  try {
    const home = await waCall(s, "/", {}, 75000);
    const j = (await home.json().catch(() => ({}))) as { version?: string; message?: string };
    if (!home.ok) return { ok: false, ms: Date.now() - t, version: "", error: `Respondeu ${home.status}.`, list: [] as any[] };
    const r = await waCall(s, "/instance/fetchInstances", {}, 75000);
    if (r.status === 401 || r.status === 403) return { ok: false, ms: Date.now() - t, version: String(j.version ?? ""), error: "Está no ar, mas a chave não confere.", list: [] as any[] };
    if (!r.ok) return { ok: false, ms: Date.now() - t, version: String(j.version ?? ""), error: `Respondeu ${r.status} ao listar números.`, list: [] as any[] };
    return { ok: true, ms: Date.now() - t, version: String(j.version ?? ""), error: "", list: (await r.json()) as any[] };
  } catch { return { ok: false, ms: Date.now() - t, version: "", error: "Não respondeu (no plano grátis ele pode estar acordando; tente de novo em 1 minuto).", list: [] as any[] }; }
}

/** Lists every WhatsApp server (with status) and the numbers on each one. */
export const whatsappList = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { waServers, waCall } = await import("@/lib/channels.server");
  const all = await waServers(context.userId);
  if (!all.length) return { configured: false, ok: false, ms: 0, servers: [] as WaServerStatus[], instances: [] as WaInstance[], error: "Nenhum servidor cadastrado." };
  const results = await Promise.all(all.map(async (s) => {
    const p = await probe(s);
    const instances: WaInstance[] = await Promise.all(p.list.map(async (i) => {
      const name = String(i.name);
      const hook = await waCall(s, `/webhook/find/${encodeURIComponent(name)}`, {}, 20000).then((x) => (x.ok ? x.json() : null)).catch(() => null) as { enabled?: boolean; url?: string } | null;
      return { name, slot: s.slot, server: s.name, status: String(i.connectionStatus ?? "close"), profile: String(i.profileName ?? ""), number: String(i.ownerJid ?? "").replace(/@.*$/, ""), pic: String(i.profilePicUrl ?? ""), receiving: !!hook?.enabled && String(hook?.url ?? "").includes("/api/public/inbound/whatsapp") };
    }));
    const st: WaServerStatus = { slot: s.slot, name: s.name, url: s.url, source: s.source, primary: s.primary, ok: p.ok, ms: p.ms, version: p.version, error: p.error, key: maskKey(s.key), count: instances.length };
    return { st, instances };
  }));
  const servers = results.map((r) => r.st);
  const first = servers.find((x) => x.ok);
  return { configured: true, ok: !!first, ms: first?.ms ?? 0, servers, instances: results.flatMap((r) => r.instances), error: first ? "" : "Nenhum servidor respondeu." };
});

/** Tests an address + key before saving (or a saved server when only the slot is sent). */
export const waServerTest = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().url().max(300).optional(), key: z.string().max(300).optional(), slot: slotSchema.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let target = { url: data.url ?? "", key: data.key ?? "" };
    if (data.slot && (!target.url || !target.key)) {
      const { waServers } = await import("@/lib/channels.server");
      const s = (await waServers(context.userId)).find((x) => x.slot === data.slot);
      if (!s) throw new Error("Servidor não encontrado.");
      target = { url: target.url || s.url, key: target.key || s.key };
    }
    if (!/^https:\/\//.test(target.url)) throw new Error("O endereço precisa começar com https://");
    const p = await probe(target);
    return { ok: p.ok, ms: p.ms, version: p.version, error: p.error, count: p.list.length };
  });

/** Adds or edits a panel server (nickname, address, key, main). Leaving the key empty on edit keeps the saved one. */
export const waServerSave = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slot: slotSchema.optional(), name: z.string().trim().min(1).max(40), url: z.string().url().max(300), key: z.string().max(300), primary: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!/^https:\/\//.test(data.url)) throw new Error("O endereço precisa começar com https://");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { WA_SLOTS, waServers, clearWaCache } = await import("@/lib/channels.server");
    const mine = await waServers(context.userId);
    const old = data.slot ? mine.find((x) => x.slot === data.slot) : undefined;
    if (data.slot === "sistema") throw new Error("O servidor original é fixo; cadastre um novo e marque como principal.");
    const key = data.key.trim() || old?.key || "";
    if (!key) throw new Error("Informe a chave (AUTHENTICATION_API_KEY).");
    const used = new Set(mine.filter((x) => x.source === "painel").map((x) => x.slot));
    const slot = data.slot?.startsWith("wa-") ? data.slot : WA_SLOTS.find((x) => !used.has(x));
    if (!slot) throw new Error("Limite de 6 servidores atingido.");
    if (data.primary) {
      for (const s of mine.filter((x) => x.source === "painel" && x.primary && x.slot !== slot)) {
        await supabaseAdmin.from("gateway_credentials" as never).update({ token: JSON.stringify({ url: s.url, name: s.name, primary: false }), updated_at: new Date().toISOString() } as never).eq("user_id", context.userId).eq("platform", s.slot);
      }
    }
    const { error } = await supabaseAdmin.from("gateway_credentials" as never).upsert({ user_id: context.userId, platform: slot, token: JSON.stringify({ url: data.url.trim().replace(/\/$/, ""), name: data.name.trim(), primary: data.primary }), secret: key, updated_at: new Date().toISOString() } as never, { onConflict: "user_id,platform" });
    if (error) throw new Error("Não consegui salvar o servidor.");
    if (data.slot === "render-2") await supabaseAdmin.from("gateway_credentials" as never).delete().eq("user_id", context.userId).eq("platform", "render-2");
    clearWaCache();
    await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "whatsapp", action: old ? "editar_servidor" : "adicionar_servidor", target: data.name.trim(), result: "ok" });
    return { ok: true, slot };
  });

export const waServerDelete = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slot: z.string().regex(/^(wa-[1-6]|render-2)$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { clearWaCache } = await import("@/lib/channels.server");
    await supabaseAdmin.from("gateway_credentials" as never).delete().eq("user_id", context.userId).eq("platform", data.slot);
    clearWaCache();
    await supabaseAdmin.from("audit_log").insert({ user_id: context.userId, actor: "chefe", module: "whatsapp", action: "remover_servidor", target: data.slot, result: "ok" });
    return { ok: true };
  });

/** Creates a number (or reconnects one) on a chosen server and returns the QR Code; also points incoming messages to the support inbox. */
export const whatsappConnect = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().regex(/^[a-zA-Z0-9_-]{2,40}$/), isNew: z.boolean(), slot: slotSchema.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { evo, waServers } = await import("@/lib/channels.server");
    const slot = data.slot ?? (await waServers(context.userId))[0]?.slot;
    const { data: st } = await context.supabase.from("user_settings").select("webhook_token").eq("user_id", context.userId).maybeSingle();
    const hook = st?.webhook_token ? `${APP_URL()}/api/public/inbound/whatsapp?token=${st.webhook_token}` : "";
    let r: Response;
    if (data.isNew) {
      r = await evo("/instance/create", { method: "POST", body: JSON.stringify({ instanceName: data.name, qrcode: true, integration: "WHATSAPP-BAILEYS", ...(hook ? { webhook: { url: hook, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] } } : {}) }) }, slot);
    } else {
      r = await evo(`/instance/connect/${encodeURIComponent(data.name)}`, {}, slot);
      if (hook) await evo(`/webhook/set/${encodeURIComponent(data.name)}`, { method: "POST", body: JSON.stringify({ webhook: { enabled: true, url: hook, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] } }) }, slot).catch(() => null);
    }
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Servidor respondeu ${r.status}: ${JSON.stringify(j?.response?.message ?? j?.message ?? j).slice(0, 200)}`);
    const qr = j?.qrcode?.base64 ?? j?.base64 ?? "";
    const code = j?.qrcode?.pairingCode ?? j?.pairingCode ?? "";
    await context.supabase.from("audit_log").insert({ user_id: context.userId, module: "whatsapp", action: data.isNew ? "criar" : "conectar", target: data.name });
    return { qr: String(qr), pairingCode: String(code ?? ""), webhook: !!hook };
  });

/** Points a connected number's incoming messages to the support inbox (and the auto-reply agent). */
export const whatsappHook = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: nameSchema, slot: slotSchema.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { evo } = await import("@/lib/channels.server");
    const { data: st } = await context.supabase.from("user_settings").select("webhook_token").eq("user_id", context.userId).maybeSingle();
    if (!st?.webhook_token) throw new Error("Crie primeiro o seu link de webhook em Integrações.");
    const url = `${APP_URL()}/api/public/inbound/whatsapp?token=${st.webhook_token}`;
    const r = await evo(`/webhook/set/${encodeURIComponent(data.name)}`, { method: "POST", body: JSON.stringify({ webhook: { enabled: true, url, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] } }) }, data.slot);
    if (!r.ok) throw new Error(`Servidor respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
    await context.supabase.from("audit_log").insert({ user_id: context.userId, module: "whatsapp", action: "receber-mensagens", target: data.name });
    return { ok: true };
  });

/** Disconnects (logout) or removes a number from its server. */
export const whatsappRemove = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: nameSchema, mode: z.enum(["logout", "delete"]), slot: slotSchema.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { evo } = await import("@/lib/channels.server");
    const r = await evo(`/instance/${data.mode}/${encodeURIComponent(data.name)}`, { method: "DELETE" }, data.slot);
    if (!r.ok) throw new Error(`Servidor respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
    await context.supabase.from("audit_log").insert({ user_id: context.userId, module: "whatsapp", action: data.mode === "delete" ? "excluir" : "desconectar", target: data.name });
    return { ok: true };
  });

/** Saldo real da conta DeepSeek (API oficial /user/balance). */
export const deepseekBalance = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const key = process.env["DEEPSEEK_API_KEY"];
  if (!key) return { ok: false, error: "Chave da DeepSeek não cadastrada.", available: false, balance: 0, currency: "USD" };
  const r = await fetch("https://api.deepseek.com/user/balance", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) return { ok: false, error: `DeepSeek respondeu ${r.status}.`, available: false, balance: 0, currency: "USD" };
  const j = (await r.json()) as { is_available?: boolean; balance_infos?: { currency: string; total_balance: string }[] };
  const b = j.balance_infos?.[0];
  return { ok: true, error: "", available: !!j.is_available, balance: Number(b?.total_balance ?? 0), currency: b?.currency ?? "USD" };
});
