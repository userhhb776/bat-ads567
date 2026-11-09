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

export type WaInstance = { name: string; status: string; profile: string; number: string; pic: string };

/** Lists the WhatsApp numbers on the user's Evolution API server. */
export const whatsappList = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  if (!process.env["RENDER_WHATSAPP_URL"]) return { configured: false, ok: false, ms: 0, instances: [] as WaInstance[], error: "Servidor não cadastrado." };
  const { evo } = await import("@/lib/channels.server");
  const t = Date.now();
  try {
    const r = await evo("/instance/fetchInstances");
    if (!r.ok) return { configured: true, ok: false, ms: Date.now() - t, instances: [] as WaInstance[], error: `Servidor respondeu ${r.status}.` };
    const list = (await r.json()) as any[];
    const instances: WaInstance[] = list.map((i) => ({ name: String(i.name), status: String(i.connectionStatus ?? "close"), profile: String(i.profileName ?? ""), number: String(i.ownerJid ?? "").replace(/@.*$/, ""), pic: String(i.profilePicUrl ?? "") }));
    return { configured: true, ok: true, ms: Date.now() - t, instances, error: "" };
  } catch { return { configured: true, ok: false, ms: Date.now() - t, instances: [] as WaInstance[], error: "Servidor não respondeu (pode estar acordando no Render; tente de novo em 1 minuto)." }; }
});

/** Creates a number (or reconnects one) and returns the QR Code; also points incoming messages to the support inbox. */
export const whatsappConnect = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().regex(/^[a-zA-Z0-9_-]{2,40}$/), isNew: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { evo } = await import("@/lib/channels.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    const { data: st } = await context.supabase.from("user_settings").select("webhook_token").eq("user_id", context.userId).maybeSingle();
    const origin = new URL(getRequest().url).origin;
    const hook = st?.webhook_token ? `${origin}/api/public/inbound/whatsapp?token=${st.webhook_token}` : "";
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
