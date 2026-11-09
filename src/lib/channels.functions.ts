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
  .handler(async ({ data }) => {
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

/** Asks the user's Render WhatsApp server for its session status (GET /status). */
export const whatsappStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const url = process.env["RENDER_WHATSAPP_URL"]; const key = process.env["RENDER_WHATSAPP_KEY"];
  if (!url) return { configured: false, ok: false, ms: 0, body: "Servidor não cadastrado." };
  const t = Date.now();
  try {
    const r = await fetch(url.replace(/\/$/, "") + "/status", { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(15000) });
    const body = (await r.text()).slice(0, 1500);
    return { configured: true, ok: r.ok, ms: Date.now() - t, status: r.status, body };
  } catch { return { configured: true, ok: false, ms: Date.now() - t, body: "Servidor não respondeu (pode estar dormindo no Render; tente de novo em 1 minuto)." }; }
});
