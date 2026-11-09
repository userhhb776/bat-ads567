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

/** Calls the user's Evolution API server on Render. */
export async function evo(path: string, init: RequestInit = {}): Promise<Response> {
  const url = process.env["RENDER_WHATSAPP_URL"];
  const key = process.env["RENDER_WHATSAPP_KEY"] ?? "";
  if (!url) throw new Error("Servidor de WhatsApp (Render) ainda não cadastrado.");
  return fetch(url.replace(/\/$/, "") + path, { ...init, headers: { "Content-Type": "application/json", apikey: key, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(60000) });
}

export async function firstOpenInstance(): Promise<string> {
  const pref = process.env["RENDER_WHATSAPP_INSTANCE"];
  if (pref) return pref;
  const r = await evo("/instance/fetchInstances");
  if (!r.ok) return "";
  const list = (await r.json()) as { name: string; connectionStatus: string }[];
  return list.find((i) => i.connectionStatus === "open")?.name ?? "";
}
