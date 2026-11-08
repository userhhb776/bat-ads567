import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Sends a message through WhatsApp (user's Render server), Telegram bot or webhook. Keys stay server-side. */
export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      channel: z.enum(["whatsapp", "telegram", "email", "webhook"]),
      to: z.string().min(1).max(300),
      text: z.string().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      if (data.channel === "whatsapp") {
        const url = process.env["RENDER_WHATSAPP_URL"];
        const key = process.env["RENDER_WHATSAPP_KEY"];
        if (!url) return { ok: false, error: "Servidor de WhatsApp (Render) ainda não cadastrado." };
        const r = await fetch(url.replace(/\/$/, "") + "/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
          body: JSON.stringify({ phone: data.to.replace(/\D/g, ""), message: data.text }),
        });
        if (!r.ok) return { ok: false, error: `WhatsApp respondeu ${r.status}: ${(await r.text()).slice(0, 200)}` };
        return { ok: true, error: "" };
      }
      if (data.channel === "telegram") {
        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) return { ok: false, error: "Bot do Telegram ainda não cadastrado." };
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: data.to, text: data.text }),
        });
        if (!r.ok) return { ok: false, error: `Telegram respondeu ${r.status}.` };
        return { ok: true, error: "" };
      }
      if (data.channel === "webhook") {
        if (!/^https:\/\//.test(data.to)) return { ok: false, error: "O webhook precisa começar com https://" };
        const r = await fetch(data.to, { method: "POST", headers: { "Content-Type": "application/json" }, body: data.text });
        return r.ok ? { ok: true, error: "" } : { ok: false, error: `Webhook respondeu ${r.status}.` };
      }
      const key = process.env["RESEND_API_KEY"];
      const from = process.env["EMAIL_FROM"];
      if (!key || !from) return { ok: false, error: "Envio de e-mail ainda não configurado." };
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: data.to, subject: data.text.split("\n")[0]!.slice(0, 80), text: data.text }),
      });
      return r.ok ? { ok: true, error: "" } : { ok: false, error: `E-mail respondeu ${r.status}.` };
    } catch {
      return { ok: false, error: "Falha de conexão com o canal." };
    }
  });

export const channelStatus = createServerFn({ method: "GET" }).handler(async () => ({
  whatsapp: !!process.env["RENDER_WHATSAPP_URL"],
  telegram: !!process.env["TELEGRAM_BOT_TOKEN"],
  email: !!process.env["RESEND_API_KEY"] && !!process.env["EMAIL_FROM"],
  deepseek: !!process.env["DEEPSEEK_API_KEY"],
  ollama: !!process.env["OLLAMA_API_KEY"],
  vercel: !!process.env["VERCEL_TOKEN"],
}));

/** Support agent reply grounded on the product knowledge base (Ollama Cloud, fast). */
export const supportReply = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      product: z.string().max(200), knowledge: z.string().max(20000),
      history: z.array(z.object({ from: z.string(), text: z.string().max(4000) })).max(30),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const system = `Você é o atendente do produto "${data.product}". Responda em português, curto, gentil e objetivo, usando SOMENTE a base abaixo. Se não souber, ou se o cliente pedir humano, reembolso ou estiver irritado, responda começando com [HUMANO] e diga que um atendente vai assumir. Classifique no fim com uma linha "CATEGORIA: duvida|acesso|pagamento|reembolso|reclamacao|venda".\n\nBase:\n${data.knowledge || "(vazia)"}`;
    const messages = [{ role: "system", content: system }, ...data.history.map((m) => ({ role: m.from === "cliente" ? "user" : "assistant", content: m.text }))];
    const key = process.env["OLLAMA_API_KEY"];
    const dkey = process.env["DEEPSEEK_API_KEY"];
    try {
      if (key) {
        const r = await fetch("https://ollama.com/api/chat", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env["OLLAMA_MODEL"] || "gpt-oss:120b", messages, stream: false }) });
        const j: any = await r.json().catch(() => ({}));
        if (r.ok) return parse(String(j.message?.content ?? ""));
      }
      if (dkey) {
        const r = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${dkey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "deepseek-chat", messages }) });
        const j: any = await r.json().catch(() => ({}));
        if (r.ok) return parse(String(j.choices?.[0]?.message?.content ?? ""));
        return { text: "", handoff: false, category: "", error: `DeepSeek ${r.status}` };
      }
      return { text: "", handoff: false, category: "", error: "Nenhuma chave de IA cadastrada." };
    } catch {
      return { text: "", handoff: false, category: "", error: "Falha ao chamar a IA." };
    }
  });

function parse(raw: string) {
  const cat = raw.match(/CATEGORIA:\s*(\w+)/i)?.[1] ?? "";
  const text = raw.replace(/CATEGORIA:.*$/im, "").trim();
  return { text: text.replace(/^\[HUMANO\]\s*/, ""), handoff: text.startsWith("[HUMANO]"), category: cat, error: "" };
}
