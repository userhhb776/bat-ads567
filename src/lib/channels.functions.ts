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
  whatsapp: !!process.env["RENDER_WHATSAPP_URL"],
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

export type WaInstance = { name: string; status: string; profile: string; number: string; pic: string; receiving: boolean };
/** Incoming messages must reach the published app (the preview is private), so webhooks always point there. */
const APP_URL = () => (process.env["PUBLIC_APP_URL"] || "https://bat-ads567.lovable.app").replace(/\/$/, "");

/** Lists the WhatsApp numbers on the user's Evolution API server. */
export const whatsappList = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  if (!process.env["RENDER_WHATSAPP_URL"]) return { configured: false, ok: false, ms: 0, instances: [] as WaInstance[], error: "Servidor não cadastrado." };
  const { evo } = await import("@/lib/channels.server");
  const t = Date.now();
  try {
    const r = await evo("/instance/fetchInstances");
    if (!r.ok) return { configured: true, ok: false, ms: Date.now() - t, instances: [] as WaInstance[], error: `Servidor respondeu ${r.status}.` };
    const list = (await r.json()) as any[];
    const instances: WaInstance[] = await Promise.all(list.map(async (i) => {
      const name = String(i.name);
      const hook = await evo(`/webhook/find/${encodeURIComponent(name)}`).then((x) => (x.ok ? x.json() : null)).catch(() => null) as { enabled?: boolean; url?: string } | null;
      return { name, status: String(i.connectionStatus ?? "close"), profile: String(i.profileName ?? ""), number: String(i.ownerJid ?? "").replace(/@.*$/, ""), pic: String(i.profilePicUrl ?? ""), receiving: !!hook?.enabled && String(hook?.url ?? "").includes("/api/public/inbound/whatsapp") };
    }));
    return { configured: true, ok: true, ms: Date.now() - t, instances, error: "" };
  } catch { return { configured: true, ok: false, ms: Date.now() - t, instances: [] as WaInstance[], error: "Servidor não respondeu (pode estar acordando no Render; tente de novo em 1 minuto)." }; }
});

/** Creates a number (or reconnects one) and returns the QR Code; also points incoming messages to the support inbox. */
export const whatsappConnect = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().regex(/^[a-zA-Z0-9_-]{2,40}$/), isNew: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { evo } = await import("@/lib/channels.server");
    const { data: st } = await context.supabase.from("user_settings").select("webhook_token").eq("user_id", context.userId).maybeSingle();
    const hook = st?.webhook_token ? `${APP_URL()}/api/public/inbound/whatsapp?token=${st.webhook_token}` : "";
    let r: Response;
    if (data.isNew) {
      r = await evo("/instance/create", { method: "POST", body: JSON.stringify({ instanceName: data.name, qrcode: true, integration: "WHATSAPP-BAILEYS", ...(hook ? { webhook: { url: hook, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] } } : {}) }) });
    } else {
      r = await evo(`/instance/connect/${encodeURIComponent(data.name)}`);
      if (hook) await evo(`/webhook/set/${encodeURIComponent(data.name)}`, { method: "POST", body: JSON.stringify({ webhook: { enabled: true, url: hook, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] } }) }).catch(() => null);
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
  .inputValidator((d) => z.object({ name: z.string().regex(/^[a-zA-Z0-9_-]{2,60}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { evo } = await import("@/lib/channels.server");
    const { data: st } = await context.supabase.from("user_settings").select("webhook_token").eq("user_id", context.userId).maybeSingle();
    if (!st?.webhook_token) throw new Error("Crie primeiro o seu link de webhook em Integrações.");
    const url = `${APP_URL()}/api/public/inbound/whatsapp?token=${st.webhook_token}`;
    const r = await evo(`/webhook/set/${encodeURIComponent(data.name)}`, { method: "POST", body: JSON.stringify({ webhook: { enabled: true, url, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] } }) });
    if (!r.ok) throw new Error(`Servidor respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
    await context.supabase.from("audit_log").insert({ user_id: context.userId, module: "whatsapp", action: "receber-mensagens", target: data.name });
    return { ok: true };
  });

/** Disconnects (logout) or removes a number from the server. */
export const whatsappRemove = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().regex(/^[a-zA-Z0-9_-]{2,60}$/), mode: z.enum(["logout", "delete"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { evo } = await import("@/lib/channels.server");
    const r = await evo(`/instance/${data.mode}/${encodeURIComponent(data.name)}`, { method: "DELETE" });
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
