/** Server-only delivery through WhatsApp (Render), Telegram, e-mail (Resend) or webhook. Keys never leave the server. */
export type Channel = "whatsapp" | "telegram" | "email" | "webhook";

export async function deliver(channel: Channel, to: string, text: string): Promise<{ ok: boolean; error: string }> {
  try {
    if (channel === "whatsapp") {
      const url = process.env["RENDER_WHATSAPP_URL"];
      const key = process.env["RENDER_WHATSAPP_KEY"];
      if (!url) return { ok: false, error: "Servidor de WhatsApp (Render) ainda não cadastrado." };
      const r = await fetch(url.replace(/\/$/, "") + "/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({ phone: to.replace(/\D/g, ""), message: text }),
      });
      if (!r.ok) return { ok: false, error: `WhatsApp respondeu ${r.status}: ${(await r.text()).slice(0, 200)}` };
      return { ok: true, error: "" };
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
